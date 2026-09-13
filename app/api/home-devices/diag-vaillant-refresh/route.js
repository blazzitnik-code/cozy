// TEMPORARY DIAGNOSTIC ROUTE — not part of the product, delete after use.
//
// Tests whether Vaillant's identity-server WAF (the "Team Trixie" bot
// block that rejects the interactive login flow from this app's Vercel
// deployment) also blocks the token-refresh grant and the data API, or
// whether it specifically targets the credential-entry page. Takes a
// refresh_token obtained from a real interactive login done from a
// residential network (see scripts/tmp-vaillant-refresh-test.mjs) and,
// running here on Vercel's own infrastructure, tries to (1) exchange it
// for a fresh access token and (2) fetch the device list with it.
//
// Does the token-refresh HTTP call directly (not via
// providers/vaillant/index.js's refreshAccessToken(), which collapses
// every non-200 into one opaque REFRESH_REJECTED) so this can report the
// actual HTTP status + a short body snippet — enough to tell a WAF HTML
// block page apart from a genuine Keycloak JSON rejection, without ever
// exposing any token.
//
// Guarded by a static shared secret (not an env var — this route is
// meant to live for minutes, not to be a permanent piece of config).
// DELETE THIS FILE once the test is done.
import { getDevices } from '../../../../providers/vaillant/index.js';

export const preferredRegion = 'fra1';

const DIAG_SECRET = '9e9edb71f2842223b41812f8fd7ced03a0a28b0d1cbce374';

const TOKEN_URL = 'https://identity.vaillant-group.com/auth/realms/vaillant-slovenia-b2c/protocol/openid-connect/token';
const CLIENT_ID = 'myvaillant';
const APP_HEADERS = {
  'User-Agent': 'okhttp/4.9.2',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-GB',
};

export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body || body.secret !== DIAG_SECRET) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  const refreshToken = body.refreshToken;
  if (!refreshToken) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const result = { refreshOk: false, apiOk: false };

  let tokenRes;
  try {
    tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { ...APP_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT_ID }),
    });
  } catch (err) {
    result.refreshError = `fetch threw: ${String(err?.message || err)}`;
    return Response.json(result);
  }

  result.refreshStatus = tokenRes.status;
  result.refreshContentType = tokenRes.headers.get('content-type') || null;
  const rawText = await tokenRes.text();
  result.refreshBodySnippet = rawText.slice(0, 400);
  result.looksLikeWaf =
    rawText.includes('automatically detected as a potential threat') || rawText.includes('Team Trixie');

  if (tokenRes.status !== 200) {
    return Response.json(result);
  }
  result.refreshOk = true;

  let accessToken;
  try {
    const data = JSON.parse(rawText);
    accessToken = data.access_token;
  } catch (err) {
    result.parseError = String(err?.message || err);
    return Response.json(result);
  }

  try {
    const devices = await getDevices(accessToken);
    result.apiOk = true;
    result.deviceCount = devices.length;
  } catch (err) {
    result.apiError = String(err?.message || err);
  }

  return Response.json(result);
}
