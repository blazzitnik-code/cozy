# Cožy — Koledarko: freebusy prek ICS naročnine: navodila za Claude Code

## Kontekst

Preberi najprej `CLAUDE.md`. Gradimo **Koledarko fazo 2, del 1**: vsak član gospodinjstva poveže svoj zunanji koledar (Google ALI Outlook — ali karkoli drugega, kar zna izvoziti ICS) prek "skrivnega" ICS naslova, aplikacija ga periodično prebere in v Koledarku prikaže **samo zasedene bloke drugega člana** (brez naslovov/podrobnosti dogodkov).

Zavestno **NE** uporabljamo obstoječega Google OAuth "Connect calendar" flowa (glej `components/AppShell.js:220-266`, `lib/hooks.js:554-657` — `saveConnection`/`saveEvents`) — ta je Google-only in `saveEvents` je nikoli poklican mrtev kod. ICS pristop je izbran namesto njega, ker:

1. Dela za Google IN Outlook (in katerikoli ponudnik z ICS izvozom) z isto kodo — rešuje "Outlook je težji, freebusy je Google-to-Google" oviro iz backloga.
2. Ne rabi OAuth/token refresh kompleksnosti niti per-provider API integracije.
3. Server (edge function) prebere celoten ICS, a v bazo shrani SAMO start/end časovne bloke — naslovi/opisi dogodkov se zavržejo pred shranjevanjem. To je pravi privacy boundary, ne glede na to, ali izvožen ICS vsebuje polne podrobnosti (Google) ali je ponudnik že sam ponudil "samo prosto/zasedeno" izvoz (Outlook "Availability only"). Partner nikoli ne vidi ne ICS naslova ne vsebine dogodkov, samo bloke.

Star `calendar_connections`/Google-connect UI lahko za zdaj ostane (ni v poti), a je smiselno kandidat za odstranitev v ločenem koraku, ko je ta feature potrjen — glej Backlog spodaj.

Naredi po korakih, `npm run build` po vsakem večjem koraku.

---

## KORAK 1: Supabase migracija

Dve tabeli — ločeno **privaten vir** (lasten ICS URL) od **skupnih izračunanih blokov** (kar vidi partner). To se namerno razlikuje od `calendar_connections`, kjer lahko danes vsak član gospodinjstva bere surov token drugega (dokumentiran tech debt) — tu te napake ne ponavljamo.

```sql
-- Zaseben vir: samo lastnik lahko bere/piše svoj ICS URL.
create table if not exists public.calendar_freebusy_sources (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  label          text,                 -- "Google", "Outlook služba" ipd., opcijsko
  ics_url        text not null,
  last_synced_at timestamptz,
  last_error     text,
  created_at     timestamptz not null default now(),
  unique (user_id, ics_url)
);

alter table public.calendar_freebusy_sources enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'calendar_freebusy_sources' and policyname = 'Owner manages own freebusy sources') then
    create policy "Owner manages own freebusy sources" on public.calendar_freebusy_sources
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid() and public.is_household_member(household_id));
  end if;
end $$;

grant select, insert, update, delete on public.calendar_freebusy_sources to authenticated;
grant all on public.calendar_freebusy_sources to service_role;

create index if not exists calendar_freebusy_sources_household_idx on public.calendar_freebusy_sources (household_id);

-- Skupni izračunani bloki: cel household jih bere, piše samo service_role (edge function).
create table if not exists public.calendar_busy_blocks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  source_id    uuid references public.calendar_freebusy_sources(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.calendar_busy_blocks enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'calendar_busy_blocks' and policyname = 'Household members read busy blocks') then
    create policy "Household members read busy blocks" on public.calendar_busy_blocks
      for select to authenticated
      using (public.is_household_member(household_id));
  end if;
end $$;

grant select on public.calendar_busy_blocks to authenticated;
grant all on public.calendar_busy_blocks to service_role;

create index if not exists calendar_busy_blocks_household_range_idx
  on public.calendar_busy_blocks (household_id, starts_at, ends_at);

-- Realtime — da se bloki pojavijo brez ročnega refresha po sync-u.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'calendar_busy_blocks'
  ) then
    alter publication supabase_realtime add table public.calendar_busy_blocks;
  end if;
end $$;
```

`with check` na virih preveri `is_household_member`, da ne moreš vstaviti vira za household, kjer nisi član — `using` ostane strogo `user_id = auth.uid()`, ker je to edini stolpec ki šteje za branje (partner nikoli ne sme SELECT-ati `ics_url`).

---

## KORAK 2: Edge function `sync-freebusy`

Nova mapa `supabase/functions/sync-freebusy/`, ista struktura kot `send-push` (glej `index.ts` tam za konvencijo: `Deno.serve`, shared-secret header, service-role client, `EdgeRuntime.waitUntil` za async delo, `verify_jwt = false` v `config.toml`).

```typescript
// sync-freebusy — reads each connected member's private ICS URL, extracts
// busy blocks for a rolling window, discards all event detail, and upserts
// only start/end times into calendar_busy_blocks. This IS the privacy
// boundary — nothing past DTSTART/DTEND ever leaves this function.
//
// Called on a schedule by pg_cron via pg_net (same pattern as the
// cozy-daily-digest push job), authenticated with SYNC_FN_SECRET.
//
// Env (supabase/functions/.env locally, `npx supabase secrets set` in prod):
//   SYNC_FN_SECRET — shared secret, must match the sync_fn_secret Vault entry

import ICAL from 'npm:ical.js@2';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SYNC_FN_SECRET = Deno.env.get('SYNC_FN_SECRET')!;
const WINDOW_DAYS = 60; // how far ahead to expand recurring events

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

interface SourceRow {
  id: string;
  household_id: string;
  user_id: string;
  ics_url: string;
}

function extractBusyBlocks(icsText: string, rangeStart: Date, rangeEnd: Date) {
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const blocks: { start: Date; end: Date }[] = [];

  for (const vevent of comp.getAllSubcomponents('vevent')) {
    const event = new ICAL.Event(vevent);
    // Skip events explicitly marked as not blocking time.
    const transp = vevent.getFirstPropertyValue('transp');
    if (transp === 'TRANSPARENT') continue;

    if (event.isRecurring()) {
      const iter = event.iterator();
      let next;
      while ((next = iter.next())) {
        const occStart = next.toJSDate();
        if (occStart > rangeEnd) break;
        const occEnd = new Date(occStart.getTime() + event.duration.toSeconds() * 1000);
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
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const icsText = await res.text();

    const now = new Date();
    const rangeEnd = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);
    const blocks = extractBusyBlocks(icsText, now, rangeEnd);

    // Replace this source's window wholesale — simplest correct approach,
    // avoids diffing recurring-event expansions.
    await supabase.from('calendar_busy_blocks').delete().eq('source_id', source.id);
    if (blocks.length) {
      await supabase.from('calendar_busy_blocks').insert(
        blocks.map((b) => ({
          household_id: source.household_id,
          user_id: source.user_id,
          starts_at: b.start.toISOString(),
          ends_at: b.end.toISOString(),
          source_id: source.id,
        })),
      );
    }
    await supabase
      .from('calendar_freebusy_sources')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', source.id);
  } catch (err) {
    console.error('freebusy sync failed', source.id, err);
    await supabase
      .from('calendar_freebusy_sources')
      .update({ last_error: String(err) })
      .eq('id', source.id);
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-sync-secret') !== SYNC_FN_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  const { data: sources } = await supabase.from('calendar_freebusy_sources').select('*');
  const work = Promise.all((sources ?? []).map(syncOne)).catch((err) =>
    console.error('sync-freebusy batch failed', err),
  );
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return new Response(null, { status: 202 });
});
```

Pripiši v `config.toml` enak vzorec kot za `send-push` (`verify_jwt = false` za to funkcijo). Preveri, da `npm:ical.js` deluje v Supabase Edge Runtime lokalno (`npx supabase functions serve sync-freebusy`) preden greš naprej — če ne, alternativa je `jsr:@rgrannell/ical` ali ročni minimalni parser samo za `DTSTART`/`DTEND`/`RRULE` (manj robustno, izogibaj se če ni nujno).

## KORAK 3: pg_cron scheduling

Nova migracija (ali dodatek k obstoječi), po vzoru `cozy-daily-digest`:

```sql
select cron.schedule(
  'cozy-freebusy-sync',
  '*/30 * * * *',  -- vsakih 30 min; ICS viri se pri ponudnikih sicer osvežujejo redkeje
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'sync_fn_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sync_fn_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

`sync_fn_url`/`sync_fn_secret` gresta v Vault po istem vzorcu kot `push_fn_url`/`push_fn_secret` (glej `supabase/snippets/setup-push-vault.sql` za predlogo) — dodaj `supabase/snippets/setup-freebusy-vault.sql` analogno.

## KORAK 4: nastavitve — dodaj/uredi ICS vir

V Settings modalu (`AppShell.js`), nova sekcija poleg obstoječega "Connect Google Calendar":

- Naslov "Deli zasedenost" + kratka razlaga ("partner bo videl samo kdaj si zaseden/a, ne kaj počneš")
- Seznam obstoječih virov (moj `useHouseholdTable`-style hook nad `calendar_freebusy_sources`, filtriran na `user_id = trenutni uporabnik` — partner tega seznama sploh ne sme videti, ne samo vsebine): label (ali "ICS vir") + status ("Sinhronizirano pred X" / "Napaka: ..." iz `last_error`) + gumb "Odstrani"
- Gumb "Dodaj vir" → mini obrazec: opcijski `label` text input + `ics_url` text input + "Shrani"
- Kratka pomoč (link ali expandable besedilo) kje najti ICS naslov:
  - **Google Calendar**: Nastavitve → izbran koledar → "Secret address in iCal format"
  - **Outlook**: Koledar → Deli → "Publish a calendar" → izberi "Availability only" ali "Limited details" → kopiraj ICS povezavo

Nov hook v `lib/hooks.js`: `useFreebusySources(householdId, userId)` (CRUD nad lastnimi viri) + `useBusyBlocks(householdId, rangeStart, rangeEnd)` (household-wide select, realtime).

## KORAK 5: prikaz v Koledarku

V `CalendarModule.js`, Week/Agenda pogledih: nad/pod obstoječimi `assigned_to`-obarvanimi Cožy dogodki dodaj drugo vizualno plast za busy bloke iz `calendar_busy_blocks` (`useBusyBlocks`):

- Vizualno jasno ločeno od pravih Cožy dogodkov — brez naslova, samo npr. šrafiran/pikčast pill v barvi tiste osebe (`PERSON` map iz `lib/utils.js`) z labelo "Zaseden/a" (ne klikljivo, ni detail modala — podatka enostavno ni).
- Month view lahko busy bloke izpusti (preveč gosto) — samo Week/Agenda.
- Prazno stanje: če član nima nobenega vira, se preprosto ne prikaže nič dodatnega (brez placeholderja/napake).

---

## i18n

Novi ključi (SL + EN), namespace `Calendar` ali nov `Freebusy`:

```
delizasedenost: "Deli zasedenost" / "Share availability"
delizasedenostOpis: "Partner bo videl samo kdaj si zaseden/a, ne kaj počneš" / "Your partner will only see when you're busy, not what you're doing"
dodajVir: "Dodaj vir" / "Add source"
icsNaslov: "ICS naslov" / "ICS address"
oznaka: "Oznaka (opcijsko)" / "Label (optional)"
sinhroniziranoPred: "Sinhronizirano pred {time}" / "Synced {time} ago"
napakaSinhronizacije: "Napaka: {error}" / "Error: {error}"
odstraniVir: "Odstrani" / "Remove"
zasedenA: "Zaseden/a" / "Busy"
kjeNajdemIcs: "Kje najdem to?" / "Where do I find this?"
```

---

## Pravila (CLAUDE.md)

- RLS vedno prek `public.is_household_member(household_id)`; tu dodatno strožje — `calendar_freebusy_sources` select samo `user_id = auth.uid()`, NE household-wide (glej `calendar_connections`-tech-debt precedens, ki ga tu namerno ne ponavljamo).
- Hooks vedno na vrhu komponent.
- Optimistic UI kjer smiselno (dodajanje/brisanje vira); sam sync je async v ozadju, ni optimističen.
- Light + dark tema na busy-block vizualu.
- Slovenščina v UI stringih (ne hrvaščina).
- Edge function po istem vzorcu kot `send-push`: shared-secret header, `verify_jwt = false`, `EdgeRuntime.waitUntil`.
- Nikoli ne shrani/loguj vsebine ICS dogodkov (naslov/opis/lokacija) — samo časovne meje.

## Testni checklist

- [ ] Dodam Google "secret ICS" URL → po sync-u (počakaj do 30 min ali ročno pokliči edge function) se pojavijo busy bloki
- [ ] Dodam Outlook "Availability only" ICS URL → isto
- [ ] Ponavljajoč se dogodek (weekly meeting) se pravilno razširi v posamezne bloke znotraj 60-dnevnega okna
- [ ] Partner NE vidi mojega ICS naslova (preveri prek Supabase Studio kot partner-user, ne samo v UI)
- [ ] Partner VIDI moje busy bloke v Koledarku, brez naslova/podrobnosti
- [ ] Napačen/nedosegljiv ICS URL → `last_error` se nastavi, UI to pokaže, aplikacija se ne sesuje
- [ ] Odstranitev vira počisti pripadajoče busy bloke (cascade prek `source_id`)
- [ ] Realtime: po ročnem sync-u se bloki pojavijo brez ročnega refresha strani
- [ ] Light + dark tema OK
- [ ] npm run build brez napak

## Backlog (NE zdaj)

- "Kdaj sva prosta" tedenski pregled (presek prostih terminov obeh) — naravna nadgradnja, a ločen feature
- Ročni "Sync now" gumb v UI (za zdaj samo cron vsakih 30 min)
- Konfigurabilen WINDOW_DAYS/interval per household
- Odstranitev starega Google-OAuth "Connect calendar" flowa (`calendar_connections`, `saveConnection`/`saveEvents` mrtev kod) — počakaj da je ICS pot potrjena in v produkciji, nato počisti v ločenem koraku, da diff ostane pregleden
