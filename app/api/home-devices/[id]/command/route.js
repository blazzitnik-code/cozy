// Server-side command endpoint for home devices — the client never calls a
// provider (MELCloud, Vaillant, ...) directly, only this route. See
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
//
// Token handling: getValidAccessToken() (lib/<provider>-server.js) resolves
// the household's stored connection for device.provider to a live bearer
// token, refreshing it first if it's expired. A command can still race a
// token that expires mid-flight (real 401, not just our stored expiry
// estimate) — on that one case only, refresh once and retry the same
// command rather than surfacing a spurious failure to the person.
import { createClient } from '@supabase/supabase-js';
import { getProvider } from '../../../../../lib/providers.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// MELCloud Home commands — one air-conditioner unit per device row.
async function applyMelcloudCommand(provider, accessToken, device, type, value) {
  switch (type) {
    case 'power':
      return provider.setPower(accessToken, device.external_id, !!value);
    case 'set_temperature':
      return provider.setTemperature(accessToken, device.external_id, value);
    case 'mode':
      return provider.setMode(accessToken, device.external_id, value);
    case 'fan_speed':
      return provider.setFanSpeed(accessToken, device.external_id, value);
    case 'horizontal_vane':
      return provider.setHorizontalVane(accessToken, device.external_id, value);
    case 'refresh':
      return; // no-op — the point of this command is just the re-fetch below
    default:
      throw new Error(`unknown melcloud_home command type: ${type}`);
  }
}

// Vaillant commands — split by device_type since a heating zone and a
// domestic-hot-water tank take different commands.
async function applyVaillantCommand(provider, accessToken, device, type, value) {
  if (device.device_type === 'heating_zone') {
    switch (type) {
      case 'zone_mode':
        return provider.setZoneMode(accessToken, device.external_id, value);
      case 'zone_setpoint':
        return provider.setZoneSetpoint(accessToken, device.external_id, value);
      case 'quick_veto':
        return provider.quickVetoZone(accessToken, device.external_id, value);
      case 'cancel_quick_veto':
        return provider.cancelQuickVetoZone(accessToken, device.external_id);
      case 'refresh':
        return;
      default:
        throw new Error(`unknown vaillant heating_zone command type: ${type}`);
    }
  }
  if (device.device_type === 'domestic_hot_water') {
    switch (type) {
      case 'dhw_mode':
        return provider.setDhwMode(accessToken, device.external_id, value);
      case 'dhw_setpoint':
        return provider.setDhwSetpoint(accessToken, device.external_id, value);
      case 'dhw_boost':
        return provider.boostDhw(accessToken, device.external_id);
      case 'dhw_cancel_boost':
        return provider.cancelDhwBoost(accessToken, device.external_id);
      case 'refresh':
        return;
      default:
        throw new Error(`unknown vaillant domestic_hot_water command type: ${type}`);
    }
  }
  throw new Error(`unknown vaillant device_type: ${device.device_type}`);
}

// Shelly commands — split by device_type since a switch, dimmer, and
// cover each take different parameters. device_type values are
// 'shelly_switch' / 'shelly_dimmer' / 'shelly_cover' (see
// providers/shelly/index.js's toSwitchDevice/toDimmerDevice/toCoverDevice).
async function applyShellyCommand(provider, accessToken, device, type, value) {
  if (device.device_type === 'shelly_switch') {
    switch (type) {
      case 'power':
        return provider.setSwitch(accessToken, device.external_id, !!value);
      case 'refresh':
        return;
      default:
        throw new Error(`unknown shelly_switch command type: ${type}`);
    }
  }
  if (device.device_type === 'shelly_dimmer') {
    switch (type) {
      case 'power':
        return provider.setDimmer(accessToken, device.external_id, { on: !!value });
      case 'brightness':
        return provider.setDimmer(accessToken, device.external_id, { on: true, brightness: value });
      case 'refresh':
        return;
      default:
        throw new Error(`unknown shelly_dimmer command type: ${type}`);
    }
  }
  if (device.device_type === 'shelly_cover') {
    switch (type) {
      case 'cover_action':
        return provider.setCoverAction(accessToken, device.external_id, value);
      case 'cover_position':
        return provider.setCoverPosition(accessToken, device.external_id, value);
      case 'refresh':
        return;
      default:
        throw new Error(`unknown shelly_cover command type: ${type}`);
    }
  }
  throw new Error(`unknown shelly device_type: ${device.device_type}`);
}

async function applyCommand(providerName, providerClient, accessToken, device, type, value) {
  if (providerName === 'melcloud_home') return applyMelcloudCommand(providerClient, accessToken, device, type, value);
  if (providerName === 'vaillant') return applyVaillantCommand(providerClient, accessToken, device, type, value);
  if (providerName === 'shelly') return applyShellyCommand(providerClient, accessToken, device, type, value);
  throw new Error(`unknown provider: ${providerName}`);
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
    .select('id, household_id, provider, device_type, external_id')
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

  let providerName, providerClient, server;
  try {
    ({ client: providerClient, server } = getProvider(device.provider));
    providerName = device.provider;
  } catch (err) {
    return Response.json({ error: 'unknown', message: String(err?.message || err) }, { status: 500 });
  }

  const admin = server.adminClient();

  let accessToken;
  try {
    accessToken = await server.getValidAccessToken(admin, device.household_id, device.provider);
  } catch (err) {
    console.error('getValidAccessToken() failed', err?.message || err, err?.stack);
    const friendly = server.toFriendlyError(err);
    return Response.json({ error: friendly.code, message: friendly.message }, { status: 409 });
  }

  try {
    await applyCommand(providerName, providerClient, accessToken, device, body.type, body.value);
  } catch (err) {
    if (String(err?.message) === 'TOKEN_EXPIRED') {
      // Our stored expiry said this token was still good, but the provider
      // disagreed (clock skew, or a token revoked out-of-band) — refresh
      // once and retry the same command before giving up.
      try {
        accessToken = await server.getValidAccessToken(admin, device.household_id, device.provider);
        await applyCommand(providerName, providerClient, accessToken, device, body.type, body.value);
      } catch (retryErr) {
        console.error('command retry after TOKEN_EXPIRED failed', retryErr?.message || retryErr, retryErr?.stack);
        const friendly = server.toFriendlyError(retryErr);
        return Response.json({ error: friendly.code, message: friendly.message }, { status: 502 });
      }
    } else {
      console.error('applyCommand() failed', err?.message || err, err?.stack);
      const friendly = server.toFriendlyError(err);
      return Response.json({ error: friendly.code, message: friendly.message }, { status: 502 });
    }
  }

  // Immediate refresh — re-fetch real state rather than trusting the
  // command call (most providers' control responses have nothing useful to
  // trust anyway).
  try {
    // Shelly's getDevice() needs the device_type too (a bare externalId
    // doesn't say whether to parse it as a switch/dimmer/cover status) —
    // see providers/shelly/index.js's getDevice() doc comment.
    const fresh =
      providerName === 'shelly'
        ? await providerClient.getDevice(accessToken, device.external_id, device.device_type)
        : await providerClient.getDevice(accessToken, device.external_id);
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
