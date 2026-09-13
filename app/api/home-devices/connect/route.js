// Connects a household to a home-device provider (currently only
// 'melcloud_home'). Takes the household's own account email+password once,
// submits it straight to the provider's real login (never to our own DB),
// and stores only the resulting bearer tokens — see
// supabase/migrations/20260913125400_provider_connections.sql for why the
// tokens live in a service-role-only table rather than Vault.
//
// Auth follows the same pattern as the command route: no @supabase/ssr in
// this project, so the caller's access token is passed as a Bearer header
// and used to build a per-request client whose RLS-gated read against
// `households` is what actually proves household membership — app code
// never re-derives that itself.
import { createClient } from '@supabase/supabase-js';
import * as provider from '../../../../providers/melcloud-home/index.js';
import { adminClient, toFriendlyError, markConnectionOk } from '../../../../lib/melcloud-server.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const PROVIDER_NAME = 'melcloud_home';

function toHomeDeviceRow(householdId, d) {
  return {
    household_id: householdId,
    provider: PROVIDER_NAME,
    device_type: d.type,
    external_id: d.externalId,
    name: d.name,
    room: d.room,
    state: d.state,
    capabilities: d.capabilities,
    last_synced_at: new Date().toISOString(),
    last_error: null,
  };
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const householdId = body?.householdId;
  const email = body?.email;
  const password = body?.password;
  if (!householdId || !email || !password) {
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

  let tokens;
  try {
    tokens = await provider.login(email, password);
  } catch (err) {
    const friendly = toFriendlyError(err);
    const status = friendly.code === 'invalid_credentials' ? 401 : 502;
    return Response.json({ error: friendly.code, message: friendly.message }, { status });
  }

  const admin = adminClient();

  // Upsert the display-safe row first (so a later failure fetching devices
  // still leaves a real, working connection behind) and grab its id.
  const { data: connection, error: upsertErr } = await admin
    .from('provider_connections')
    .upsert(
      {
        household_id: householdId,
        provider: PROVIDER_NAME,
        status: 'connected',
        account_email: email,
        connected_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'household_id,provider' },
    )
    .select('id')
    .single();
  if (upsertErr || !connection) {
    return Response.json({ error: 'unknown', message: 'Povezave ni bilo mogoče shraniti.' }, { status: 500 });
  }

  const { error: secretErr } = await admin.from('provider_connection_secrets').upsert(
    {
      connection_id: connection.id,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires_at: new Date(tokens.expiresAt).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'connection_id' },
  );
  if (secretErr) {
    return Response.json({ error: 'unknown', message: 'Žetonov ni bilo mogoče shraniti.' }, { status: 500 });
  }

  // Populate home_devices immediately rather than waiting up to 10 min for
  // the next cron sync — this is what makes the Devices tab show the AC
  // right after connecting.
  let deviceSyncError = null;
  try {
    const devices = await provider.getDevices(tokens.accessToken);
    for (const d of devices) {
      const { error } = await admin
        .from('home_devices')
        .upsert(toHomeDeviceRow(householdId, d), { onConflict: 'household_id,provider,external_id' });
      if (error) throw error;
    }
    await markConnectionOk(admin, connection.id);
  } catch (err) {
    // The connection itself is good (login succeeded) — a device-list
    // hiccup right after is a soft error, surfaced but not fatal. The next
    // cron sync will retry.
    deviceSyncError = String(err?.message || err);
  }

  return Response.json({ ok: true, accountEmail: email, deviceSyncError });
}
