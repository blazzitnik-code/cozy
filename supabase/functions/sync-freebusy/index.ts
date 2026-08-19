// sync-freebusy — reads each connected member's private ICS URL, extracts
// busy blocks for a rolling window, and writes ONLY start/end times into
// calendar_busy_blocks. This IS the privacy boundary: event titles,
// descriptions, and locations are parsed in memory here and then discarded
// — they never reach the database, so a household member can never see a
// partner's event details, only "busy" blocks.
//
// Called on a schedule by pg_cron via pg_net (same shape as the
// cozy-daily-digest push job in supabase/migrations/20260716234051_push_notifications.sql),
// authenticated with the shared FREEBUSY_FN_SECRET header (verify_jwt =
// false in config.toml).
//
// Env (supabase/functions/.env locally, `npx supabase secrets set` in prod):
//   FREEBUSY_FN_SECRET — shared secret, must match the freebusy_fn_secret Vault entry

import ICAL from 'npm:ical.js@2';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const FREEBUSY_FN_SECRET = Deno.env.get('FREEBUSY_FN_SECRET')!;
const WINDOW_DAYS = 60; // how far ahead to expand recurring events

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface SourceRow {
  id: string;
  household_id: string;
  user_id: string;
  ics_url: string;
}

interface BusyBlock {
  start: Date;
  end: Date;
}

// Parses raw ICS text and returns busy blocks (start/end only) that
// intersect [rangeStart, rangeEnd]. Recurring events are expanded via
// ical.js's built-in RRULE iterator. Events explicitly marked TRANSPARENT
// (i.e. "don't show me as busy") are skipped.
function extractBusyBlocks(icsText: string, rangeStart: Date, rangeEnd: Date): BusyBlock[] {
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const blocks: BusyBlock[] = [];

  for (const vevent of comp.getAllSubcomponents('vevent')) {
    const transp = vevent.getFirstPropertyValue('transp');
    if (transp === 'TRANSPARENT') continue;

    const event = new ICAL.Event(vevent);

    if (event.isRecurring()) {
      const iter = event.iterator();
      const durationMs = event.duration.toSeconds() * 1000;
      let next: ICAL.Time | null;
      // eslint-disable-next-line no-cond-assign
      while ((next = iter.next())) {
        const occStart = next.toJSDate();
        if (occStart > rangeEnd) break;
        const occEnd = new Date(occStart.getTime() + durationMs);
        if (occEnd >= rangeStart) blocks.push({ start: occStart, end: occEnd });
      }
    } else {
      const start = event.startDate.toJSDate();
      const end = event.endDate.toJSDate();
      if (end >= rangeStart && start <= rangeEnd) blocks.push({ start, end });
    }
  }
  return blocks;
}

async function syncOne(source: SourceRow) {
  try {
    const res = await fetch(source.ics_url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const icsText = await res.text();

    const now = new Date();
    const rangeEnd = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);
    const blocks = extractBusyBlocks(icsText, now, rangeEnd);

    // Replace this source's blocks wholesale — simplest correct approach,
    // avoids diffing recurring-event expansions across runs.
    await supabase.from('calendar_busy_blocks').delete().eq('source_id', source.id);
    if (blocks.length) {
      const { error } = await supabase.from('calendar_busy_blocks').insert(
        blocks.map((b) => ({
          household_id: source.household_id,
          user_id: source.user_id,
          starts_at: b.start.toISOString(),
          ends_at: b.end.toISOString(),
          source_id: source.id,
        })),
      );
      if (error) throw error;
    }

    await supabase
      .from('calendar_freebusy_sources')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', source.id);
  } catch (err) {
    console.error('freebusy sync failed for source', source.id, err);
    await supabase
      .from('calendar_freebusy_sources')
      .update({ last_error: String(err instanceof Error ? err.message : err) })
      .eq('id', source.id);
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== FREEBUSY_FN_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  const { data: sources, error } = await supabase.from('calendar_freebusy_sources').select('*');
  if (error) {
    console.error('failed to list freebusy sources', error);
    return new Response('internal error', { status: 500 });
  }

  // Respond 202 immediately (pg_net times out at 3 s for the trigger path;
  // this job also sets a generous 25 s timeout on the caller side) and
  // finish syncing in the background.
  const work = Promise.all((sources as SourceRow[]).map(syncOne)).catch((err) =>
    console.error('sync-freebusy batch failed', err),
  );
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return new Response(null, { status: 202 });
});
