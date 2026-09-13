// providers/melcloud-home/index.js
//
// Real MELCloud Home provider — OAuth 2.0 Authorization Code + PKCE via
// IdentityServer (auth.melcloudhome.com), federated to AWS Cognito for
// credential submission, then the mobile BFF (mobile.bff.melcloudhome.com)
// for device state and control.
//
// MELCloud Home has no third-party OAuth app registration — there is no
// redirect-based "Connect" popup an app like this can use. The mobile app
// itself submits the user's email+password straight to Cognito's hosted
// login form from inside its own webview, so that is what login() does
// here too: it takes the household's email+password once, drives the same
// PAR → authorize → Cognito-login → callback → token-exchange dance the
// mobile app does, and returns the resulting tokens. The password itself
// is never returned or persisted by this module — callers must not store
// it either.
//
// Endpoints, the client_id, scopes and the Cognito login form's field
// names below are load-bearing and were read directly from the reference
// implementation this integration is required to reuse rather than invent
// (github.com/andrew-blake/melcloudhome, api/auth.py + api/client.py +
// api/client_ata.py + api/const_shared.py + api/const_ata.py). Do not
// "clean up" any of those constants without checking that project's
// current source again — MELCloud can and does change this undocumented
// API without notice.

import crypto from 'node:crypto';

const BASE_URL = 'https://mobile.bff.melcloudhome.com';
const AUTH_BASE_URL = 'https://auth.melcloudhome.com';
const OAUTH_CLIENT_ID = 'homemobile';
const OAUTH_REDIRECT_URI = 'melcloudhome://';
const OAUTH_SCOPES = 'openid profile email offline_access IdentityServerApi';
const COGNITO_DOMAIN_SUFFIX = '.amazoncognito.com';

// Matches the official mobile app — MELCloud's backend is known to behave
// differently (or reject requests outright) for a non-mobile User-Agent.
const USER_AGENT = 'MonitorAndControl.App.Mobile/52 CFNetwork/3860.400.51 Darwin/25.3.0';
// The Cognito hosted login page is served to a browser/webview, not the
// bare mobile-BFF client — sent only for the two requests that touch it.
const COGNITO_LOGIN_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76';

const OPERATION_MODES = ['Heat', 'Cool', 'Automatic', 'Dry', 'Fan'];
const FAN_SPEEDS_API = ['Auto', 'One', 'Two', 'Three', 'Four', 'Five'];
const VANE_HORIZONTAL_API = ['Auto', 'Swing', 'Left', 'LeftCentre', 'Centre', 'RightCentre', 'Right'];

// Our clean domain model <-> the exact MELCloud API vocabulary.
const MODE_TO_API = { cool: 'Cool', heat: 'Heat', auto: 'Automatic', dry: 'Dry', fan: 'Fan' };
const MODE_FROM_API = { Cool: 'cool', Heat: 'heat', Automatic: 'auto', Dry: 'dry', Fan: 'fan' };
const FAN_TO_API = { auto: 'Auto', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five' };
const FAN_FROM_API = { Auto: 'auto', One: '1', Two: '2', Three: '3', Four: '4', Five: '5' };

// The approved UI only offers a fixed 3-way horizontal split (see the
// Naprave mock) rather than the API's full 7-value enum — "both" is a
// static centred position covering both indoor units, not an oscillating
// swing, matching how B described the two-unit living room setup.
const HVANE_TO_API = { left: 'Left', both: 'Centre', right: 'Right' };
function hvaneFromApi(value) {
  if (value === 'Left' || value === 'LeftCentre') return 'left';
  if (value === 'Right' || value === 'RightCentre') return 'right';
  return 'both'; // Centre, Auto, Swing, or an unrecognised value
}

export class MelCloudAuthError extends Error {}
export class MelCloudServiceError extends Error {
  constructor(status) {
    super(`MELCloud service unavailable (HTTP ${status})`);
    this.status = status;
  }
}
export class MelCloudApiError extends Error {}

// --- tiny per-host cookie jar --------------------------------------------
// The Cognito login step depends on session cookies set on the redirect
// chain leading up to it. Node's fetch has no browser-style persistent
// cookie jar, so this hand-rolls the minimum needed for one login() call —
// not a general-purpose jar (no expiry/path handling), scoped per host so
// auth.melcloudhome.com's cookies are never sent to the Cognito domain and
// vice versa.
function makeCookieJar() {
  const byHost = new Map();
  return {
    store(url, headers) {
      const host = new URL(url).hostname;
      const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
      if (!setCookies.length) return;
      const jar = byHost.get(host) || new Map();
      for (const raw of setCookies) {
        const pair = raw.split(';', 1)[0];
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
      byHost.set(host, jar);
    },
    header(url) {
      const jar = byHost.get(new URL(url).hostname);
      if (!jar || !jar.size) return undefined;
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function jarFetch(jar, url, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookie = jar.header(url);
  if (cookie) headers.set('Cookie', cookie);
  // redirect: 'manual' throughout — we need to inspect every hop (to catch
  // the melcloudhome:// custom-scheme redirect fetch cannot follow, and to
  // read the Cognito login page itself rather than transparently pass
  // through it) rather than land only on the final response.
  const res = await fetch(url, { ...init, headers, redirect: 'manual' });
  jar.store(url, res.headers);
  return res;
}

function extractCode(text) {
  if (!text) return null;
  const m = text.match(/code=([^&"' ]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function extractCsrfToken(html) {
  const patterns = [
    /<input[^>]+name="_csrf"[^>]+value="([^"]+)"/,
    /<input[^>]+value="([^"]+)"[^>]+name="_csrf"/,
    /name="_csrf"\s+value="([^"]+)"/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
}

// Executes one request, then follows any 3xx chain that results from it —
// used for both the "authorize" GET and the Cognito credential POST, since
// either can bounce through several hops before landing somewhere useful.
async function followRedirects(jar, url, init, maxHops = 10) {
  let currentUrl = url;
  let currentInit = init;
  for (let i = 0; i < maxHops; i++) {
    const res = await jarFetch(jar, currentUrl, currentInit);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) return { finalUrl: currentUrl, body: '', code: null };
      if (!/^https?:\/\//i.test(location)) {
        // e.g. melcloudhome://?code=...&state=... — fetch can't follow a
        // non-http(s) redirect, but the code we need is right there.
        return { finalUrl: location, body: '', code: extractCode(location) };
      }
      currentUrl = location;
      currentInit = { method: 'GET', headers: { 'User-Agent': USER_AGENT } };
      continue;
    }
    const body = await res.text();
    return { finalUrl: currentUrl, body, code: extractCode(currentUrl) || extractCode(body) };
  }
  throw new MelCloudAuthError('Too many redirects while signing in to MELCloud');
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function exchangeCodeForTokens(jar, code, verifier) {
  const res = await jarFetch(jar, `${AUTH_BASE_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: OAUTH_REDIRECT_URI,
      code_verifier: verifier,
      client_id: OAUTH_CLIENT_ID,
    }),
  });
  if (res.status !== 200) throw new MelCloudAuthError(`Token exchange failed: HTTP ${res.status}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

/**
 * login(email, password) — full OAuth 2.0 PKCE + Cognito login. Takes the
 * household's MELCloud Home credentials once and returns bearer tokens;
 * never stores or echoes the password itself. Throws MelCloudAuthError
 * with message 'WRONG_CREDENTIALS' when Cognito rejects the login, or a
 * plain MelCloudAuthError for any other failure in the dance (changed page
 * layout, missing CSRF token, too many redirects, ...).
 */
export async function login(email, password) {
  const jar = makeCookieJar();
  const { verifier, challenge } = generatePkce();
  const state = base64url(crypto.randomBytes(16));

  // Step 1: Pushed Authorization Request.
  const parRes = await jarFetch(jar, `${AUTH_BASE_URL}/connect/par`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: new URLSearchParams({
      response_type: 'code',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      client_id: OAUTH_CLIENT_ID,
      scope: OAUTH_SCOPES,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });
  if (parRes.status >= 500) throw new MelCloudServiceError(parRes.status);
  if (parRes.status !== 201) throw new MelCloudAuthError(`PAR request failed: HTTP ${parRes.status}`);
  const { request_uri: requestUri } = await parRes.json();

  // Step 2: Authorize — follow redirects to the Cognito login page (or,
  // rarely, straight to a code if the auth server already had a session).
  const authorizeUrl =
    `${AUTH_BASE_URL}/connect/authorize?client_id=${OAUTH_CLIENT_ID}` +
    `&request_uri=${encodeURIComponent(requestUri)}`;
  let hop = await followRedirects(jar, authorizeUrl, { method: 'GET', headers: { 'User-Agent': USER_AGENT } });

  let authCode = hop.code || null;

  if (!authCode) {
    const host = safeHostname(hop.finalUrl);
    if (!(host && host.endsWith(COGNITO_DOMAIN_SUFFIX) && hop.finalUrl.includes('/login'))) {
      throw new MelCloudAuthError(`Unexpected MELCloud authorize response (landed on ${hop.finalUrl})`);
    }

    // Step 3: Submit credentials to Cognito.
    const csrfToken = extractCsrfToken(hop.body);
    if (!csrfToken) {
      throw new MelCloudAuthError('Could not find the Cognito login form (its page layout may have changed)');
    }

    hop = await followRedirects(jar, hop.finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': COGNITO_LOGIN_USER_AGENT,
        Origin: `https://${host}`,
        Referer: hop.finalUrl,
      },
      body: new URLSearchParams({ _csrf: csrfToken, username: email, password, cognitoAsfData: '' }),
    });

    authCode = hop.code || null;

    if (!authCode) {
      const loginHost = safeHostname(hop.finalUrl);
      if (loginHost && loginHost.endsWith(COGNITO_DOMAIN_SUFFIX)) {
        throw new MelCloudAuthError('WRONG_CREDENTIALS');
      }
      // Step 4/5: the code can also arrive embedded as a callback link in
      // the page body rather than in the URL or a direct redirect.
      const callbackMatch = hop.body && hop.body.match(/\/connect\/authorize\/callback\?([^"' ]+)/);
      if (callbackMatch) {
        hop = await followRedirects(
          jar,
          `${AUTH_BASE_URL}/connect/authorize/callback?${callbackMatch[1].replace(/&amp;/g, '&')}`,
          { method: 'GET', headers: { 'User-Agent': USER_AGENT } },
        );
        authCode = hop.code || null;
      }
    }
  }

  if (!authCode) throw new MelCloudAuthError('Failed to obtain an authorization code from MELCloud');

  // Step 6: Exchange the code for access + refresh tokens.
  return exchangeCodeForTokens(jar, authCode, verifier);
}

/**
 * refreshAccessToken(refreshToken) — plain token refresh, no cookies or
 * redirects involved. Throws MelCloudAuthError('REFRESH_REJECTED') if the
 * refresh token itself has expired or been revoked, which means a full
 * login() (and therefore the household's password again) is required.
 */
export async function refreshAccessToken(refreshToken) {
  const jar = makeCookieJar();
  const res = await jarFetch(jar, `${AUTH_BASE_URL}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: OAUTH_CLIENT_ID }),
  });
  if (res.status >= 500) throw new MelCloudServiceError(res.status);
  if (res.status !== 200) throw new MelCloudAuthError('REFRESH_REJECTED');
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

// --- device state + control ------------------------------------------------

async function apiRequest(accessToken, method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new MelCloudAuthError('TOKEN_EXPIRED');
  if (res.status >= 500) throw new MelCloudServiceError(res.status);
  if (res.status >= 400) throw new MelCloudApiError(`MELCloud API error: HTTP ${res.status}`);
  // The mobile BFF serves JSON as text/plain and returns an empty body for
  // successful control (PUT) requests — content_type=None-equivalent.
  const text = await res.text();
  if (!text) return null;
  return JSON.parse(text);
}

// Temperature range is mode-dependent (Heat/Cool-Dry/Automatic each carry
// their own min/max in capabilities) — pick the range for whatever mode
// the unit is in right now so the UI's +/- buttons clamp correctly.
function temperatureRangeFor(mode, cap) {
  const ranges = {
    heat: [cap.minTempHeat, cap.maxTempHeat],
    cool: [cap.minTempCoolDry, cap.maxTempCoolDry],
    dry: [cap.minTempCoolDry, cap.maxTempCoolDry],
    fan: [cap.minTempCoolDry, cap.maxTempCoolDry],
    auto: [cap.minTempAutomatic, cap.maxTempAutomatic],
  };
  const [min, max] = ranges[mode] || [16, 31];
  return [min ?? 16, max ?? 31];
}

function buildModeList(cap) {
  const modes = [];
  if (cap.hasCoolOperationMode !== false) modes.push('cool');
  if (cap.hasHeatOperationMode !== false) modes.push('heat');
  if (cap.hasAutoOperationMode !== false) modes.push('auto');
  if (cap.hasDryOperationMode !== false) modes.push('dry');
  modes.push('fan'); // the API has no hasFanOperationMode flag — always offered
  return modes;
}

function buildFanSpeedList(cap) {
  const n = cap.numberOfFanSpeeds || 5;
  const speeds = cap.hasAutomaticFanSpeed !== false ? ['auto'] : [];
  for (let i = 1; i <= n; i++) speeds.push(String(i));
  return speeds;
}

// rssi's exact scale (dBm vs. a bars-style percentage) hasn't been
// confirmed against B's real unit yet — recalibrate these thresholds once
// you can compare a live reading against the signal shown in the official
// MELCloud Home app.
function rssiToBucket(rssi) {
  if (rssi === null || rssi === undefined) return 'unknown';
  if (rssi >= -60) return 'good';
  if (rssi >= -75) return 'fair';
  return 'poor';
}

function toHomeDevice(unit, roomName) {
  const settings = {};
  for (const s of unit.settings || []) settings[s.name] = s.value;
  const cap = unit.capabilities || {};
  const mode = MODE_FROM_API[settings.OperationMode] || 'cool';
  const [minTemperature, maxTemperature] = temperatureRangeFor(mode, cap);
  const isInError = String(settings.IsInError).toLowerCase() === 'true';
  const errorCode = settings.ErrorCode || null;

  return {
    id: unit.id,
    provider: 'melcloud_home',
    type: 'air_conditioner',
    name: unit.givenDisplayName || 'Klima',
    room: roomName,
    manufacturer: 'Mitsubishi Electric',
    model: null,
    externalId: unit.id,
    state: {
      // The mobile BFF has no per-unit connectivity flag on /context — a
      // device only appears here at all if the household's MELCloud
      // account can currently reach it, so "online" tracks whether this
      // sync succeeded at all, not a real live/offline signal per unit.
      online: true,
      power: String(settings.Power).toLowerCase() === 'true',
      currentTemperature: settings.RoomTemperature != null ? parseFloat(settings.RoomTemperature) : null,
      targetTemperature: settings.SetTemperature != null ? parseFloat(settings.SetTemperature) : null,
      mode,
      fanSpeed: FAN_FROM_API[settings.SetFanSpeed] || 'auto',
      vaneHorizontal: hvaneFromApi(settings.VaneHorizontalDirection),
      wifiSignal: rssiToBucket(unit.rssi),
      // Outdoor temperature needs a separate /report/v1/trendsummary call
      // per unit — deferred past v1 per the integration spec (section 11).
      outdoorTemperature: null,
      error: isInError ? errorCode || 'error' : null,
    },
    capabilities: {
      modes: buildModeList(cap),
      fanSpeeds: buildFanSpeedList(cap),
      hasHorizontalVane: cap.hasAirDirection !== false,
      hasVerticalVane: false, // not exposed by the UI yet
      minTemperature,
      maxTemperature,
      halfDegreeIncrements: cap.hasHalfDegreeIncrements !== false,
    },
  };
}

/** getDevices(accessToken) — every ATA unit across owned + guest buildings. */
export async function getDevices(accessToken) {
  const context = await apiRequest(accessToken, 'GET', '/context');
  const buildings = [...(context?.buildings || []), ...(context?.guestBuildings || [])];
  const devices = [];
  for (const building of buildings) {
    for (const unit of building.airToAirUnits || []) {
      devices.push(toHomeDevice(unit, building.name || null));
    }
  }
  return devices;
}

/** getDevice(accessToken, externalId) — used for the post-command refresh. */
export async function getDevice(accessToken, externalId) {
  const devices = await getDevices(accessToken);
  return devices.find((d) => d.externalId === externalId) || null;
}

function buildControlPayload(updates) {
  return {
    power: null,
    operationMode: null,
    setFanSpeed: null,
    vaneHorizontalDirection: null,
    vaneVerticalDirection: null,
    setTemperature: null,
    temperatureIncrementOverride: null,
    inStandbyMode: null,
    ...updates,
  };
}

async function control(accessToken, externalId, updates) {
  await apiRequest(accessToken, 'PUT', `/monitor/ataunit/${externalId}`, buildControlPayload(updates));
}

export async function setPower(accessToken, externalId, on) {
  await control(accessToken, externalId, { power: !!on });
}

export async function setTemperature(accessToken, externalId, celsius) {
  await control(accessToken, externalId, { setTemperature: celsius });
}

export async function setMode(accessToken, externalId, mode) {
  const apiMode = MODE_TO_API[mode];
  if (!apiMode) throw new Error(`Unsupported mode: ${mode}`);
  await control(accessToken, externalId, { operationMode: apiMode });
}

export async function setFanSpeed(accessToken, externalId, fanSpeed) {
  const apiSpeed = FAN_TO_API[fanSpeed];
  if (!apiSpeed) throw new Error(`Unsupported fan speed: ${fanSpeed}`);
  await control(accessToken, externalId, { setFanSpeed: apiSpeed });
}

// Vertical vane omitted for this unit and not exposed by the UI yet — left
// as a documented no-op for when a future unit/UI needs it.
export async function setVerticalVane() {
  throw new Error('Vertical vane control is not exposed by this integration yet');
}

export async function setHorizontalVane(accessToken, externalId, position) {
  const apiPosition = HVANE_TO_API[position];
  if (!apiPosition) throw new Error(`Unsupported vane position: ${position}`);
  await control(accessToken, externalId, { vaneHorizontalDirection: apiPosition });
}
