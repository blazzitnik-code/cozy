// sync-home-devices — discovers and polls home devices from each connected
// provider account and writes normalized state into home_devices. Unlike
// sync-freebusy (many manually-pasted-per-user ICS sources), a MELCloud
// Home account exposes its own device list via /context — there's no
// separate "add device" UI step, discovery IS the sync.
//
// Single-household assumption: Cožy is explicitly scoped to one household
// per deployment (see CLAUDE.md), so newly-discovered devices are attached
// to the one household on record rather than requiring a per-account
// household selection step. Revisit only if that scope ever changes.
//
// Called on a schedule by pg_cron via pg_net (same shape as
// sync-freebusy/cozy-daily-digest), authenticated with the shared
// MELCLOUD_FN_SECRET header (verify_jwt = false in config.toml).
//
// MOCK PHASE NOTE: this function's provider logic is a self-contained mock
// (Deno can't directly import the Next.js app's providers/melcloud-home/
// without a shared package), mirroring providers/melcloud-home/index.js
// used by the Next.js command API route. Both get replaced by the same
// real MELCloud Home client when auth lands — see
// NAPRAVKO_MELCLOUD_IMPLEMENTATION.md.
//
// Env (supabase/functions/.env locally, `npx supabase secrets set` in prod):
//   MELCLOUD_FN_SECRET — shared secret, must match the melcloud_fn_secret Vault entry

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MELCLOUD_FN_SECRET = Deno.env.get('MELCLOUD_FN_SECRET')!;

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// --- mocked MELCloud device list, kept in sync with providers/melcloud-home/index.js ---
function mockGetDevices() {
  return [
    {
      externalId: 'mock-ata-unit-1',
      name: 'Klima',
      room: 'Dnevna soba',
      state: {
        online: true,
        power: true,
        currentTemperature: 22.4,
        targetTemperature: 22.0,
        mode: 'cool',
        fanSpeed: 'auto',
        vaneHorizontal: 'both',
        wifiSignal: 'good',
        outdoorTemperature: 26,
        error: null,
      },
      capabilities: {
        modes: ['cool', 'heat', 'auto', 'dry', 'fan'],
        fanSpeeds: ['auto', '1', '2', '3', '4', '5'],
        hasHorizontalVane: true,
        hasVerticalVane: false,
        minTemperature: 16,
        maxTemperature: 31,
        halfDegreeIncrements: true,
      },
    },
  ];
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== MELCLOUD_FN_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const { data: household, error: hErr } = await supabase
    .from('households')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (hErr || !household) {
    console.error('no household to attach discovered devices to', hErr);
    return new Response('internal error', { status: 500 });
  }

  const work = (async () => {
    // Real provider: await getDevices() against MELCloud's /context. Mocked:
    // synchronous fake list, still awaited so this doesn't change shape when
    // auth lands.
    let devices;
    try {
      devices = await Promise.resolve(mockGetDevices());
    } catch (err) {
      console.error('provider.getDevices() failed', err);
      return;
    }

    for (const d of devices) {
      const { error } = await supabase.from('home_devices').upsert(
        {
          household_id: household.id,
          provider: 'melcloud_home',
          device_type: 'air_conditioner',
          external_id: d.externalId,
          name: d.name,
          room: d.room,
          state: d.state,
          capabilities: d.capabilities,
          last_synced_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: 'household_id,provider,external_id' },
      );
      if (error) console.error('home device upsert failed for', d.externalId, error);
    }
  })().catch((err) => console.error('sync-home-devices batch failed', err));

  // Respond 202 immediately (pg_net times out at 3 s for the trigger path;
  // this job also sets a generous 25 s timeout on the caller side) and
  // finish syncing in the background — same pattern as sync-freebusy.
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return new Response(null, { status: 202 });
});
