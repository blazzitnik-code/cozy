// Server-side command endpoint for home devices — the client never calls
// MELCloud (or any future provider) directly, only this route. See
// NAPRAVKO_MELCLOUD_IMPLEMENTATION.md § security.
//
// Auth: no @supabase/ssr in this project (auth is entirely client-managed
// via lib/supabase.js), so the caller's access token is passed as a Bearer
// header and used to build a per-request Supabase client — the read below
// runs AS that user, so RLS (household_members) is what actually decides
// whether they may see/command this device, not app code re-deriving it.
// The device-state write after a successful command uses the service role,
// since home_devices is read-only for clients (see the home_devices
// migration).
import { createClient } from '@supabase/supabase-js';
import * as provider from '../../../../../providers/melcloud-home/index.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applyCommand(device, type, value) {
  switch (type) {
    case 'power':
      return provider.setPower(device.external_id, !!value);
    case 'set_temperature':
      return provider.setTemperature(device.external_id, value);
    case 'mode':
      return provider.setMode(device.external_id, value);
    case 'fan_speed':
      return provider.setFanSpeed(device.external_id, value);
    case 'horizontal_vane':
      return provider.setHorizontalVane(device.external_id, value);
    case 'refresh':
      return; // no-op — the point of this command is just the re-fetch below
    default:
      throw new Error(`unknown command type: ${type}`);
  }
}

export async function POST(request, { params }) {
  const { id } = await params;

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: device, error: readErr } = await userClient
    .from('home_devices')
    .select('id, household_id, provider, external_id')
    .eq('id', id)
    .maybeSingle();

  // RLS makes a device invisible to a non-member the same as it not
  // existing — same 404 either way, so we never leak which.
  if (readErr || !device) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.type) {
    return Response.json({ error: 'bad_request' }, { status: 400 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    await applyCommand(device, body.type, body.value);
  } catch (err) {
    return Response.json({ error: 'command_failed', message: String(err?.message || err) }, { status: 502 });
  }

  // Immediate refresh — re-fetch real state rather than trusting the
  // command call (the real API's control response is 200 with an empty
  // body, so there's nothing to trust anyway).
  try {
    const fresh = await provider.getDevice(device.external_id);
    if (fresh) {
      await admin
        .from('home_devices')
        .update({ state: fresh.state, last_synced_at: new Date().toISOString(), last_error: null })
        .eq('id', device.id);
    }
  } catch (err) {
    await admin
      .from('home_devices')
      .update({ last_error: String(err?.message || err) })
      .eq('id', device.id);
    // The command itself already succeeded — surface the refresh failure
    // as a soft error rather than a command failure.
    return Response.json({ ok: true, refreshError: String(err?.message || err) });
  }

  return Response.json({ ok: true });
}
