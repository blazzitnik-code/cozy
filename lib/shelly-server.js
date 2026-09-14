// lib/shelly-server.js
//
// Server-only helpers shared by the Shelly-touching Next.js API routes —
// same shape as lib/melcloud-server.js / lib/vaillant-server.js, but much
// thinner: Shelly has no token refresh at all (see providers/shelly/
// index.js's header comment), so getValidAccessToken() here just returns
// the stored packed token straight from the DB with no expiry check.
// adminClient()/markConnectionError()/markConnectionOk() are reused from
// melcloud-server.js — generic service-role helpers despite the file name.

import { adminClient, markConnectionError, markConnectionOk } from './melcloud-server.js';

export { adminClient, markConnectionError, markConnectionOk };

export class ShellyFriendlyError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

// Maps a raw provider error to a ShellyFriendlyError.
export function toFriendlyError(err) {
  if (err instanceof ShellyFriendlyError) return err;
  const message = String(err?.message || err);
  if (err?.name === 'ShellyAuthError' || message === 'INVALID_KEY') {
    return new ShellyFriendlyError('invalid_credentials', 'Shelly je zavrnil ključ ali naslov strežnika.');
  }
  return new ShellyFriendlyError('unknown', message);
}

/**
 * getValidAccessToken(admin, householdId, providerName) — same call
 * signature as the other two providers' versions (see lib/providers.js)
 * so app/api/home-devices/[id]/command/route.js can stay provider-
 * agnostic, but there is nothing to refresh: the stored access_token IS
 * the packed {server, authKey} connect() produced, valid until the
 * household changes their Shelly password (at which point every call
 * fails with invalid_credentials and they reconnect with the new key).
 */
export async function getValidAccessToken(admin, householdId, providerName) {
  const { data: connection, error: connErr } = await admin
    .from('provider_connections')
    .select('id, status')
    .eq('household_id', householdId)
    .eq('provider', providerName)
    .maybeSingle();
  if (connErr || !connection) {
    throw new ShellyFriendlyError('reauth_needed', 'Shelly ni povezan.');
  }

  const { data: secret, error: secretErr } = await admin
    .from('provider_connection_secrets')
    .select('access_token')
    .eq('connection_id', connection.id)
    .maybeSingle();
  if (secretErr || !secret) {
    await markConnectionError(admin, connection.id, 'missing_secret');
    throw new ShellyFriendlyError('reauth_needed', 'Shelly ni povezan.');
  }

  if (connection.status !== 'connected') await markConnectionOk(admin, connection.id);

  return secret.access_token;
}
