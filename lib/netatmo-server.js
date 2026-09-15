// lib/netatmo-server.js
//
// Server-only helpers for the Netatmo-touching Next.js API routes — same
// shape as lib/vaillant-server.js, plus the OAuth `state` signing that
// Vaillant/MELCloud don't need (their connect route runs authenticated,
// in one request; Netatmo's connect is a two-hop browser redirect through
// Netatmo's own login page, so the household id has to survive that round
// trip some other way than a Bearer header).
//
// `state` is a signed, self-contained token — no new DB table just to
// remember "which household started this OAuth flow": HMAC'd with
// SUPABASE_SERVICE_ROLE_KEY (already a server-only secret, so this adds no
// new secret to manage) and stamped with a 10-minute expiry.

import crypto from 'node:crypto';
import * as provider from '../providers/netatmo/index.js';
import { adminClient, markConnectionError, markConnectionOk } from './melcloud-server.js';

export { adminClient, markConnectionError, markConnectionOk };

const STATE_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STATE_TTL_MS = 10 * 60 * 1000;

export function signNetatmoState(householdId) {
  const payload = JSON.stringify({ hid: householdId, exp: Date.now() + STATE_TTL_MS });
  const b64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

// Returns the household id, or null if the state is missing, malformed,
// tampered with, or expired — callers should treat null as "start over".
export function verifyNetatmoState(state) {
  if (typeof state !== 'string' || !state.includes('.')) return null;
  const [b64, sig] = state.split('.');
  if (!b64 || !sig) return null;
  const expectedSig = crypto.createHmac('sha256', STATE_SECRET).update(b64).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload?.hid || !payload?.exp || Date.now() > payload.exp) return null;
  return payload.hid;
}

export class NetatmoFriendlyError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export function toFriendlyError(err) {
  if (err instanceof NetatmoFriendlyError) return err;
  const message = String(err?.message || err);
  if (message === 'TOKEN_REJECTED') {
    return new NetatmoFriendlyError('invalid_credentials', 'Netatmo je zavrnil avtorizacijo.');
  }
  if (message === 'REFRESH_REJECTED' || message === 'TOKEN_EXPIRED') {
    return new NetatmoFriendlyError('reauth_needed', 'Netatmo povezavo je treba znova vzpostaviti.');
  }
  if (err?.name === 'NetatmoServiceError') {
    return new NetatmoFriendlyError('unavailable', 'Netatmo trenutno ni dosegljiv, poskusi znova kasneje.');
  }
  return new NetatmoFriendlyError('unknown', message);
}

/**
 * getValidAccessToken(admin, householdId, providerName) — same contract as
 * melcloud-server.js's version, refreshing through the Netatmo provider
 * module. providerName kept as a parameter only for consistency with the
 * other *-server.js files (see lib/providers.js) — always 'netatmo' here.
 */
export async function getValidAccessToken(admin, householdId, providerName) {
  const { data: connection, error: connErr } = await admin
    .from('provider_connections')
    .select('id, status')
    .eq('household_id', householdId)
    .eq('provider', providerName)
    .maybeSingle();
  if (connErr || !connection) {
    throw new NetatmoFriendlyError('reauth_needed', 'Netatmo ni povezan.');
  }

  const { data: secret, error: secretErr } = await admin
    .from('provider_connection_secrets')
    .select('access_token, refresh_token, token_expires_at')
    .eq('connection_id', connection.id)
    .maybeSingle();
  if (secretErr || !secret) {
    await markConnectionError(admin, connection.id, 'missing_secret');
    throw new NetatmoFriendlyError('reauth_needed', 'Netatmo ni povezan.');
  }

  const expiresAt = new Date(secret.token_expires_at).getTime();
  const stillValid = Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000;
  if (stillValid) return secret.access_token;

  let refreshed;
  try {
    refreshed = await provider.refreshAccessToken(secret.refresh_token);
  } catch (err) {
    const friendly = toFriendlyError(err);
    if (friendly.code === 'reauth_needed') {
      await markConnectionError(admin, connection.id, 'refresh_rejected');
    }
    throw friendly;
  }

  await admin
    .from('provider_connection_secrets')
    .update({
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken,
      token_expires_at: new Date(refreshed.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('connection_id', connection.id);

  if (connection.status !== 'connected') await markConnectionOk(admin, connection.id);

  return refreshed.accessToken;
}
