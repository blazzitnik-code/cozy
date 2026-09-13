// TEMPORARY DIAGNOSTIC ROUTE — not part of the product, delete after use.
//
// Tests whether Vaillant's identity-server WAF (the "Team Trixie" bot
// block that rejects the interactive login flow from this app's Vercel
// deployment) also blocks the token-refresh grant and the data API, or
// whether it specifically targets the credential-entry page. Takes a
// refresh_token obtained from a real interactive login done from a
// residential network (see scripts/tmp-vaillant-test.mjs) and, running
// here on Vercel's own infrastructure, tries to (1) exchange it for a
// fresh access token and (2) fetch the device list with it. Never echoes
// any token back — only booleans/counts/error strings.
//
// Guarded by a static shared secret (not an env var — this route is
// meant to live for minutes, not to be a permanent piece of config).
// DELETE THIS FILE once the test is done.
import { refreshAccessToken, getDevices } from '../../../../providers/vaillant/index.js';

export const preferredRegion = 'fra1';

const DIAG_SECRET = '9e9edb71f2842223b41812f8fd7ced03a0a28b0d1cbce374';

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

  let tokens;
  try {
    tokens = await refreshAccessToken(refreshToken);
    result.refreshOk = true;
  } catch (err) {
    result.refreshError = String(err?.message || err);
    return Response.json(result);
  }

  try {
    const devices = await getDevices(tokens.accessToken);
    result.apiOk = true;
    result.deviceCount = devices.length;
  } catch (err) {
    result.apiError = String(err?.message || err);
  }

  return Response.json(result);
}
