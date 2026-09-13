// lib/melcloud-server.js
//
// Server-only helpers shared by the two MELCloud-touching Next.js API
// routes (connect/disconnect, and the per-device command route). Never
// import this from client code — it reaches provider_connection_secrets,
// which the service role is the only thing allowed to touch (see
// supabase/migrations/20260913125400_provider_connections.sql).
//
// Token lifecycle lives here rather than in the provider module itself:
// providers/melcloud-home/index.js is a pure API client (no DB, no
// knowledge of "connections"), while this file is the glue that knows
// where tokens are stored and when they need refreshing.

import { createClient } from '@supabase/supabase-js';
import * as provider from '../providers/melcloud-home/index.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

// A stable, user-presentable error code + message pair, so API routes and
// the Settings UI don't need to pattern-match on provider.js's internal
// MelCloud*Error messages (which are implementation details of the
// Cognito login dance, not something to show a person).
export class MelcloudFriendlyError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// Maps a raw provider error (thrown by login/refreshAccessToken/getDevices/
// control calls) to a MelcloudFriendlyError, so every call site handles the
// same small set of codes: 'invalid_credentials', 'reauth_needed',
// 'unavailable', 'unknown'.
export function toFriendlyError(err) {
  if (err instanceof MelcloudFriendlyError) return err;
  const message = String(err?.message || err);
  if (message === 'WRONG_CREDENTIALS') {
    return new MelcloudFriendlyError('invalid_credentials', 'MELCloud zavrnil e-poštni naslov ali geslo.');
  }
  if (message === 'REFRESH_REJECTED' || message === 'TOKEN_EXPIRED') {
    return new MelcloudFriendlyError('reauth_needed', 'MELCloud povezavo je treba znova vzpostaviti.');
  }
  if (err?.name === 'MelCloudServiceError') {
    return new MelcloudFriendlyError('unavailable', 'MELCloud trenutno ni dosegljiv, poskusi znova kasneje.');
  }
  return new MelcloudFriendlyError('unknown', message);
}

/**
 * getValidAccessToken(admin, householdId, providerName) — the single place
 * that turns a stored connection into a usable bearer token. Refreshes and
 * persists a new access token when the stored one has expired (with a
 * 60s safety margin), and marks the connection as needing reconnection
 * when the refresh token itself has been rejected.
 *
 * Throws MelcloudFriendlyError('reauth_needed') if there's no connection
 * at all, or if the refresh token is no longer valid.
 */
export async function getValidAccessToken(admin, householdId, providerName) {
  const { data: connection, error: connErr } = await admin
    .from('provider_connections')
    .select('id, status')
    .eq('household_id', householdId)
    .eq('provider', providerName)
    .maybeSingle();
  if (connErr || !connection) {
    throw new MelcloudFriendlyError('reauth_needed', 'Naprave niso povezane.');
  }

  const { data: secret, error: secretErr } = await admin
    .from('provider_connection_secrets')
    .select('access_token, refresh_token, token_expires_at')
    .eq('connection_id', connection.id)
    .maybeSingle();
  if (secretErr || !secret) {
    await markConnectionError(admin, connection.id, 'missing_secret');
    throw new MelcloudFriendlyError('reauth_needed', 'Naprave niso povezane.');
  }

  const expiresAt = new Date(secret.token_expires_at).getTime();
  const stillValid = Number.isFinite(expiresAt) && expiresAt - Date.now() > 60_000;
  if (stillValid) return secret.access_token;

  // Expired (or about to be) — refresh. A rejected refresh token means the
  // household has to run the connect form again with their password.
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

export async function markConnectionError(admin, connectionId, message) {
  await admin
    .from('provider_connections')
    .update({ status: 'error', last_error: message, updated_at: new Date().toISOString() })
    .eq('id', connectionId);
}

export async function markConnectionOk(admin, connectionId) {
  await admin
    .from('provider_connections')
    .update({ status: 'connected', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', connectionId);
}
