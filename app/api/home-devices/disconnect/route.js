// Disconnects a household's home-device provider — deletes the connection
// (its secret row cascades) and the devices that came from it, so a stale
// device card doesn't linger in the Devices tab after disconnecting.
import { createClient } from '@supabase/supabase-js';
import { PROVIDERS } from '../../../../lib/providers.js';
import { adminClient } from '../../../../lib/melcloud-server.js';

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
  const providerName = body?.provider;
  if (!householdId || !providerName || !PROVIDERS[providerName]) {
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

  const admin = adminClient();

  await admin.from('home_devices').delete().eq('household_id', householdId).eq('provider', providerName);
  await admin.from('provider_connections').delete().eq('household_id', householdId).eq('provider', providerName);

  return Response.json({ ok: true });
}
