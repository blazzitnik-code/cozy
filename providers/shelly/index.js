// providers/shelly/index.js
//
// Shelly Cloud Control API — third home-device provider, alongside
// MELCloud Home and Vaillant. Fundamentally different auth shape from
// both of those:
//
//   - No interactive login. The household generates a long-lived
//     "Authorization cloud key" themselves in the Shelly Cloud app
//     (Settings > User settings > Access and Permissions > Authorization
//     cloud key > Get key) and pastes it + their account's server host
//     (e.g. shelly-6-eu.shelly.cloud, also shown there) into our connect
//     form — there's nothing here to submit a password to. The key only
//     changes if the household changes their Shelly account password, so
//     there's no refresh flow either.
//   - No account-wide "list my devices" endpoint. Each device's id/name/
//     type is entered once by the household at connect time (see
//     app/api/home-devices/connect/route.js's shelly branch) and carried
//     forward as the non-secret provider_connections.config — callers
//     (the connect route, sync-shelly-devices) pass that device list into
//     getDevices() explicitly since there's nothing to discover it from.
//
// Every exported function here takes a single opaque `accessToken` string
// exactly like the other two providers do, to keep app/api/home-devices/
// [id]/command/route.js's generic dispatcher working unchanged — but since
// Shelly's API needs BOTH the auth_key AND which server it lives on (a
// per-account hostname, not a fixed base URL), that string is actually
// `packToken()`-ed JSON of `{ server, authKey }` rather than a bearer
// token. connect() below is what produces it; lib/shelly-server.js's
// getValidAccessToken() just returns it straight from the DB (there is
// nothing to refresh), so nothing outside this file needs to know it's
// not a "real" token.
//
// Uses the v1 "Communication" REST API (shelly-api-docs.shelly.cloud/
// cloud-control-api/communication/) rather than the newer v2 RPC-shaped
// API — despite Shelly's own docs marking v1 "deprecated", it's the one
// with fully documented request shapes for everything we need (roller
// position, dimmer brightness), and its /device/status response already
// reports Gen1 and Gen2+ devices through the same RPC-component-style
// keys (e.g. "switch:0", "cover:0"), so one code path covers both
// generations. Rate limit is 1 request/second per account (undocumented
// whether that's per-key or per-server) — getDevices() below spaces its
// calls out to stay under it.
//
// NOT YET LIVE-VERIFIED against B's real account as of 2026-09-14 (see
// the Vaillant provider's own history for why that note matters). The
// device_status field paths below (switch:0.output, cover:0.state/
// current_pos, light:0.output/brightness) are read from Shelly's official
// docs plus its Gen2 RPC component reference, not observed directly from
// a live response for these exact 8 devices. If the first real connect
// shows devices as offline/wrong state, or getDevices() throws, dump a
// raw /device/status response for one device of each type here first —
// don't guess a second time.

export class ShellyAuthError extends Error {}
export class ShellyApiError extends Error {}

const REQUEST_SPACING_MS = 1100; // stay under the 1 req/s account-wide limit

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function packToken(server, authKey) {
  return JSON.stringify({ server, authKey });
}

function unpackToken(accessToken) {
  return JSON.parse(accessToken);
}

function baseUrl(server) {
  // The household pastes the host shown in the app (e.g.
  // "shelly-6-eu.shelly.cloud"); accept it with or without a scheme.
  return server.startsWith('http') ? server : `https://${server}`;
}

async function postForm(server, path, authKey, params) {
  const res = await fetch(`${baseUrl(server)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, auth_key: authKey }),
  });
  if (res.status === 401 || res.status === 403) throw new ShellyAuthError('INVALID_KEY');
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ShellyApiError(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok || data?.isok === false) {
    throw new ShellyApiError(data?.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}`);
  }
  return data;
}

/**
 * connect(authKey, server, devices) — no real "login": just proves the key
 * + server actually work by checking one configured device's status, so a
 * typo'd key or server fails loudly at connect time instead of silently at
 * the next cron sync. Returns the shape app/api/home-devices/connect/
 * route.js expects to persist: accessToken is the packed {server,authKey}
 * (see header comment), config is the non-secret device roster to store
 * on provider_connections.config.
 */
export async function connect(authKey, server, devices) {
  if (!devices.length) throw new ShellyApiError('No devices configured');
  await postForm(server, '/device/status', authKey, { id: devices[0].id });
  return {
    accessToken: packToken(server, authKey),
    refreshToken: null,
    expiresAt: null,
    config: { server, devices: devices.map((d) => ({ id: d.id, name: d.name, type: d.type })) },
  };
}

// --- status parsing ---------------------------------------------------

function findComponent(deviceStatus, prefix) {
  // Gen2+ RPC-style keys ("switch:0", "cover:0", "light:0") — pick the
  // first channel (":0") since every one of B's devices is single-channel.
  if (deviceStatus?.[`${prefix}:0`]) return deviceStatus[`${prefix}:0`];
  // Very old Gen1 firmware fallback: plain array under the plural name.
  const plural = { switch: 'relays', cover: 'rollers', light: 'lights' }[prefix];
  if (Array.isArray(deviceStatus?.[plural]) && deviceStatus[plural][0]) return deviceStatus[plural][0];
  return null;
}

function toSwitchDevice(cfg, deviceStatus, online) {
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

function toDimmerDevice(cfg, deviceStatus, online) {
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

function toCoverDevice(cfg, deviceStatus, online) {
  const comp = findComponent(deviceStatus, 'cover');
  return {
    type: 'shelly_cover',
    externalId: cfg.id,
    name: cfg.name,
    room: null,
    state: {
      online,
      // Normalized to our own vocabulary regardless of which spelling the
      // API used ("open"/"closed"/"stopped"/"opening"/"closing" for
      // Gen2-style `state`, vs a bare "close"/"open" for Gen1 `rollers`).
      moving: comp?.state === 'opening' || comp?.state === 'closing',
      position: comp?.current_pos ?? comp?.current_position ?? null,
      error: null,
    },
    capabilities: {},
  };
}

function toDevice(cfg, deviceStatus, online) {
  if (cfg.type === 'cover') return toCoverDevice(cfg, deviceStatus, online);
  if (cfg.type === 'dimmer') return toDimmerDevice(cfg, deviceStatus, online);
  return toSwitchDevice(cfg, deviceStatus, online);
}

/**
 * getDevices(accessToken, devicesConfig) — polls every device in
 * devicesConfig (no discovery, see header) and maps each to our
 * home_devices shape. Sequential with spacing to respect the account-wide
 * 1 req/s limit — fine for a household's handful of devices on a 10-min
 * cron, would need batching (the v2 API's up-to-10-ids-per-call
 * /v2/devices/api/get) if this ever needs to scale past a dozen or so.
 */
export async function getDevices(accessToken, devicesConfig) {
  const { server, authKey } = unpackToken(accessToken);
  const devices = [];
  for (const cfg of devicesConfig) {
    let data;
    try {
      data = await postForm(server, '/device/status', authKey, { id: cfg.id });
    } catch (err) {
      // One unreachable device (powered off, Wi-Fi down) shouldn't sink
      // the whole household's sync — report it offline instead.
      devices.push({
        type: `shelly_${cfg.type}`,
        externalId: cfg.id,
        name: cfg.name,
        room: null,
        state: { online: false, error: String(err?.message || err) },
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

/**
 * getDevice(accessToken, externalId, deviceType) — single-device refresh
 * used by the command route right after a control call. deviceType is
 * home_devices.device_type ('shelly_switch'/'shelly_dimmer'/'shelly_cover')
 * since, unlike MELCloud/Vaillant, a bare externalId doesn't tell us which
 * shape to parse the status into — see the command route's shelly branch.
 */
export async function getDevice(accessToken, externalId, deviceType) {
  const { server, authKey } = unpackToken(accessToken);
  const data = await postForm(server, '/device/status', authKey, { id: externalId });
  const online = data?.data?.online ?? false;
  const deviceStatus = data?.data?.device_status || {};
  const type = String(deviceType || '').replace(/^shelly_/, '');
  return toDevice({ id: externalId, name: '', type }, deviceStatus, online);
}

// --- control ------------------------------------------------------------

export async function setSwitch(accessToken, externalId, on) {
  const { server, authKey } = unpackToken(accessToken);
  await postForm(server, '/device/relay/control', authKey, { id: externalId, channel: 0, turn: on ? 'on' : 'off' });
}

export async function setDimmer(accessToken, externalId, { on, brightness }) {
  const { server, authKey } = unpackToken(accessToken);
  const params = { id: externalId, channel: 0 };
  if (on !== undefined) params.turn = on ? 'on' : 'off';
  if (brightness !== undefined) params.brightness = brightness;
  await postForm(server, '/device/light/control', authKey, params);
}

export async function setCoverAction(accessToken, externalId, direction) {
  // direction: 'open' | 'close' | 'stop'
  const { server, authKey } = unpackToken(accessToken);
  await postForm(server, '/device/relay/roller/control', authKey, { id: externalId, direction });
}

export async function setCoverPosition(accessToken, externalId, pos) {
  const { server, authKey } = unpackToken(accessToken);
  await postForm(server, '/device/relay/roller/control', authKey, { id: externalId, pos });
}
