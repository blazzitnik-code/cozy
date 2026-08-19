# Cožy — Koledarko (Calendar) faza 1: navodila za Claude Code

## Kontekst

Preberi najprej `COZY_CONTEXT.md`. Gradimo **Koledarko** — koledarski modul, faza 1: samo ročni Cožy dogodki (BREZ Google/Outlook integracije — ta je v backlogu).

Modul ima:

- 3 poglede: **Teden** (default), **Agenda**, **Mesec** — preklop s segment controlom + horizontal swipe za naslednji/prejšnji teden
- Ročno dodajanje dogodkov: naslov + datum + čas (od–do ali cel dan) + oseba + tip/ikona + opcijska opomba
- Ponavljanje: enkratno / tedensko / mesečno / letno / custom (vsak N-ti teden)
- **Uredi/izbriši** vpliva na cel niz; **preskoči** izpusti samo eno ponovitev (prek `skip_dates`)
- Vsi člani vidijo vse dogodke
- Barve po osebi (`household_members.color` je že nastavljen)
- Tipi z ikonami + filter po tipu
- "Prosta oba" bloki (računano iz ročnih eventov v tednu)
- Home "SLEDI" placeholder → poveži s pravimi podatki

Naredi po korakih, `npm run build` po vsakem večjem koraku.

---

## KORAK 1: Supabase SQL (uporabnik zažene ročno)

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'other',
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES auth.users(id),
  note TEXT,
  recurrence TEXT DEFAULT 'once',
  recurrence_interval INTEGER DEFAULT 1,
  skip_dates DATE[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Household members can view events"
  ON calendar_events FOR SELECT
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Household members can insert events"
  ON calendar_events FOR INSERT
  WITH CHECK (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Household members can update events"
  ON calendar_events FOR UPDATE
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Household members can delete events"
  ON calendar_events FOR DELETE
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
```

Opomba: `household_members.id` je INTEGER; `assigned_to` in `created_by` sta UUID (auth.users).

### Polja razložena

- `event_type`: `sluzba | sport | dom | socialno | zdravje | sola | potovanje | opravki | other`
- `recurrence`: `once | weekly | monthly | yearly | custom`
- `recurrence_interval`: za `custom` = vsak N-ti teden (npr. 2 = vsak drugi teden). Za ostale ignoriran.
- `skip_dates`: datumi ki se pri generiranju ponovitev izpustijo (preskoči funkcija)
- `assigned_to`: NULL = "vsi" (družinski dogodek)

---

## KORAK 2: Tipi dogodkov — util

Ustvari util (npr. v `lib/calendar.js` ali znotraj komponente) z definicijo tipov:

```javascript
export const EVENT_TYPES = {
  sluzba: { emoji: '💼', sl: 'Služba', en: 'Work' },
  sport: { emoji: '🏃', sl: 'Šport', en: 'Sport' },
  dom: { emoji: '🏠', sl: 'Dom', en: 'Home' },
  socialno: { emoji: '🎉', sl: 'Socialno', en: 'Social' },
  zdravje: { emoji: '🏥', sl: 'Zdravje', en: 'Health' },
  sola: { emoji: '🎓', sl: 'Šola', en: 'School' },
  potovanje: { emoji: '✈️', sl: 'Potovanje', en: 'Travel' },
  opravki: { emoji: '🗑️', sl: 'Opravki', en: 'Errands' },
  other: { emoji: '📌', sl: 'Drugo', en: 'Other' },
};
```

---

## KORAK 3: lib/hooks.js — useCalendarEvents

Hook naloži surove evente in ponudi funkcijo `expandEvents(rangeStart, rangeEnd)` ki generira konkretne ponovitve za prikazani razpon (upoštevajoč `recurrence` in `skip_dates`).

```javascript
// ─── CALENDAR EVENTS ───
export function useCalendarEvents(householdId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('calendar_events').select('*').eq('household_id', householdId);
    if (data) setEvents(data);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel('calendar_events-' + householdId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => fetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetch, householdId]);

  const addEvent = async (ev) => {
    await supabase.from('calendar_events').insert([{ ...ev, household_id: householdId }]);
  };
  const updateEvent = async (id, updates) => {
    await supabase.from('calendar_events').update(updates).eq('id', id);
  };
  const deleteEvent = async (id) => {
    await supabase.from('calendar_events').delete().eq('id', id);
  };
  // Preskoči eno ponovitev: dodaj datum v skip_dates
  const skipOccurrence = async (id, dateStr) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const skips = [...(ev.skip_dates || []), dateStr];
    await supabase.from('calendar_events').update({ skip_dates: skips }).eq('id', id);
  };

  return { events, loading, addEvent, updateEvent, deleteEvent, skipOccurrence, refetch: fetch };
}
```

### expandEvents util (ločena čista funkcija)

Generira instance za razpon `[start, end]` (oba Date). Vsaka instanca: `{ ...event, _date: 'YYYY-MM-DD' }`.

Pravila:

- `once`: samo če `event_date` pade v razpon
- `weekly`: vsak teden na isti dan v tednu od `event_date` naprej
- `monthly`: vsak mesec na isti dan v mesecu
- `yearly`: vsako leto isti dan/mesec
- `custom`: vsak `recurrence_interval`-ti teden od `event_date`
- Vedno preskoči datume iz `skip_dates`
- Ne generiraj instanc pred `event_date`

```javascript
export function expandEvents(events, rangeStart, rangeEnd) {
  const out = [];
  const toStr = (d) => d.toISOString().slice(0, 10);
  const startDay = new Date(rangeStart);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(rangeEnd);
  endDay.setHours(23, 59, 59, 999);

  for (const ev of events) {
    const base = new Date(ev.event_date + 'T00:00:00');
    const skips = new Set(ev.skip_dates || []);

    const pushIf = (d) => {
      if (d < startDay || d > endDay) return;
      if (d < new Date(ev.event_date + 'T00:00:00')) return;
      const ds = toStr(d);
      if (skips.has(ds)) return;
      out.push({ ...ev, _date: ds });
    };

    if (ev.recurrence === 'once') {
      pushIf(base);
    } else if (ev.recurrence === 'weekly' || ev.recurrence === 'custom') {
      const step = ev.recurrence === 'custom' ? ev.recurrence_interval || 1 : 1;
      // začni od prvega ponavljanja ki je >= startDay
      let d = new Date(base);
      while (d <= endDay) {
        pushIf(d);
        d = new Date(d);
        d.setDate(d.getDate() + 7 * step);
      }
    } else if (ev.recurrence === 'monthly') {
      let d = new Date(base);
      while (d <= endDay) {
        pushIf(d);
        d = new Date(d);
        d.setMonth(d.getMonth() + 1);
      }
    } else if (ev.recurrence === 'yearly') {
      let d = new Date(base);
      while (d <= endDay) {
        pushIf(d);
        d = new Date(d);
        d.setFullYear(d.getFullYear() + 1);
      }
    }
  }
  // sortiraj po datumu, nato po start_time (all_day prvi)
  out.sort((a, b) => {
    if (a._date !== b._date) return a._date < b._date ? -1 : 1;
    if (a.all_day && !b.all_day) return -1;
    if (!a.all_day && b.all_day) return 1;
    return (a.start_time || '') < (b.start_time || '') ? -1 : 1;
  });
  return out;
}
```

Za performance pri `weekly`/`custom` lahko skočiš na prvo instanco blizu `startDay` namesto od `base`, ampak zgornje deluje za razumne razpone (teden/mesec). Ne optimiziraj prezgodaj.

---

## KORAK 4: components/CalendarApp.js — nova komponenta

Ustvari `components/CalendarApp.js`. Props: `{ user, householdId, members, lang, isDark }`.

Struktura:

- **Header**: naslov "Koledarko" (SL) / "Calzy" (EN) + mesec/leto. Desno: filter gumb (Lucide `Filter`) + dodaj gumb (Lucide `Plus`, oranžni). **Klik na naslov → home** (isti pattern kot ostali screeni).
- **Segment control**: Teden / Agenda / Mesec (SL) — Week / Agenda / Month (EN). Default Teden.
- **Filter**: mnogoizbirni tipi (EVENT_TYPES). Privzeto vsi vklopljeni. Ko je filter aktiven, prikaži samo izbrane tipe.

### Pogled: Teden (default)

- Vrstica 7 dni (PON–NED), današnji/izbrani označen (oranžno). Pod dnevi pike v barvi oseb če ima dan evente.
- **Swipe** levo/desno menja teden (touch: zaznaj horizontalni drag > 50px). Tudi puščici opcijsko.
- Pod tem: seznam eventov za IZBRANI dan (privzeto danes), grupirano:
  - Vsak event: barvni bar levo (barva osebe, `members.color`), telo s tipom emoji + čas + oseba, naslov, opcijska opomba/recurrence oznaka (🔁).
  - Med eventi izračunaj "prosta oba" bloke (glej KORAK 6).
- Če dan nima eventov: prazno stanje ("Ni dogodkov").

### Pogled: Agenda

- Seznam prihajajočih dni z eventi (od danes naprej, ~14 dni), grupirano po dnevih. Brez mreže.
- Vsak dan: label (Danes / Jutri / dan + datum) + eventi.

### Pogled: Mesec

- Klasična mesečna mreža (7 stolpcev, 5-6 vrstic). Vsaka celica: številka dneva + do 3 pike (barve oseb) če ima evente. Klik na dan → preklopi na Teden pogled s tem dnem izbranim (ali prikaži evente pod mrežo).
- Swipe menja mesec.

### Add/Edit event modal

Bottom sheet modal (isti stil kot ostali modali v appu):

- Naslov (input)
- Tip: pills z EVENT_TYPES (emoji + ime), izbran označen
- Datum (date input) + Od (time) + Do (time)
- Toggle "Cel dan" (skrije od/do)
- Oseba: izbor iz članov + "Vsi" (assigned_to = null)
- Ponovi: izbor once/weekly/monthly/yearly/custom; če custom → dodatni input za interval (vsak N-ti teden)
- Opcijska opomba (textarea)
- Gumb: "Dodaj dogodek" / "Shrani"
- Pri urejanju obstoječega: dodaj gumba "Izbriši" (cel niz) in — če je event ponavljajoč in gledaš konkretno instanco — "Preskoči ta dan" (doda `_date` v skip_dates)

### Barve oseb

- Vsak član ima `color` (hex) v `household_members`. Uporabi za barvni bar in pike. Če člana ni (assigned_to null = "vsi") uporabi nevtralno/accent barvo.
- Za "oseba" prikaz: poišči člana po `assigned_to === m.user_id`.

---

## KORAK 5: Integracija v ZmrzkoApp.js

- Import: `import CalendarApp from './CalendarApp';`
- V navigaciji (bottom nav) je Koledarko tab že prisoten (📅 / Lucide Calendar). Poveži ga da renderira `CalendarApp` ko je `appSection === 'calendar'`.
- Če trenutno Koledarko screen kaže "Connect Google Calendar" placeholder — zamenjaj z `CalendarApp` (faza 1 ročni eventi). Google connect ostane v settings za kasnejšo fazo.

```jsx
if (appSection === 'calendar')
  return <CalendarApp user={user} householdId={household.id} members={members} lang={lang} isDark={isDark} />;
```

---

## KORAK 6: "Prosta oba" računanje

Za izbrani dan (teden pogled), izračunaj proste bloke med člani:

- Zberi vse timed evente (ne all_day) tega dne za VSE člane z `assigned_to` (ne "vsi")
- Predpostavi "aktivni" del dneva npr. 08:00–22:00 (ali samo med prvim in zadnjim eventom)
- Najdi vrzeli kjer NOBEN član ni zaseden → "prosta oba/vsi"
- Prikaži kot zelene dashed bloke med eventi (kot v mocku)
- Faza 1: to deluje samo za ročno vnesene evente. To je ok — dokumentirano.

Naj bo to preprosto (interval merge). Če se izkaže kot preveč robno, prikaži samo očitne vrzeli (med koncem enega in začetkom naslednjega eventa istega/drugega člana).

---

## KORAK 7: Home "SLEDI" kartica → prave podatke

Na home page je trenutno "SLEDI" (UP NEXT) placeholder. Poveži z `useCalendarEvents`:

- Razširi evente za danes+jutri, poišči naslednji dogodek po trenutni uri
- Prikaži: naslov + čas + "čez Xh Ym"
- Pod tem naslednji dogodek dneva (če obstaja) + "Vse ›" → odpre Koledarko
- Če ni dogodkov: prijazno prazno stanje

---

## KORAK 8: i18n

Dodaj ključe (SL + EN):

```
koledarko: "Koledarko" / "Calzy"
pogledTeden: "Teden" / "Week"
pogledAgenda: "Agenda" / "Agenda"
pogledMesec: "Mesec" / "Month"
novDogodek: "Nov dogodek" / "New event"
naslovDogodka: "Naslov dogodka" / "Event title"
celDan: "Cel dan" / "All day"
oseba: "Oseba" / "Person"
vsi: "Vsi" / "Everyone"
ponovi: "Ponovi" / "Repeat"
enkratno: "Enkratno" / "Once"
tedensko: "Vsak teden" / "Weekly"
mesecno: "Vsak mesec" / "Monthly"
letno: "Vsako leto" / "Yearly"
custom: "Po meri" / "Custom"
vsakNTeden: "Vsak {n}. teden" / "Every {n} weeks"
dodajDogodek: "Dodaj dogodek" / "Add event"
preskociTaDan: "Preskoči ta dan" / "Skip this day"
izbrisiNiz: "Izbriši" / "Delete"
niDogodkov: "Ni dogodkov" / "No events"
prostaOba: "prosta oba" / "both free"
opomba: "Opomba" / "Note"
danes: "Danes" / "Today"
jutri: "Jutri" / "Tomorrow"
podrsajTeden: "podrsaj za naslednji teden" / "swipe for next week"
```

Dni v tednu in mesece uporabi prek `toLocaleDateString(lang === 'sl' ? 'sl-SI' : 'en-US', ...)`.

---

## Pravila (COZY_CONTEXT.md)

- Minimalne, kirurške spremembe — ne prepisuj celih fajlov
- Hooks vedno na vrhu komponent, ne v pogojih (React #310)
- Optimistic kjer smiselno (dodajanje eventa naj se pokaže brez čakanja — lahko prek refetch po realtime, ampak modal naj se zapre takoj)
- household_members.id je INTEGER
- Slovenščina, ne hrvaščina: "shrani", "izbriši", "uredi", "dodaj", "opravki"
- Light + dark tema na vseh novih elementih
- Klik na naslov Koledarko → home (kot ostali screeni)

## Testni checklist

- [ ] Dodaj enkraten dogodek → se pokaže v tednu + agendi
- [ ] Dodaj tedenski dogodek → se ponovi vsak teden
- [ ] Custom (vsak 2. teden) → pravilno preskakuje
- [ ] Preskoči ta dan → samo ta ponovitev izgine, ostale ostanejo
- [ ] Uredi → spremeni cel niz; Izbriši → izbriše cel niz
- [ ] Swipe levo/desno → menja teden
- [ ] Preklop Teden/Agenda/Mesec dela
- [ ] Filter po tipu skrije/pokaže evente
- [ ] Barve po osebi pravilne (bar + pike)
- [ ] "Prosta oba" bloki se pokažejo za dan z eventi
- [ ] Home "SLEDI" kaže naslednji pravi dogodek
- [ ] Klik na naslov → home
- [ ] Light + dark tema OK
- [ ] Real-time sync med napravama
- [ ] npm run build brez napak

## Faza 2 (NE zdaj — backlog)

- Google freebusy (Tina) za pravo "kdaj je zasedena" brez podrobnosti
- Outlook (B)
- "Kdaj sva prosta" čez cel teden (ne samo iz ročnih eventov)
- "ta in vsi naslednji" urejanje (override posameznih instanc)
