// Netatmo redirects the browser here after the household approves (or
// denies) access on Netatmo's own consent page. No Authorization header
// exists on this request — it's Netatmo's server-to-browser redirect, not
// our own client's fetch — so the household is recovered from the signed
// `state` round-tripped through the URL (see
// lib/netatmo-server.js#verifyNetatmoState), the same way netatmo-authorize
// put it there.
//
// Mirrors the tail of /connect (exchange for tokens, upsert
// provider_connections + provider_connection_secrets, populate
// home_devices immediately rather than waiting for the next cron sync),
// then redirects back into the app — there's no page for Netatmo to render
// here, only a bounce.
import * as netatmo from '../../../../providers/netatmo/index.js';
import { adminClient, markConnectionOk, toFriendlyError, verifyNetatmoState } from '../../../../lib/netatmo-server.js';

function toHomeDeviceRow(householdId, d) {
  return {
    household_id: householdId,
    provider: 'netatmo',
    device_type: d.type,
    external_id: d.externalId,
    name: d.name,
    state: d.state,
    capabilities: d.capabilities,
    last_synced_at: new Date().toISOString(),
    last_error: null,
  };
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const deniedOrErrored = url.searchParams.get('error');
  const back = (query) => Response.redirect(`${url.origin}/?${query}#devices`, 302);

  const householdId = verifyNetatmoState(state);
  if (deniedOrErrored || !code || !householdId) {
    return back('netatmo=error&reason=denied');
  }

  let tokens;
  try {
    tokens = await netatmo.exchangeCode(code);
  } catch (err) {
    console.error('netatmo exchangeCode() failed', err?.message || err, err?.stack);
    return back('netatmo=error&reason=exchange');
  }

  const admin = adminClient();

  const { data: connection, error: upsertErr } = await admin
    .from('provider_connections')
    .upsert(
      {
        household_id: householdId,
        provider: 'netatmo',
        status: 'connected',
        account_email: null,
        connected_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,provider' },
    )
    .select('id')
    .single();
  if (upsertErr || !connection) {
    return back('netatmo=error&reason=save');
  }

  const { error: secretErr } = await admin.from('provider_connection_secrets').upsert(
    {
      connection_id: connection.id,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: new Date(tokens.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'connection_id' },
  );
  if (secretErr) {
    return back('netatmo=error&reason=save');
  }

  // Same "populate immediately, don't just wait for the next cron sync"
  // shape as /connect — errors here don't undo the connection itself
  // (auth succeeded), they just leave devices for the next sync to fill in.
  try {
    const devices = await netatmo.getDevices(tokens.accessToken);
    for (const d of devices) {
      const { error } = await admin
        .from('home_devices')
        .upsert(toHomeDeviceRow(householdId, d), { onConflict: 'household_id,provider,external_id' });
      if (error) throw error;
    }
    await markConnectionOk(admin, connection.id);
  } catch (err) {
    console.error('netatmo getDevices() after connect failed', toFriendlyError(err).message);
  }

  return back('netatmo=connected');
}
