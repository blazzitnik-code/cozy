// Manually triggers the freebusy ICS resync (the "Sync now" button in
// Settings → Povezave) instead of waiting for the next cozy-freebusy-sync
// cron tick (every 30 min). Doesn't touch FREEBUSY_FN_SECRET at all — it
// just calls the trigger_freebusy_sync() Postgres function (see
// supabase/migrations/20260913154025_trigger_freebusy_sync_rpc.sql), which
// reads the secret from Vault itself and is grant-restricted to service_role.
//
// Not household-scoped: one call resyncs every household's ICS sources,
// same as the cron job — the auth check below only proves the caller is a
// real signed-in user, not that this endpoint is otherwise open.
import { createClient } from '@supabase/supabase-js';
import { adminClient } from '../../../../lib/melcloud-server.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = adminClient();
  const { error } = await admin.rpc('trigger_freebusy_sync');
  if (error) {
    console.error('trigger_freebusy_sync failed', error);
    return Response.json({ error: 'unknown', message: error.message }, { status: 502 });
  }

  return Response.json({ ok: true });
}
