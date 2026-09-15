// sync-netatmo-devices — polls every connected household's Netatmo Weather
// Station account and writes normalized readings into home_devices. Same
// pg_cron-triggered, service-role shape as sync-vaillant-devices/
// sync-shelly-devices (separate function per provider so one provider's
// incident can't take down another's sync — see sync-vaillant-devices's
// header comment for the fuller rationale).
//
// REAL PROVIDER NOTE: same "hand-kept-in-sync port" situation as
// sync-vaillant-devices — Deno can't import the Next.js app's
// providers/netatmo/index.js directly, so refreshAccessToken()/
// getDevices() are duplicated here. The one-time authorization-code
// exchange (netatmo-callback route) is NOT ported here — a household's
// Netatmo login never needs to touch this function, only the already-
// issued refresh token does.
//
// Called on a schedule by pg_cron via pg_net, authenticated with the
// shared NETATMO_FN_SECRET header (verify_jwt = false in config.toml).
//
// Env (supabase/functions/.env locally, `npx supabase secrets set` in prod):
//   NETATMO_FN_SECRET — shared secret, must match the netatmo_fn_secret Vault entry
//   NETATMO_CLIENT_ID / NETATMO_CLIENT_SECRET — same app-level OAuth
//     credentials as the Next.js app's env (see .env.example) — needed here
//     too because refreshing a token requires them, same as the initial
//     exchange did.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const NETATMO_FN_SECRET = Deno.env.get('NETATMO_FN_SECRET')!;
const CLIENT_ID = Deno.env.get('NETATMO_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('NETATMO_CLIENT_SECRET')!;
const PROVIDER_NAME = 'netatmo';

const TOKEN_URL = 'https://api.netatmo.com/oauth2/token';
const STATIONS_URL = 'https://api.netatmo.com/api/getstationsdata';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// --- ported from providers/netatmo/index.js — keep in sync --------------

class NetatmoAuthError extends Error {}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (res.status === 400 || res.status === 403) throw new NetatmoAuthError('REFRESH_REJECTED');
  if (!res.ok) throw new Error(`Netatmo token refresh HTTP ${res.status}`);
  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string,
    expiresAt: Date.now() + (data.expires_in || 10800) * 1000,
  };
}

// deno-lint-ignore no-explicit-any
function toIndoorDevice(station: any) {
  const dd = station.dashboard_data || {};
  return {
    type: 'netatmo_indoor',
    externalId: station._id,
    name: station.module_name || station.station_name || 'Notranja postaja',
    state: {
      online: !!station.reachable,
      temperature: dd.Temperature ?? null,
      humidity: dd.Humidity ?? null,
      co2: dd.CO2 ?? null,
      noise: dd.Noise ?? null,
      pressure: dd.Pressure ?? null,
      measuredAt: dd.time_utc ? dd.time_utc * 1000 : null,
      error: null,
    },
    capabilities: {},
  };
}

// deno-lint-ignore no-explicit-any
function toOutdoorDevice(module: any) {
  const dd = module.dashboard_data || {};
  return {
    type: 'netatmo_outdoor',
    externalId: module._id,
    name: module.module_name || 'Zunanja enota',
    state: {
      online: !!module.reachable,
      temperature: dd.Temperature ?? null,
      humidity: dd.Humidity ?? null,
      batteryPercent: module.battery_percent ?? null,
      measuredAt: dd.time_utc ? dd.time_utc * 1000 : null,
      error: null,
    },
    capabilities: {},
  };
}

async function getDevices(accessToken: string) {
  const res = await fetch(STATIONS_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401 || res.status === 403) throw new NetatmoAuthError('TOKEN_EXPIRED');
  if (!res.ok) throw new Error(`Netatmo getstationsdata HTTP ${res.status}`);
  const data = await res.json();
  // deno-lint-ignore no-explicit-any
  const stations = (data?.body?.devices || []) as any[];
  const devices = [];
  for (const station of stations) {
    if (station.type === 'NAMain') devices.push(toIndoorDevice(station));
    for (const module of station.modules || []) {
      if (module.type === 'NAModule1') devices.push(toOutdoorDevice(module));
    }
  }
  return devices;
}

// --- sync loop ------------------------------------------------------------

async function syncConnection(connection: { id: string; household_id: string }) {
  const { data: secret, error: secretErr } = await supabase
    .from('provider_connection_secrets')
    .select('access_token, refresh_token, token_expires_at')
    .eq('connection_id', connection.id)
    .maybeSingle();
  if (secretErr || !secret) {
    console.error('no secret for connection', connection.id, secretErr);
    return;
  }

  let accessToken = secret.access_token as string;
  let currentRefreshToken = secret.refresh_token as string;

  // Shared so both the proactive (expiry-based) refresh below and the
  // reactive (Netatmo said 401/403 despite our stored expiry) retry further
  // down go through the same persist step — see its call sites.
  async function refreshAndPersist() {
    const refreshed = await refreshAccessToken(currentRefreshToken);
    accessToken = refreshed.accessToken;
    currentRefreshToken = refreshed.refreshToken;
    await supabase
      .from('provider_connection_secrets')
      .update({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        token_expires_at: new Date(refreshed.expiresAt).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('connection_id', connection.id);
  }

  const expiresAt = new Date(secret.token_expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() <= 60_000) {
    try {
      await refreshAndPersist();
    } catch (err) {
      console.error('refresh failed for connection', connection.id, err);
      await supabase
        .from('provider_connections')
        .update({ status: 'error', last_error: 'refresh_rejected', updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      return;
    }
  }

  // Real reconnect (status: 'error', which the app shows as "needs
  // reconnect" and only clears via a fresh OAuth login) is reserved for
  // genuine auth failures — a rejected refresh token, above, or Netatmo
  // outright rejecting the access token below even right after a refresh.
  // A transient getDevices() failure (rate limit, momentary 5xx, network
  // blip) must NOT flip status to 'error': the stored tokens are still
  // fine, and forcing the household through the OAuth flow for a hiccup
  // that the next cron tick (10 min later) would likely clear on its own
  // is exactly the "why do I keep having to reconnect?" complaint this
  // fixes. We still record last_error for visibility, just without
  // touching status.
  let devices;
  try {
    devices = await getDevices(accessToken);
  } catch (err) {
    if (err instanceof NetatmoAuthError) {
      // Our stored expiry said this token was still good, but Netatmo
      // disagreed (clock skew, or a token revoked/rotated out-of-band by a
      // concurrent refresh) — refresh once and retry before giving up,
      // same pattern as the command route's post-command TOKEN_EXPIRED
      // handling (app/api/home-devices/[id]/command/route.js).
      try {
        await refreshAndPersist();
        devices = await getDevices(accessToken);
      } catch (retryErr) {
        console.error('retry after TOKEN_EXPIRED failed for connection', connection.id, retryErr);
        await supabase
          .from('provider_connections')
          .update({ status: 'error', last_error: 'refresh_rejected', updated_at: new Date().toISOString() })
          .eq('id', connection.id);
        return;
      }
    } else {
      console.error('getDevices failed for connection (transient, not forcing reconnect)', connection.id, err);
      await supabase
        .from('provider_connections')
        .update({ last_error: String((err as Error)?.message || err), updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      return;
    }
  }

  for (const d of devices) {
    // room deliberately omitted — same fix as sync-shelly-devices/
    // sync-vaillant-devices (see sync-shelly-devices's comment): Netatmo's
    // Weather Station API has no room concept either, and the
    // merge-duplicates upsert only touches columns present in the payload.
    const { error } = await supabase.from('home_devices').upsert(
      {
        household_id: connection.household_id,
        provider: PROVIDER_NAME,
        device_type: d.type,
        external_id: d.externalId,
        name: d.name,
        state: d.state,
        capabilities: d.capabilities,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'household_id,provider,external_id' },
    );
    if (error) console.error('home device upsert failed for', d.externalId, error);
  }

  await supabase
    .from('provider_connections')
    .update({ status: 'connected', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', connection.id);
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== NETATMO_FN_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const work = (async () => {
    const { data: connections, error } = await supabase
      .from('provider_connections')
      .select('id, household_id')
      .eq('provider', PROVIDER_NAME);
    if (error) {
      console.error('failed to list provider_connections', error);
      return;
    }
    for (const connection of connections || []) {
      await syncConnection(connection);
    }
  })().catch((err) => console.error('sync-netatmo-devices batch failed', err));

  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return new Response(null, { status: 202 });
});
