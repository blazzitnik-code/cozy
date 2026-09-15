// sync-vaillant-devices — polls every connected household's Vaillant
// myVAILLANT account and writes normalized state into home_devices. A
// system's own zones + domestic-hot-water tanks are discovered from its
// /systems/{id}/tli response — there's no separate "add device" UI step,
// discovery IS the sync (same shape as sync-home-devices for MELCloud).
//
// Multi-household: iterates every row in provider_connections for
// provider='vaillant' — see
// supabase/migrations/20260913125400_provider_connections.sql. Each
// household's tokens live in provider_connection_secrets, readable only by
// the service role this function runs as.
//
// REAL PROVIDER NOTE: Deno can't directly import the Next.js app's
// providers/vaillant/index.js without a shared package, so the token
// refresh + system-fetching + parsing logic below is a deliberate,
// hand-kept-in-sync port of that file's refreshAccessToken()/getDevices().
// The one thing NOT ported here is the Keycloak login dance (PKCE +
// ALTCHA) — that only ever runs once, from the Next.js connect route, and
// a household's password never needs to touch this function. If you
// change providers/vaillant/index.js's endpoints or field mapping, mirror
// the change here too.
//
// Separate function (not folded into sync-home-devices) so a Vaillant-side
// incident can't take down the MELCloud sync or vice versa, and so this
// function's own CPU budget is never shared with another provider's work —
// see the sync-freebusy fan-out fix (2026-09-13) for why that budget
// matters: it's per-invocation, and Promise.all/looped synchronous work
// across many rows in ONE invocation is what blew sync-freebusy's budget
// there. This function's per-household work here is a handful of small
// JSON GETs (no ICAL parsing), so it's much lighter than freebusy ever
// was — but if it ever grows heavier (many households, more systems), fan
// it out the same one-call-per-household way `trigger_freebusy_sync()`
// does, rather than waiting for it to actually crash first.
//
// Called on a schedule by pg_cron via pg_net, authenticated with the
// shared VAILLANT_FN_SECRET header (verify_jwt = false in config.toml).
//
// Env (supabase/functions/.env locally, `npx supabase secrets set` in prod):
//   VAILLANT_FN_SECRET — shared secret, must match the vaillant_fn_secret Vault entry

import { createClient } from 'jsr:@supabase/supabase-js@2';

const VAILLANT_FN_SECRET = Deno.env.get('VAILLANT_FN_SECRET')!;
const PROVIDER_NAME = 'vaillant';

const AUTH_BASE_URL = 'https://identity.vaillant-group.com/auth/realms';
const TOKEN_URL = (realm: string) => `${AUTH_BASE_URL}/${realm}/protocol/openid-connect/token`;
const API_BASE = 'https://api.vaillant-group.com/service-connected-control/end-user-app-api/v1';
const CLIENT_ID = 'myvaillant';
// Single household, single known brand/country — see providers/vaillant/index.js's
// header comment for why this is hardcoded rather than a Settings field.
const REALM = 'vaillant-slovenia-b2c';
// Same WAF-avoidance rationale as providers/vaillant/index.js's
// APP_USER_AGENT — keep in sync with that file.
const APP_USER_AGENT = 'okhttp/4.9.2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// --- ported from providers/vaillant/index.js — keep in sync -------------

class VaillantAuthError extends Error {}

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json, text/plain, */*',
    'User-Agent': APP_USER_AGENT,
    'x-app-identifier': 'VAILLANT',
    'x-idm-identifier': 'KEYCLOAK',
    'x-client-locale': 'en-GB',
    'Accept-Language': 'en-GB',
    'ocp-apim-subscription-key': '1e0a2f3511fb4c5bbb1c7f9fedd20b1c',
  };
}

// deno-lint-ignore no-explicit-any
async function apiRequest(accessToken: string, method: string, url: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: { ...authHeaders(accessToken), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new VaillantAuthError('TOKEN_EXPIRED');
  if (!res.ok) throw new Error(`Vaillant API error: HTTP ${res.status}`);
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(TOKEN_URL(REALM), {
    method: 'POST',
    headers: { 'User-Agent': APP_USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT_ID }),
  });
  if (res.status !== 200) throw new VaillantAuthError('REFRESH_REJECTED');
  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

// deno-lint-ignore no-explicit-any
function toZoneDevice(systemId: string, zone: any) {
  const heating = zone.heating || {};
  return {
    type: 'heating_zone',
    externalId: `${systemId}:zone:${zone.index}`,
    name: zone.general?.name || `Cona ${zone.index + 1}`,
    state: {
      online: true,
      mode: (heating.operationModeHeating || 'MANUAL').toLowerCase(),
      currentTemperature: zone.currentRoomTemperature ?? null,
      targetTemperature: zone.desiredRoomTemperatureSetpoint ?? null,
      manualSetpoint: heating.manualModeSetpointHeating ?? null,
      quickVetoActive: zone.currentSpecialFunction === 'QUICK_VETO',
      quickVetoEndsAt: zone.quickVetoEndDateTime ?? null,
      holidayActive: zone.currentSpecialFunction === 'HOLIDAY',
      error: null,
    },
    capabilities: { modes: ['manual', 'time_controlled', 'off'], minTemperature: 5, maxTemperature: 30 },
  };
}

// deno-lint-ignore no-explicit-any
function toDhwDevice(systemId: string, dhw: any) {
  return {
    type: 'domestic_hot_water',
    externalId: `${systemId}:dhw:${dhw.index}`,
    name: 'Sanitarna voda',
    state: {
      online: true,
      mode: (dhw.operationModeDhw || 'MANUAL').toLowerCase(),
      currentTemperature: dhw.currentDhwTemperature ?? null,
      targetTemperature: dhw.tappingSetpoint ?? null,
      boostActive: dhw.currentSpecialFunction === 'CYLINDER_BOOST',
      error: null,
    },
    capabilities: {
      modes: ['manual', 'time_controlled', 'off'],
      minTemperature: dhw.minSetpoint ?? 35,
      maxTemperature: dhw.maxSetpoint ?? 65,
    },
  };
}

// The /systems/{id}/tli response splits each zone/dhw's fields across
// THREE separate top-level sections (configuration, properties, state),
// each an array keyed by a shared `index` — not a flat system.zones[]/
// system.domesticHotWater[]. Mirrors myPyllant's own merge_object() helper
// and providers/vaillant/index.js's mergeByIndex() — keep in sync.
// deno-lint-ignore no-explicit-any
function mergeByIndex(...sections: (any[] | undefined)[]) {
  const byIndex = new Map<number, any>();
  for (const section of sections) {
    for (const item of section || []) {
      byIndex.set(item.index, { ...(byIndex.get(item.index) || {}), ...item });
    }
  }
  return [...byIndex.values()];
}

async function getDevices(accessToken: string) {
  const homes = await apiRequest(accessToken, 'GET', `${API_BASE}/homes`);
  const devices = [];
  // deno-lint-ignore no-explicit-any
  for (const home of (homes || []) as any[]) {
    const systemId = home.systemId;
    if (!systemId) continue;
    const meta = await apiRequest(accessToken, 'GET', `${API_BASE}/systems/${systemId}/meta-info/control-identifier`);
    const controlIdentifier = meta?.controlIdentifier || 'tli';
    if (controlIdentifier !== 'tli') {
      console.error('sync-vaillant-devices: skipping unsupported controller', systemId, controlIdentifier);
      continue;
    }
    const system = await apiRequest(accessToken, 'GET', `${API_BASE}/systems/${systemId}/tli`);
    const zones = mergeByIndex(system?.configuration?.zones, system?.properties?.zones, system?.state?.zones);
    const dhwList = mergeByIndex(system?.configuration?.dhw, system?.properties?.dhw, system?.state?.dhw);
    for (const zone of zones) devices.push(toZoneDevice(systemId, zone));
    for (const dhw of dhwList) devices.push(toDhwDevice(systemId, dhw));
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
  const expiresAt = new Date(secret.token_expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() <= 60_000) {
    try {
      const refreshed = await refreshAccessToken(secret.refresh_token);
      accessToken = refreshed.accessToken;
      await supabase
        .from('provider_connection_secrets')
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshed.refreshToken,
          token_expires_at: new Date(refreshed.expiresAt).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('connection_id', connection.id);
    } catch (err) {
      console.error('refresh failed for connection', connection.id, err);
      await supabase
        .from('provider_connections')
        .update({ status: 'error', last_error: 'refresh_rejected', updated_at: new Date().toISOString() })
        .eq('id', connection.id);
      return;
    }
  }

  let devices;
  try {
    devices = await getDevices(accessToken);
  } catch (err) {
    console.error('getDevices failed for connection', connection.id, err);
    await supabase
      .from('provider_connections')
      .update({ status: 'error', last_error: String((err as Error)?.message || err), updated_at: new Date().toISOString() })
      .eq('id', connection.id);
    return;
  }

  for (const d of devices) {
    // room deliberately omitted — same fix as sync-shelly-devices (see its
    // comment): this provider never reports a room either, and the
    // merge-duplicates upsert only touches columns present in the payload,
    // so leaving room out means a manually-assigned room is never reverted.
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
  if (req.headers.get('x-sync-secret') !== VAILLANT_FN_SECRET) {
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
  })().catch((err) => console.error('sync-vaillant-devices batch failed', err));

  // Respond 202 immediately (pg_net times out at 3 s for the trigger path)
  // and finish syncing in the background — same pattern as sync-freebusy /
  // sync-home-devices.
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return new Response(null, { status: 202 });
});
