// sync-home-devices — polls every connected household's provider account
// and writes normalized state into home_devices. A MELCloud Home account
// exposes its own device list via /context — there's no separate "add
// device" UI step, discovery IS the sync.
//
// Multi-household: unlike the mock phase (one household, auto-discovered),
// this now iterates every row in provider_connections for this provider —
// see supabase/migrations/20260913125400_provider_connections.sql. Each
// household's tokens live in provider_connection_secrets, readable only by
// the service role this function runs as.
//
// REAL PROVIDER NOTE: Deno can't directly import the Next.js app's
// providers/melcloud-home/index.js without a shared package, so the token
// refresh + /context-fetching + parsing logic below is a deliberate,
// hand-kept-in-sync port of that file's refreshAccessToken()/getDevices().
// The one thing NOT ported here is the Cognito login dance (PAR →
// authorize → credential POST) — that only ever runs once, from the
// Next.js connect route, and a household's password never needs to touch
// this function. If you change providers/melcloud-home/index.js's mode/
// fan/vane vocabulary or the /context shape handling, mirror the change
// here too.
//
// Called on a schedule by pg_cron via pg_net (same shape as
// sync-freebusy/cozy-daily-digest), authenticated with the shared
// MELCLOUD_FN_SECRET header (verify_jwt = false in config.toml).
//
// Env (supabase/functions/.env locally, `npx supabase secrets set` in prod):
//   MELCLOUD_FN_SECRET — shared secret, must match the melcloud_fn_secret Vault entry

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MELCLOUD_FN_SECRET = Deno.env.get('MELCLOUD_FN_SECRET')!;
const PROVIDER_NAME = 'melcloud_home';

const AUTH_BASE_URL = 'https://auth.melcloudhome.com';
const BASE_URL = 'https://mobile.bff.melcloudhome.com';
const OAUTH_CLIENT_ID = 'homemobile';
const USER_AGENT = 'MonitorAndControl.App.Mobile/52 CFNetwork/3860.400.51 Darwin/25.3.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// --- ported from providers/melcloud-home/index.js — keep in sync --------

const MODE_FROM_API: Record<string, string> = { Cool: 'cool', Heat: 'heat', Automatic: 'auto', Dry: 'dry', Fan: 'fan' };
const FAN_FROM_API: Record<string, string> = { Auto: 'auto', One: '1', Two: '2', Three: '3', Four: '4', Five: '5' };

function hvaneFromApi(value: string | undefined) {
  if (value === 'Left' || value === 'LeftCentre') return 'left';
  if (value === 'Right' || value === 'RightCentre') return 'right';
  return 'both';
}

function rssiToBucket(rssi: number | null | undefined) {
  if (rssi === null || rssi === undefined) return 'unknown';
  if (rssi >= -60) return 'good';
  if (rssi >= -75) return 'fair';
  return 'poor';
}

// deno-lint-ignore no-explicit-any
function temperatureRangeFor(mode: string, cap: any): [number, number] {
  const ranges: Record<string, [number | undefined, number | undefined]> = {
    heat: [cap.minTempHeat, cap.maxTempHeat],
    cool: [cap.minTempCoolDry, cap.maxTempCoolDry],
    dry: [cap.minTempCoolDry, cap.maxTempCoolDry],
    fan: [cap.minTempCoolDry, cap.maxTempCoolDry],
    auto: [cap.minTempAutomatic, cap.maxTempAutomatic],
  };
  const [min, max] = ranges[mode] || [16, 31];
  return [min ?? 16, max ?? 31];
}

// deno-lint-ignore no-explicit-any
function buildModeList(cap: any): string[] {
  const modes: string[] = [];
  if (cap.hasCoolOperationMode !== false) modes.push('cool');
  if (cap.hasHeatOperationMode !== false) modes.push('heat');
  if (cap.hasAutoOperationMode !== false) modes.push('auto');
  if (cap.hasDryOperationMode !== false) modes.push('dry');
  modes.push('fan');
  return modes;
}

// deno-lint-ignore no-explicit-any
function buildFanSpeedList(cap: any): string[] {
  const n = cap.numberOfFanSpeeds || 5;
  const speeds = cap.hasAutomaticFanSpeed !== false ? ['auto'] : [];
  for (let i = 1; i <= n; i++) speeds.push(String(i));
  return speeds;
}

// deno-lint-ignore no-explicit-any
function toHomeDevice(unit: any, roomName: string | null) {
  // deno-lint-ignore no-explicit-any
  const settings: Record<string, any> = {};
  for (const s of unit.settings || []) settings[s.name] = s.value;
  const cap = unit.capabilities || {};
  const mode = MODE_FROM_API[settings.OperationMode] || 'cool';
  const [minTemperature, maxTemperature] = temperatureRangeFor(mode, cap);
  const isInError = String(settings.IsInError).toLowerCase() === 'true';
  const errorCode = settings.ErrorCode || null;

  return {
    type: 'air_conditioner',
    name: unit.givenDisplayName || 'Klima',
    room: roomName,
    externalId: unit.id,
    state: {
      online: true,
      power: String(settings.Power).toLowerCase() === 'true',
      currentTemperature: settings.RoomTemperature != null ? parseFloat(settings.RoomTemperature) : null,
      targetTemperature: settings.SetTemperature != null ? parseFloat(settings.SetTemperature) : null,
      mode,
      fanSpeed: FAN_FROM_API[settings.SetFanSpeed] || 'auto',
      vaneHorizontal: hvaneFromApi(settings.VaneHorizontalDirection),
      wifiSignal: rssiToBucket(unit.rssi),
      outdoorTemperature: null,
      error: isInError ? errorCode || 'error' : null,
    },
    capabilities: {
      modes: buildModeList(cap),
      fanSpeeds: buildFanSpeedList(cap),
      hasHorizontalVane: cap.hasAirDirection !== false,
      hasVerticalVane: false,
      minTemperature,
      maxTemperature,
      halfDegreeIncrements: cap.hasHalfDegreeIncrements !== false,
    },
  };
}

class MelCloudAuthError extends Error {}
// MELCloud's own token/API endpoints occasionally 5xx (maintenance, rate
// limiting, a bad moment) — that's a transient hiccup, NOT the household's
// refresh token being invalid. Mirrors providers/melcloud-home/index.js's
// MelCloudServiceError, which the client-side command route already
// distinguishes; the edge function's "hand-kept-in-sync port" had drifted
// and was missing it, treating a transient 5xx as a hard auth rejection and
// forcing a full password reconnect roughly every couple of days.
class MelCloudServiceError extends Error {
  constructor(status: number) {
    super(`MELCloud service error: HTTP ${status}`);
  }
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(`${AUTH_BASE_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: OAUTH_CLIENT_ID }),
  });
  if (res.status >= 500) throw new MelCloudServiceError(res.status);
  if (res.status !== 200) throw new MelCloudAuthError('REFRESH_REJECTED');
  const data = await res.json();
  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

async function getDevices(accessToken: string) {
  const res = await fetch(`${BASE_URL}/context`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (res.status === 401) throw new MelCloudAuthError('TOKEN_EXPIRED');
  if (res.status >= 500) throw new MelCloudServiceError(res.status);
  if (!res.ok) throw new Error(`MELCloud API error: HTTP ${res.status}`);
  const context = await res.json();
  const buildings = [...(context?.buildings || []), ...(context?.guestBuildings || [])];
  const devices = [];
  // deno-lint-ignore no-explicit-any
  for (const building of buildings as any[]) {
    for (const unit of building.airToAirUnits || []) {
      devices.push(toHomeDevice(unit, building.name || null));
    }
  }
  return devices;
}

// --- sync loop ------------------------------------------------------------
//
// status: 'error' is what the frontend reads as "needs a full password
// reconnect" (needsReauth in AppShell.js) — reserved for a genuine auth
// rejection (MelCloudAuthError surviving a refresh-and-retry). Anything
// else (a transient MelCloudServiceError, a network blip, an unexpected
// response shape) only updates last_error and leaves status alone, so the
// next cron tick can just quietly retry. Same pattern as sync-netatmo-devices
// and sync-vaillant-devices.

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

  const markTransient = async (err: unknown) => {
    console.error('transient error for connection', connection.id, err);
    await supabase
      .from('provider_connections')
      .update({ last_error: String((err as Error)?.message || err), updated_at: new Date().toISOString() })
      .eq('id', connection.id);
  };
  const markAuthError = async () => {
    await supabase
      .from('provider_connections')
      .update({ status: 'error', last_error: 'refresh_rejected', updated_at: new Date().toISOString() })
      .eq('id', connection.id);
  };
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
      if (err instanceof MelCloudServiceError) return await markTransient(err);
      console.error('refresh failed for connection', connection.id, err);
      await markAuthError();
      return;
    }
  }

  let devices;
  try {
    devices = await getDevices(accessToken);
  } catch (err) {
    if (err instanceof MelCloudAuthError) {
      // Access token looked fresh by our stored expiry but MELCloud rejected
      // it anyway — refresh once and retry, same pattern as the command
      // route's TOKEN_EXPIRED handling, before concluding it's a real
      // reconnect-worthy failure.
      try {
        await refreshAndPersist();
        devices = await getDevices(accessToken);
      } catch (retryErr) {
        if (retryErr instanceof MelCloudServiceError) return await markTransient(retryErr);
        console.error('refresh-and-retry failed for connection', connection.id, retryErr);
        await markAuthError();
        return;
      }
    } else if (err instanceof MelCloudServiceError) {
      return await markTransient(err);
    } else {
      // Unexpected shape, network blip, etc. — log it, don't force a reconnect.
      return await markTransient(err);
    }
  }

  for (const d of devices) {
    const { error } = await supabase.from('home_devices').upsert(
      {
        household_id: connection.household_id,
        provider: PROVIDER_NAME,
        device_type: d.type,
        external_id: d.externalId,
        name: d.name,
        room: d.room,
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
  if (req.headers.get('x-sync-secret') !== MELCLOUD_FN_SECRET) {
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
  })().catch((err) => console.error('sync-home-devices batch failed', err));

  // Respond 202 immediately (pg_net times out at 3 s for the trigger path;
  // this job also sets a generous 25 s timeout on the caller side) and
  // finish syncing in the background — same pattern as sync-freebusy.
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return new Response(null, { status: 202 });
});
