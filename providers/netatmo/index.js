// providers/netatmo/index.js
//
// Netatmo Weather Station provider — the first Naprave provider that's a
// pure sensor (no control, only readings: indoor temperature/humidity/CO2/
// noise/pressure, outdoor temperature/humidity/battery), and the first
// that uses Netatmo's own third-party OAuth app registration (unlike
// MELCloud Home/Vaillant, which have none — see those providers' header
// comments — Netatmo's is a real, documented, self-service Connect API:
// https://dev.netatmo.com/apidocumentation/weather).
//
// Auth is a standard OAuth2 authorization-code flow — no PKCE, no ALTCHA/
// WAF dance like Vaillant. NETATMO_CLIENT_ID/NETATMO_CLIENT_SECRET are
// app-level (shared across every household), unlike the per-household
// tokens in provider_connection_secrets, so they live in Next.js's own
// server env (see .env.example) rather than that table.
//
// Redirect URI is fixed and must match EXACTLY what's registered in the
// Netatmo app (dev.netatmo.com/apps) — see NETATMO_REDIRECT_URI below.

const CLIENT_ID = process.env.NETATMO_CLIENT_ID;
const CLIENT_SECRET = process.env.NETATMO_CLIENT_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://zmrzko.vercel.app';

export const NETATMO_REDIRECT_URI = `${SITE_URL}/api/home-devices/netatmo-callback`;

const AUTHORIZE_URL = 'https://api.netatmo.com/oauth2/authorize';
const TOKEN_URL = 'https://api.netatmo.com/oauth2/token';
const STATIONS_URL = 'https://api.netatmo.com/api/getstationsdata';
const SCOPE = 'read_station';

export class NetatmoAuthError extends Error {}
export class NetatmoServiceError extends Error {
  constructor(status) {
    super(`Netatmo service unavailable (HTTP ${status})`);
    this.status = status;
  }
}

export function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: NETATMO_REDIRECT_URI,
    scope: SCOPE,
    state,
    response_type: 'code',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  if (res.status === 400 || res.status === 403) throw new NetatmoAuthError('TOKEN_REJECTED');
  if (!res.ok) throw new NetatmoServiceError(res.status);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 10800) * 1000,
  };
}

export async function exchangeCode(code) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: NETATMO_REDIRECT_URI, scope: SCOPE });
}

export async function refreshAccessToken(refreshToken) {
  try {
    return await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  } catch (err) {
    if (err instanceof NetatmoAuthError) throw new NetatmoAuthError('REFRESH_REJECTED');
    throw err;
  }
}

// One indoor "main" module (NAMain) per station plus its attached outdoor
// module (NAModule1) — B's setup is the standard bundle, one of each.
// Other module types (rain gauge NAModule3, wind gauge NAModule2,
// additional indoor NAModule4) are skipped for now rather than mapped to a
// wrong shape; add them here if a household ever has one.
function toIndoorDevice(station) {
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

function toOutdoorDevice(module) {
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

export async function getDevices(accessToken) {
  const res = await fetch(STATIONS_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (res.status === 401 || res.status === 403) throw new NetatmoAuthError('TOKEN_EXPIRED');
  if (!res.ok) throw new NetatmoServiceError(res.status);
  const data = await res.json();
  const stations = data?.body?.devices || [];
  const devices = [];
  for (const station of stations) {
    if (station.type === 'NAMain') devices.push(toIndoorDevice(station));
    for (const module of station.modules || []) {
      if (module.type === 'NAModule1') devices.push(toOutdoorDevice(module));
    }
  }
  return devices;
}

// Single-device fetch for the command route's post-command refresh (see
// app/api/home-devices/[id]/command/route.js — every provider must export
// this). getstationsdata has no filter by module id (only by station/main
// id), and an outdoor module's externalId is its OWN id, not its parent
// station's — so this just re-fetches everything and picks the matching
// row out, same as the indoor+outdoor pair always coming from one call.
// Negligible extra cost for the single-station household this is built for.
export async function getDevice(accessToken, externalId) {
  const devices = await getDevices(accessToken);
  return devices.find((d) => d.externalId === externalId) || null;
}
