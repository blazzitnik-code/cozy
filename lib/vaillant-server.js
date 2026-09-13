// lib/vaillant-server.js
//
// Server-only helpers shared by the Vaillant-touching Next.js API routes —
// same shape as lib/melcloud-server.js (see that file's header comment for
// why token lifecycle lives here rather than in the provider module).
// adminClient() is reused from melcloud-server.js rather than redefined —
// it's a generic service-role client factory despite the file's
// MELCloud-specific name (the freebusy sync route does the same).

import * as provider from '../providers/vaillant/index.js';
import { adminClient, markConnectionError, markConnectionOk } from './melcloud-server.js';

export { adminClient, markConnectionError, markConnectionOk };

export class VaillantFriendlyError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// Maps a raw provider error to a VaillantFriendlyError — same small set of
// codes as MELCloud's toFriendlyError: 'invalid_credentials',
// 'reauth_needed', 'unavailable', 'unsupported_controller', 'unknown'.
export function toFriendlyError(err) {
  if (err instanceof VaillantFriendlyError) return err;
  const message = String(err?.message || err);
  if (message === 'WRONG_CREDENTIALS') {
    return new VaillantFriendlyError('invalid_credentials', 'Vaillant je zavrnil e-poštni naslov ali geslo.');
  }
  if (message === 'REFRESH_REJECTED' || message === 'TOKEN_EXPIRED') {
    return new VaillantFriendlyError('reauth_needed', 'Vaillant povezavo je treba znova vzpostaviti.');
  }
  if (err?.name === 'VaillantUnsupportedControllerError') {
    return new VaillantFriendlyError('unsupported_controller', message);
  }
  if (err?.name === 'VaillantServiceError') {
    return new VaillantFriendlyError('unavailable', 'Vaillant trenutno ni dosegljiv, poskusi znova kasneje.');
  }
  return new VaillantFriendlyError('unknown', message);
}

/**
 * getValidAccessToken(admin, householdId, providerName) — same contract as
 * melcloud-server.js's version, just refreshing through the Vaillant
 * provider module. providerName is always 'vaillant' here but kept as a
 * parameter so callers can stay provider-agnostic (see lib/providers.js).
 */
export async function getValidAccessToken(admin, householdId, providerName) {
  const { data: connection, error: connErr } = await admin
    .from('provider_connections')
    .select('id, status')
    .eq('household_id', householdId)
    .eq('provider', providerName)
    .maybeSingle();
  if (connErr || !connection) {
    throw new VaillantFriendlyError('reauth_needed', 'Peč ni povezana.');
  }

  const { data: secret, error: secretErr } = await admin
    .from('provider_connection_secrets')
    .select('access_token, refresh_token, token_expires_at')
    .eq('connection_id', connection.id)
    .maybeSingle();
  if (secretErr || !secret) {
    await markConnectionError(admin, connection.id, 'missing_secret');
    throw new VaillantFriendlyError('reauth_needed', 'Peč ni povezana.');
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
