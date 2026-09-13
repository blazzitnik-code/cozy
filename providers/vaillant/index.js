// providers/vaillant/index.js
//
// Real Vaillant myVAILLANT provider — Keycloak OAuth 2.0 Authorization Code
// + PKCE (identity.vaillant-group.com), then the Vaillant Group cloud API
// (api.vaillant-group.com) for system/zone/domestic-hot-water state and
// control. Covers modern sensoCOMFORT/VR921-connected systems (aroTHERM
// heat pumps, ecoTEC boilers) — the "tli" control identifier. Older
// VRC700/multiMATIC-connected systems use a different API shape entirely
// and are NOT supported by this module (loginRealm/systems would need a
// vrc700 branch throughout) — connect() will surface a clear error rather
// than silently mishandling one.
//
// Like MELCloud Home, myVAILLANT has no third-party OAuth app registration
// a server-side integration can use — the mobile app itself drives a
// browser-based Keycloak login from inside its own webview. login() here
// does the same dance server-side: GET the Keycloak authorize endpoint
// (PKCE challenge), solve the ALTCHA anti-bot proof-of-work challenge
// Keycloak's login page serves, POST credentials to the extracted login
// form action, then exchange the resulting code for tokens. The password
// itself is never returned or persisted by this module.
//
// Endpoints, the client_id, the realm-naming scheme and the ALTCHA
// proof-of-work algorithm below are load-bearing and were read directly
// from the reference implementation this integration is required to reuse
// rather than invent (github.com/signalkraft/myPyllant — const.py,
// api.py's get_code()/get_token()/refresh_token(), utils.py's
// get_realm()/solve_altcha_challenge()). Do not "clean up" any of those
// constants without checking that project's current source again —
// Vaillant can and does change this undocumented API without notice (its
// ALTCHA/bot-protection already broke every client of that library once,
// mid-2026).

import crypto from 'node:crypto';

const AUTH_BASE_URL = 'https://identity.vaillant-group.com/auth/realms';
const LOGIN_URL = (realm) => `${AUTH_BASE_URL}/${realm}/login-actions/authenticate`;
const AUTHENTICATE_URL = (realm) => `${AUTH_BASE_URL}/${realm}/protocol/openid-connect/auth`;
const TOKEN_URL = (realm) => `${AUTH_BASE_URL}/${realm}/protocol/openid-connect/token`;
const ALTCHA_CHALLENGE_URL = 'https://identity.vaillant-group.com/api/altcha/challenge';
const API_BASE = 'https://api.vaillant-group.com/service-connected-control/end-user-app-api/v1';
const CLIENT_ID = 'myvaillant';
const OAUTH_REDIRECT_URI = 'enduservaillant.page.link://login';

// The myVAILLANT mobile app is built on Android/okhttp — Vaillant's
// identity-server WAF (Azure Front Door-style bot management, per its own
// "Team Trixie" error page) blocks requests from cloud/datacenter IPs that
// don't look like the real app; sending the same User-Agent + Accept-*
// headers the mobile app itself sends is what gets a Vercel-hosted request
// treated as legitimate instead of flagged as "a request matching a known
// attack pattern." Same rationale as providers/melcloud-home/index.js's
// USER_AGENT constant.
const APP_USER_AGENT = 'okhttp/4.9.2';
const APP_HEADERS = {
  'User-Agent': APP_USER_AGENT,
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB',
};

// Single household, single known system for this integration — the myVAILLANT
// app itself makes you pick brand+country once at account setup, and there is
// no way to discover it from the API before logging in. Hardcoded rather than
// a Settings field because there is exactly one plausible value for this
// household; revisit if Cožy ever needs to support a Vaillant household
// outside Slovenia.
const BRAND = 'vaillant';
const COUNTRY = 'slovenia';

function realmFor() {
  // get_realm() in myPyllant/utils.py: "{brand}-{country}-b2c" for any
  // brand+country pair that requires a country (which vaillant always does).
  return `${BRAND}-${COUNTRY}-b2c`;
}

export class VaillantAuthError extends Error {}
export class VaillantServiceError extends Error {
  constructor(status) {
    super(`Vaillant service unavailable (HTTP ${status})`);
    this.status = status;
  }
}
export class VaillantApiError extends Error {}
export class VaillantUnsupportedControllerError extends Error {}

// --- tiny per-host cookie jar --------------------------------------------
// Keycloak's login page depends on a session cookie set on the initial GET
// to the authorize endpoint, which must be sent back on the credential POST.
// Same minimal, single-login-call jar as providers/melcloud-home/index.js —
// see that file's comment for why a hand-rolled one is needed at all.
function makeCookieJar() {
  const jar = new Map();
  let warnedNoGetSetCookie = false;
  return {
    store(headers) {
      let setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
      if (!setCookies.length && typeof headers.getSetCookie !== 'function') {
        const raw = headers.get('set-cookie');
        if (raw) setCookies = raw.split(/,(?=[^;]+?=)/).map((s) => s.trim());
        if (!warnedNoGetSetCookie) {
          console.error('vaillant login(): Headers.getSetCookie() unavailable, using comma-split fallback');
          warnedNoGetSetCookie = true;
        }
      }
      for (const raw of setCookies) {
        const pair = raw.split(';', 1)[0];
        const eq = pair.indexOf('=');
        if (eq === -1) continue;
        jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() {
      if (!jar.size) return undefined;
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

async function jarFetch(jar, url, init = {}) {
  const headers = new Headers(init.headers || {});
  const cookie = jar.header();
  if (cookie) headers.set('Cookie', cookie);
  const res = await fetch(url, { ...init, headers, redirect: 'manual' });
  jar.store(res.headers);
  return res;
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generatePkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

// ALTCHA is a proof-of-work anti-bot challenge (not a human captcha) served
// by Keycloak's login page: find a `counter` such that
// PBKDF2(nonce || counter, salt, cost) starts with `keyPrefix`, then package
// the (challenge, solution) pair the same way the browser widget does.
// Ported verbatim from myPyllant/utils.py's solve_altcha_challenge().
function solveAltchaChallenge(challenge) {
  const { parameters } = challenge;
  const nonceBuf = Buffer.from(parameters.nonce, 'hex');
  const saltBuf = Buffer.from(parameters.salt, 'hex');
  const keyPrefixBuf = Buffer.from(parameters.keyPrefix, 'hex');
  const cost = parameters.cost;
  const keyLength = parameters.keyLength || 32;
  const digest = { 'PBKDF2/SHA-512': 'sha512', 'PBKDF2/SHA-384': 'sha384' }[parameters.algorithm] || 'sha256';

  let counter = 0;
  let derived;
  for (;;) {
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(counter >>> 0, 0);
    const password = Buffer.concat([nonceBuf, counterBuf]);
    derived = crypto.pbkdf2Sync(password, saltBuf, cost, keyLength, digest);
    if (derived.subarray(0, keyPrefixBuf.length).equals(keyPrefixBuf)) break;
    counter += 1;
  }

  const payload = {
    challenge: { parameters, signature: challenge.signature },
    solution: { counter, derivedKey: derived.toString('hex'), time: 0 },
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function extractCode(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('code');
  } catch {
    const m = String(url).match(/[?&]code=([^&"' ]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

// The login form's action URL is embedded in the authorize page's HTML as
// an absolute LOGIN_URL(realm)?... link (Keycloak escapes & as &amp;).
function extractLoginFormUrl(html, realm) {
  const prefix = LOGIN_URL(realm);
  const idx = html.indexOf(prefix);
  if (idx === -1) return null;
  const rest = html.slice(idx).match(/^[^"']+/);
  if (!rest) return null;
  return rest[0].replace(/&amp;/g, '&');
}

async function exchangeCodeForTokens(jar, code, verifier, realm) {
  const res = await jarFetch(jar, TOKEN_URL(realm), {
    method: 'POST',
    headers: { ...APP_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: OAUTH_REDIRECT_URI,
    }),
  });
  const data = await res.json().catch(() => null);
  if (res.status >= 400 || !data) throw new VaillantAuthError(`Token exchange failed: HTTP ${res.status}`);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

/**
 * login(email, password) — full Keycloak OAuth2 PKCE + ALTCHA login. Takes
 * the household's myVAILLANT email+password once and returns bearer
 * tokens; never stores or echoes the password itself. Throws
 * VaillantAuthError with message 'WRONG_CREDENTIALS' when Keycloak rejects
 * the login.
 */
export async function login(email, password) {
  const jar = makeCookieJar();
  const realm = realmFor();
  const { verifier, challenge } = generatePkce();

  // Step 1: GET the authorize endpoint. Keycloak either already has a
  // session (redirects straight to a code — rare for a fresh server-side
  // login) or serves the login page HTML with the login form's action URL
  // embedded in it.
  const authorizeUrl =
    `${AUTHENTICATE_URL(realm)}?` +
    new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      redirect_uri: OAUTH_REDIRECT_URI,
    }).toString();

  const authorizeRes = await jarFetch(jar, authorizeUrl, { headers: APP_HEADERS });
  if (authorizeRes.status >= 500) throw new VaillantServiceError(authorizeRes.status);

  let code = extractCode(authorizeRes.headers.get('location'));

  if (!code) {
    const loginHtml = await authorizeRes.text();
    // Vaillant's identity-server WAF ("Team Trixie" error pages) returns a
    // 403-with-200-body-shaped block page for requests it flags as bot
    // traffic (commonly triggered by a cloud/datacenter source IP) — this
    // is NOT the same failure as Keycloak's login page layout changing, so
    // it gets its own error code rather than the generic fallback below.
    if (loginHtml.includes('automatically detected as a potential threat') || loginHtml.includes('Team Trixie')) {
      console.error('vaillant login(): blocked by Vaillant WAF', JSON.stringify(loginHtml.slice(0, 800)));
      throw new VaillantAuthError('BLOCKED_BY_WAF');
    }
    const loginUrl = extractLoginFormUrl(loginHtml, realm);
    if (!loginUrl) {
      console.error('vaillant login(): could not find login form url', JSON.stringify(loginHtml.slice(0, 1500)));
      throw new VaillantAuthError('Could not find the Keycloak login form (its page layout may have changed)');
    }

    const loginPayload = { username: email, password, credentialId: '' };
    try {
      const challengeRes = await fetch(ALTCHA_CHALLENGE_URL, { headers: APP_HEADERS });
      if (challengeRes.ok) {
        loginPayload.altcha = solveAltchaChallenge(await challengeRes.json());
      }
    } catch (err) {
      // Non-blocking, same as myPyllant — Keycloak accepts a login without
      // the altcha field when the challenge endpoint itself is unavailable.
      console.error('vaillant login(): ALTCHA challenge fetch/solve failed, continuing without it', err?.message);
    }

    const loginRes = await jarFetch(jar, loginUrl, {
      method: 'POST',
      headers: { ...APP_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(loginPayload),
    });

    const location = loginRes.headers.get('location');
    code = extractCode(location);
    if (!code) {
      // No redirect at all means Keycloak re-rendered the login form —
      // wrong credentials (or the ALTCHA/bot-protection rejected us, which
      // looks identical from here).
      throw new VaillantAuthError('WRONG_CREDENTIALS');
    }
  }

  return exchangeCodeForTokens(jar, code, verifier, realm);
}

/**
 * refreshAccessToken(refreshToken) — plain token refresh, no cookies or
 * redirects. Throws VaillantAuthError('REFRESH_REJECTED') if the refresh
 * token itself has expired or been revoked.
 */
export async function refreshAccessToken(refreshToken) {
  const realm = realmFor();
  const res = await fetch(TOKEN_URL(realm), {
    method: 'POST',
    headers: { ...APP_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT_ID }),
  });
  if (res.status >= 500) throw new VaillantServiceError(res.status);
  if (res.status !== 200) throw new VaillantAuthError('REFRESH_REJECTED');
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

// --- device state + control ------------------------------------------------

function authHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json, text/plain, */*',
    'User-Agent': APP_USER_AGENT,
    'x-app-identifier': 'VAILLANT',
    'x-idm-identifier': 'KEYCLOAK',
    'x-client-locale': 'en-GB',
    'Accept-Language': 'en-GB',
    // Fixed subscription key used by the myVAILLANT mobile app for every
    // account — not a per-household secret (read from the reference
    // implementation, see this file's header comment).
    'ocp-apim-subscription-key': '1e0a2f3511fb4c5bbb1c7f9fedd20b1c',
  };
}

async function apiRequest(accessToken, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { ...authHeaders(accessToken), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new VaillantAuthError('TOKEN_EXPIRED');
  if (res.status >= 500) throw new VaillantServiceError(res.status);
  if (res.status >= 400) {
    const text = await res.text().catch(() => '');
    throw new VaillantApiError(`Vaillant API error: HTTP ${res.status}${text ? ` — ${text.slice(0, 300)}` : ''}`);
  }
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// One system's base URL for zone/DHW control calls — requires a
// meta-info/control-identifier lookup first (Vaillant's own API doesn't
// expose the controller type any other way). Only "tli" (modern
// sensoCOMFORT-connected systems) is supported — see this file's header
// comment.
async function systemApiBase(accessToken, systemId) {
  const meta = await apiRequest(accessToken, 'GET', `${API_BASE}/systems/${systemId}/meta-info/control-identifier`);
  const controlIdentifier = meta?.controlIdentifier || 'tli';
  if (controlIdentifier !== 'tli') {
    throw new VaillantUnsupportedControllerError(
      `Vaillant controller type '${controlIdentifier}' is not supported yet (only modern sensoCOMFORT/tli systems are)`,
    );
  }
  return `${API_BASE}/systems/${systemId}/tli`;
}

function parseExternalId(externalId) {
  // "{systemId}:zone:{index}" or "{systemId}:dhw:{index}"
  const [systemId, kind, indexStr] = externalId.split(':');
  return { systemId, kind, index: Number(indexStr) };
}

function toZoneDevice(systemId, zone) {
  const heating = zone.heating || {};
  return {
    id: `${systemId}:zone:${zone.index}`,
    provider: 'vaillant',
    type: 'heating_zone',
    name: zone.general?.name || `Cona ${zone.index + 1}`,
    room: null,
    manufacturer: 'Vaillant',
    externalId: `${systemId}:zone:${zone.index}`,
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
    capabilities: {
      modes: ['manual', 'time_controlled', 'off'],
      minTemperature: 5,
      maxTemperature: 30,
    },
  };
}

function toDhwDevice(systemId, dhw) {
  return {
    id: `${systemId}:dhw:${dhw.index}`,
    provider: 'vaillant',
    type: 'domestic_hot_water',
    name: 'Sanitarna voda',
    room: null,
    manufacturer: 'Vaillant',
    externalId: `${systemId}:dhw:${dhw.index}`,
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

// The raw /systems/{id}/tli response splits each zone/dhw/circuit across
// three top-level sections — configuration (schedules/settings), properties
// (static capabilities) and state (live readings) — keyed by a shared
// `index` rather than one flat array. The official myPyllant library merges
// these client-side (System.from_api()'s merge_object()); do the same here
// rather than assuming a flat `system.zones`/`system.domesticHotWater` (an
// assumption the first live test against B's real VR940F system disproved —
// confirmed correct once merged: currentRoomTemperature, operationModeHeating,
// tappingSetpoint etc. all showed up exactly where expected, just split
// across sections).
function mergeByIndex(...sections) {
  const byIndex = new Map();
  for (const section of sections) {
    for (const item of section || []) {
      byIndex.set(item.index, { ...(byIndex.get(item.index) || {}), ...item });
    }
  }
  return [...byIndex.values()];
}

/**
 * getDevices(accessToken) — every zone + domestic-hot-water tank across
 * every home/system on the account. Discovery IS the sync, same as
 * MELCloud Home's /context — there's no separate "add device" step.
 */
export async function getDevices(accessToken) {
  const homes = await apiRequest(accessToken, 'GET', `${API_BASE}/homes`);
  const devices = [];
  for (const home of homes || []) {
    const systemId = home.systemId;
    if (!systemId) continue;
    let apiBase;
    try {
      apiBase = await systemApiBase(accessToken, systemId);
    } catch (err) {
      if (err instanceof VaillantUnsupportedControllerError) {
        console.error('vaillant getDevices(): skipping unsupported system', systemId, err.message);
        continue;
      }
      throw err;
    }
    const system = await apiRequest(accessToken, 'GET', apiBase);
    const zones = mergeByIndex(system?.configuration?.zones, system?.properties?.zones, system?.state?.zones);
    const dhwList = mergeByIndex(system?.configuration?.dhw, system?.properties?.dhw, system?.state?.dhw);
    for (const zone of zones) devices.push(toZoneDevice(systemId, zone));
    for (const dhw of dhwList) devices.push(toDhwDevice(systemId, dhw));
  }
  return devices;
}

/** getDevice(accessToken, externalId) — used for the post-command refresh. */
export async function getDevice(accessToken, externalId) {
  const devices = await getDevices(accessToken);
  return devices.find((d) => d.externalId === externalId) || null;
}

const ZONE_MODE_TO_API = { manual: 'MANUAL', time_controlled: 'TIME_CONTROLLED', off: 'OFF' };
const DHW_MODE_TO_API = { manual: 'MANUAL', time_controlled: 'TIME_CONTROLLED', off: 'OFF' };
const DEFAULT_QUICK_VETO_DURATION_HOURS = 3;

export async function setZoneMode(accessToken, externalId, mode) {
  const apiMode = ZONE_MODE_TO_API[mode];
  if (!apiMode) throw new Error(`Unsupported zone mode: ${mode}`);
  const { systemId, index } = parseExternalId(externalId);
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'PATCH', `${base}/zones/${index}/heating-operation-mode`, { operationMode: apiMode });
}

export async function setZoneSetpoint(accessToken, externalId, celsius) {
  const { systemId, index } = parseExternalId(externalId);
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'PATCH', `${base}/zones/${index}/manual-mode-setpoint`, {
    setpoint: celsius,
    type: 'HEATING',
  });
}

export async function quickVetoZone(
  accessToken,
  externalId,
  celsius,
  durationHours = DEFAULT_QUICK_VETO_DURATION_HOURS,
) {
  const { systemId, index } = parseExternalId(externalId);
  const base = await systemApiBase(accessToken, systemId);
  // POST to start quick veto, PATCH to change an already-active one — the
  // UI always calls this one function, so probe state first.
  const zoneDevice = await getDevice(accessToken, externalId);
  const method = zoneDevice?.state?.quickVetoActive ? 'PATCH' : 'POST';
  await apiRequest(accessToken, method, `${base}/zones/${index}/quick-veto`, {
    desiredRoomTemperatureSetpoint: celsius,
    duration: durationHours,
  });
}

export async function cancelQuickVetoZone(accessToken, externalId) {
  const { systemId, index } = parseExternalId(externalId);
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'DELETE', `${base}/zones/${index}/quick-veto`);
}

export async function setDhwMode(accessToken, externalId, mode) {
  const apiMode = DHW_MODE_TO_API[mode];
  if (!apiMode) throw new Error(`Unsupported DHW mode: ${mode}`);
  const { systemId, index } = parseExternalId(externalId);
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'PATCH', `${base}/domestic-hot-water/${index}/operation-mode`, {
    operationMode: apiMode,
  });
}

export async function setDhwSetpoint(accessToken, externalId, celsius) {
  const { systemId, index } = parseExternalId(externalId);
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'PATCH', `${base}/domestic-hot-water/${index}/temperature`, {
    setpoint: Math.round(celsius),
  });
}

export async function boostDhw(accessToken, externalId) {
  const { systemId, index } = parseExternalId(externalId);
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'POST', `${base}/domestic-hot-water/${index}/boost`, {});
}

export async function cancelDhwBoost(accessToken, externalId) {
  const { systemId, index } = parseExternalId(externalId);
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'DELETE', `${base}/domestic-hot-water/${index}/boost`);
}

export async function setHoliday(accessToken, systemId, startIso, endIso) {
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'POST', `${base}/away-mode`, { startDateTime: startIso, endDateTime: endIso });
}

export async function cancelHoliday(accessToken, systemId) {
  const base = await systemApiBase(accessToken, systemId);
  await apiRequest(accessToken, 'DELETE', `${base}/away-mode`);
}
