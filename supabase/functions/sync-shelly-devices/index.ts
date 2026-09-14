// sync-shelly-devices — polls every connected household's fixed Shelly
// device roster and writes normalized state into home_devices. Unlike
// sync-home-devices/sync-vaillant-devices, there's no discovery step:
// each household's device list (id/name/type) is entered once at connect
// time and stored on provider_connections.config — see providers/shelly/
// index.js's header comment for why Shelly has no "list my devices" API.
//
// REAL PROVIDER NOTE: Deno can't directly import the Next.js app's
// providers/shelly/index.js without a shared package, so the status-
// fetching + parsing logic below is a deliberate, hand-kept-in-sync port
// of that file's getDevices(). If you change providers/shelly/index.js's
// endpoints or field mapping, mirror the change here too.
//
// Separate function (not folded into sync-home-devices/sync-vaillant-
// devices) so an incident in one provider's sync can't take down another's
// — same rationale as sync-vaillant-devices's header comment.
//
// Called on a schedule by pg_cron via pg_net, authenticated with the
// shared SHELLY_FN_SECRET header (verify_jwt = false in config.toml).
//
// Env (supabase/functions/.env locally, `npx supabase secrets set` in prod):
//   SHELLY_FN_SECRET — shared secret, must match the shelly_fn_secret Vault entry

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SHELLY_FN_SECRET = Deno.env.get('SHELLY_FN_SECRET')!;
const PROVIDER_NAME = 'shelly';
const REQUEST_SPACING_MS = 1100; // stay under Shelly Cloud's 1 req/s account-wide limit

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function baseUrl(server: string) {
  return server.startsWith('http') ? server : `https://${server}`;
}

// deno-lint-ignore no-explicit-any
async function postForm(server: string, path: string, authKey: string, params: Record<string, any>) {
  const res = await fetch(`${baseUrl(server)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, auth_key: authKey }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || data?.isok === false) {
    throw new Error(data?.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}`);
  }
  return data;
}

// deno-lint-ignore no-explicit-any
function findComponent(deviceStatus: any, prefix: string) {
  if (deviceStatus?.[`${prefix}:0`]) return deviceStatus[`${prefix}:0`];
  // deno-lint-ignore no-explicit-any
  const plural = ({ switch: 'relays', cover: 'rollers', light: 'lights' } as any)[prefix];
  if (Array.isArray(deviceStatus?.[plural]) && deviceStatus[plural][0]) return deviceStatus[plural][0];
  return null;
}

// deno-lint-ignore no-explicit-any
function toDevice(cfg: any, deviceStatus: any, online: boolean) {
  if (cfg.type === 'cover') {
    const comp = findComponent(deviceStatus, 'cover');
    return {
      type: 'shelly_cover',
      externalId: cfg.id,
      name: cfg.name,
      room: null,
      state: {
        online,
        moving: comp?.state === 'opening' || comp?.state === 'closing',
        position: comp?.current_pos ?? comp?.current_position ?? null,
        error: null,
      },
      capabilities: {},
    };
  }
  if (cfg.type === 'dimmer') {
    const comp = findComponent(deviceStatus, 'light') || findComponent(deviceStatus, 'switch');
    return {
      type: 'shelly_dimmer',
      externalId: cfg.id,
      name: cfg.name,
      room: null,
      state: {
        online,
        on: comp?.output ?? comp?.ison ?? null,
        brightness: comp?.brightness ?? comp?.gain ?? null,
        error: null,
      },
      capabilities: {},
    };
  }
  const comp = findComponent(deviceStatus, 'switch');
  return {
    type: 'shelly_switch',
    externalId: cfg.id,
    name: cfg.name,
    room: null,
    state: { online, on: comp?.output ?? comp?.ison ?? null, error: null },
    capabilities: {},
  };
}

// deno-lint-ignore no-explicit-any
async function getDevices(server: string, authKey: string, devicesConfig: any[]) {
  const devices = [];
  for (const cfg of devicesConfig) {
    let data;
    try {
      data = await postForm(server, '/device/status', authKey, { id: cfg.id });
    } catch (err) {
      devices.push({
        type: `shelly_${cfg.type}`,
        externalId: cfg.id,
        name: cfg.name,
        room: null,
        state: { online: false, error: String((err as Error)?.message || err) },
        capabilities: {},
      });
      await sleep(REQUEST_SPACING_MS);
      continue;
    }
    const online = data?.data?.online ?? false;
    const deviceStatus = data?.data?.device_status || {};
    devices.push(toDevice(cfg, deviceStatus, online));
    await sleep(REQUEST_SPACING_MS);
  }
  return devices;
}

// deno-lint-ignore no-explicit-any
async function syncConnection(connection: { id: string; household_id: string; config: any }) {
  const server = connection.config?.server;
  const devicesConfig = connection.config?.devices;
  if (!server || !Array.isArray(devicesConfig) || !devicesConfig.length) {
    console.error('sync-shelly-devices: connection missing config', connection.id);
    return;
  }

  const { data: secret, error: secretErr } = await supabase
    .from('provider_connection_secrets')
    .select('access_token')
    .eq('connection_id', connection.id)
    .maybeSingle();
  if (secretErr || !secret) {
    console.error('no secret for connection', connection.id, secretErr);
    return;
  }

  // access_token is the packed {server, authKey} JSON connect() produced —
  // server also lives on provider_connections.config (read above) so we
  // don't strictly need to unpack it, but authKey does.
  let authKey: string;
  try {
    authKey = JSON.parse(secret.access_token).authKey;
  } catch {
    console.error('sync-shelly-devices: unparseable access_token for connection', connection.id);
    return;
  }

  let devices;
  try {
    devices = await getDevices(server, authKey, devicesConfig);
  } catch (err) {
    console.error('getDevices failed for connection', connection.id, err);
    await supabase
      .from('provider_connections')
      .update({ status: 'error', last_error: String((err as Error)?.message || err), updated_at: new Date().toISOString() })
      .eq('id', connection.id);
    return;
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
  if (req.headers.get('x-sync-secret') !== SHELLY_FN_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const work = (async () => {
    const { data: connections, error } = await supabase
      .from('provider_connections')
      .select('id, household_id, config')
      .eq('provider', PROVIDER_NAME);
    if (error) {
      console.error('failed to list provider_connections', error);
      return;
    }
    for (const connection of connections || []) {
      await syncConnection(connection);
    }
  })().catch((err) => console.error('sync-shelly-devices batch failed', err));

  // Respond 202 immediately (pg_net times out at 3 s for the trigger path)
  // and finish syncing in the background — same pattern as sync-freebusy /
  // sync-home-devices / sync-vaillant-devices.
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return new Response(null, { status: 202 });
});
