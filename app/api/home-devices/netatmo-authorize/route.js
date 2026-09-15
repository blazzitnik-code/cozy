// Kicks off Netatmo's OAuth flow. Unlike /connect (MELCloud/Vaillant email
// +password, or Shelly's pasted key — all one authenticated POST), Netatmo
// needs a real browser redirect through its own login+consent page, so
// this route doesn't log the household in itself — it just proves the
// caller is a member of the household (same Bearer-token pattern as every
// other route here) and hands back the URL to redirect to, with the
// household id folded into a signed `state` (see
// lib/netatmo-server.js#signNetatmoState) so the callback route — which
// runs with no Authorization header, since Netatmo is the one calling it —
// can recover which household this was for.
import { createClient } from '@supabase/supabase-js';
import * as netatmo from '../../../../providers/netatmo/index.js';
import { signNetatmoState } from '../../../../lib/netatmo-server.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const householdId = body?.householdId;
  if (!householdId) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: household, error: memErr } = await userClient
    .from('households')
    .select('id')
    .eq('id', householdId)
    .maybeSingle();
  if (memErr || !household) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const state = signNetatmoState(householdId);
  return Response.json({ url: netatmo.getAuthorizeUrl(state) });
}
