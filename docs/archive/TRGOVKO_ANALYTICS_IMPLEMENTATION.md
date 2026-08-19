# Cožy — Trgovko analitika + pametni predlogi: navodila za Claude Code

## Kontekst

Preberi najprej `COZY_CONTEXT.md`. Nadgrajujemo **Trgovko** (shopping) z:

1. **Pametni predlogi** — zložljiva sekcija nad seznamom: "Morda rabiš" (zapadli po razmiku) + "Pogosto kupuješ" (frekvenca). Tap = doda na seznam.
2. **Checkout modal** — ob "počisti kupljene" (konec nakupa) opcijski vnos trgovine + zneska.
3. **Analiza** — zamenja obstoječi "Purchase history" screen: povzetek analize zgoraj + seznam nakupov spodaj.

Vse iz obstoječih podatkov + dva nova stolpca. BREZ cen s spleta (nezanesljivo). Znesek vnese uporabnik opcijsko ob koncu nakupa.

Naredi po korakih, `npm run build` po vsakem večjem koraku.

---

## KORAK 1: Supabase SQL (uporabnik zažene ročno)

```sql
-- Nova stolpca na shopping_archived
ALTER TABLE shopping_archived ADD COLUMN IF NOT EXISTS store_note TEXT;
ALTER TABLE shopping_archived ADD COLUMN IF NOT EXISTS amount NUMERIC;
-- purchase_group: da vemo kateri artikli so bili kupljeni skupaj (isti checkout)
ALTER TABLE shopping_archived ADD COLUMN IF NOT EXISTS purchase_group UUID;
```

### Pojasnilo modela

- `store_note` (TEXT): dejanska trgovina kjer si kupil (Hofer/Lidl/...). Opcijski. Vnese se ob checkout. Velja za cel checkout (vsi artikli tega nakupa dobijo isti store_note).
- `amount` (NUMERIC): skupni znesek nakupa. Opcijski. Shrani se na PRVI artikel skupine (ali na vse — glej spodaj), da se v analizi ne šteje večkrat.
- `purchase_group` (UUID): ID ki povezuje artikle kupljene skupaj (isti checkout). Generira se ob "počisti kupljene". Omogoča 2-nivojski pregled (nakup → artikli) in pravilno seštevanje zneskov.

**Pomembno za amount:** da se znesek ne šteje večkrat, ga shrani SAMO na en zapis skupine (npr. prvi), ostali imajo `amount = NULL`. V analizi seštevaš `amount` (NULL se ignorira). ALI: shrani `amount` na vse zapise skupine ampak v analizi seštevaj DISTINCT po `purchase_group`. Izberi prvo (enostavnejše): amount na prvem zapisu skupine.

Obstoječi `store` (Mercator/DM/Kalia) OSTANE — to je kategorija/barva na seznamu, ločeno od `store_note`.

---

## KORAK 2: lib/hooks.js — analiza pametnih predlogov

Dodaj util funkcije ki analizirajo `shopping_archived` za predloge. Deluje na obstoječih podatkih.

```javascript
// ─── SHOPPING SUGGESTIONS ───
// Analizira arhiv nakupov za pametne predloge
export function analyzeShoppingSuggestions(archivedItems) {
  // Grupiraj po normaliziranem imenu
  const byName = {};
  for (const item of archivedItems) {
    const key = (item.name || '').trim().toLowerCase();
    if (!key) continue;
    if (!byName[key]) byName[key] = { name: item.name.trim(), dates: [], count: 0 };
    byName[key].count++;
    if (item.archived_at || item.created_at) {
      byName[key].dates.push(new Date(item.archived_at || item.created_at));
    }
  }

  const now = new Date();
  const frequent = []; // pogosto kupuješ (count >= 3)
  const due = []; // morda rabiš (zapadlo po povprečnem razmiku)

  for (const key in byName) {
    const g = byName[key];
    if (g.count < 3) continue;

    // pogosto
    frequent.push({ name: g.name, count: g.count });

    // povprečen razmik med nakupi
    if (g.dates.length >= 2) {
      g.dates.sort((a, b) => a - b);
      let totalGap = 0;
      for (let i = 1; i < g.dates.length; i++) {
        totalGap += (g.dates[i] - g.dates[i - 1]) / 864e5; // dni
      }
      const avgGap = totalGap / (g.dates.length - 1);
      const lastBuy = g.dates[g.dates.length - 1];
      const daysSince = (now - lastBuy) / 864e5;
      // zapadlo če je od zadnjega nakupa preteklo >= povprečen razmik
      if (avgGap > 0 && daysSince >= avgGap * 0.85) {
        due.push({ name: g.name, daysSince: Math.round(daysSince), avgGap: Math.round(avgGap) });
      }
    }
  }

  // sortiraj
  frequent.sort((a, b) => b.count - a.count);
  due.sort((a, b) => b.daysSince - a.daysSince);

  return {
    frequent: frequent.slice(0, 8),
    due: due.slice(0, 6),
  };
}

// ─── SHOPPING ANALYTICS ───
// Mesečna analiza iz arhiva
export function analyzeShoppingHistory(archivedItems) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Grupiraj po purchase_group (nakup)
  const groups = {};
  for (const item of archivedItems) {
    const gid = item.purchase_group || 'solo-' + item.id;
    if (!groups[gid]) groups[gid] = { items: [], amount: null, store: null, date: null };
    groups[gid].items.push(item);
    if (item.amount != null) groups[gid].amount = Number(item.amount);
    if (item.store_note) groups[gid].store = item.store_note;
    const d = new Date(item.archived_at || item.created_at);
    if (!groups[gid].date || d > groups[gid].date) groups[gid].date = d;
  }

  const allGroups = Object.values(groups);
  const monthGroups = allGroups.filter((g) => g.date >= monthStart);

  // Skupni znesek ta mesec
  const monthTotal = monthGroups.reduce((s, g) => s + (g.amount || 0), 0);
  const monthCount = monthGroups.length;
  const withAmount = monthGroups.filter((g) => g.amount != null);
  const avgBasket = withAmount.length ? monthTotal / withAmount.length : 0;
  const avgItems = monthGroups.length ? monthGroups.reduce((s, g) => s + g.items.length, 0) / monthGroups.length : 0;

  // Po trgovinah (store_note; brez → "Ostalo")
  const byStore = {};
  for (const g of monthGroups) {
    const store = g.store || 'Ostalo';
    if (!byStore[store]) byStore[store] = 0;
    byStore[store] += g.amount || 0;
  }
  const storeList = Object.entries(byStore)
    .map(([store, amount]) => ({ store, amount }))
    .sort((a, b) => b.amount - a.amount);

  // Najpogosteje kupljeno (cel arhiv)
  const nameCounts = {};
  for (const item of archivedItems) {
    const key = (item.name || '').trim();
    if (!key) continue;
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  }
  const topItems = Object.entries(nameCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    monthTotal: Math.round(monthTotal),
    monthCount,
    avgBasket: Math.round(avgBasket * 100) / 100,
    avgItems: Math.round(avgItems),
    storeList,
    topItems,
    groups: allGroups.sort((a, b) => b.date - a.date), // za seznam nakupov
  };
}
```

Opomba: preveri točna imena stolpcev v `shopping_archived` (verjetno `name`, `archived_at`, `store`). Prilagodi če se razlikujejo.

---

## KORAK 3: Pametni predlogi UI (v Trgovko screen)

Nad "Dodaj..." poljem oz. tik pod njim, dodaj **zložljivo sekcijo** predlogov:

- Naslov sekcije z gumbom za collapse/expand (npr. chevron). Stanje shrani v React state (privzeto odprto, ali si zapomni v localStorage `trgovko_suggestions_open`).
- Ko odprto:
  - **"⏳ Morda rabiš"** — čipi iz `due` (ime + "X dni"). Tap doda na seznam (obstoječa shopAdd funkcija).
  - **"🔁 Pogosto kupuješ"** — čipi iz `frequent` (samo ime). Tap doda na seznam.
- Ko zaprto: samo naslov + chevron, seznam takoj pod tem.
- Če ni dovolj podatkov (prazen due + frequent), skrij celo sekcijo.
- Čip = ime + majhen "+" ikona. Ob tapu: doda na seznam + čip lahko izgine ali se označi (da veš da si dodal).

Uporabi `analyzeShoppingSuggestions(archivedItems)` — potrebuješ dostop do arhiva. Če Trgovko screen še nima naloženih archived itemov, dodaj hook/fetch (obstaja verjetno `useShoppingArchive` ali podobno — preveri).

Lucide ikone: `ChevronDown`/`ChevronUp` za collapse, `Plus` za čip, `Clock` za "morda rabiš", `Repeat` za "pogosto".

---

## KORAK 4: Checkout modal (ob "počisti kupljene")

Trenutno obstaja "počisti kupljene" (clear checked) akcija ki premakne kupljene v arhiv. Nadgradi:

1. Ob kliku "počisti kupljene" NE arhiviraj takoj — najprej odpri **checkout modal**:
   - Ikona + "Nakup končan" + "{N} artiklov označenih kot kupljenih"
   - Polje "Trgovina (opcijsko)": text input (placeholder "npr. Hofer, Lidl, Mercator...")
   - Polje "Znesek (opcijsko)": number input z € (placeholder "0,00")
   - Gumba: "Shrani" (uspešna barva) + "Preskoči"
2. Ob "Shrani" ali "Preskoči":
   - Generiraj `purchase_group` UUID (npr. `crypto.randomUUID()`)
   - Arhiviraj vse kupljene artikle z istim `purchase_group`
   - `store_note` = vneseno (ali null pri preskoči) na VSEH artiklih skupine
   - `amount` = vneseno (ali null) SAMO na prvem artiklu skupine
3. Modal naj bo isti bottom-sheet stil kot ostali modali v appu, light+dark.

**Optimistic:** modal se zapre takoj ob kliku, arhiviranje v ozadju.

---

## KORAK 5: Analiza screen (zamenja "Purchase history")

Obstoječi arhiv/zgodovina screen (pod ⏳ ikono) PREOBLIKUJ v "Analiza nakupov":

### Zgornji del — povzetek

- Naslov "Analiza nakupov" / "Purchase insights" + back gumb
- 2 metric kartici: "Ta mesec" (€ vsota) + "Nakupov" (št.)
- Pod tem vrstica: "povprečen nakup X € · Y artiklov"
- **"Po trgovinah"** sekcija: seznam store_note → € vsota (padajoče). Brez store_note → "Ostalo".
- **"Najpogosteje kupljeno"** sekcija: ime → Nx (padajoče, top 8)

### Spodnji del — seznam nakupov (2-nivojski)

- Grupirano po `purchase_group` (nakup), sortirano po datumu (najnovejši zgoraj)
- Vsak nakup = vrstica: trgovina (store_note ali "Ostalo") + datum + znesek (če je) + št. artiklov
- Klik na nakup razširi/odpre → prikaže artikle tega nakupa (imena)
- Če purchase_group ni (stari podatki pred to funkcijo), prikaži posamezne artikle kot doslej (fallback)

Uporabi `analyzeShoppingHistory(archivedItems)`.

Ohrani obstoječo search funkcionalnost arhiva če je (išči po imenu artikla).

---

## KORAK 6: i18n

Dodaj ključe (SL + EN):

```
morajRabis: "Morda rabiš" / "You might need"
pogostoKupujes: "Pogosto kupuješ" / "You buy often"
predlogi: "Predlogi" / "Suggestions"
nakupKoncan: "Nakup končan" / "Purchase complete"
artiklovKupljenih: "{n} artiklov označenih kot kupljenih" / "{n} items marked as bought"
trgovinaOpcijsko: "Trgovina (opcijsko)" / "Store (optional)"
znesekOpcijsko: "Znesek (opcijsko)" / "Amount (optional)"
shrani: "Shrani" / "Save"
preskoci: "Preskoči" / "Skip"
analizaNakupov: "Analiza nakupov" / "Purchase insights"
taMesec: "Ta mesec" / "This month"
nakupov: "Nakupov" / "Purchases"
povprecenNakup: "povprečen nakup {amount} € · {n} artiklov" / "avg {amount} € · {n} items"
poTrgovinah: "Po trgovinah" / "By store"
najpogosteje: "Najpogosteje kupljeno" / "Most bought"
ostalo: "Ostalo" / "Other"
dniDenar: "X dni" / "X days"  (formatiraj z n)
```

Dni/valuta: uporabi `toLocaleString(lang==='sl'?'sl-SI':'en-US')` za € kjer smiselno. Slovenski format zneska: "17,60 €".

---

## Pravila (COZY_CONTEXT.md)

- Minimalne, kirurške spremembe — ne prepisuj celih fajlov
- Hooks na vrhu, ne v pogojih
- Optimistic (checkout modal se zapre takoj)
- household_members.id je INTEGER
- Slovenščina, ne hrvaščina: "shrani", "preskoči", "trgovina", "znesek"
- Light + dark tema na vseh novih elementih
- Čipi predlogov: tap doda na seznam prek obstoječe shopAdd

## Testni checklist

- [ ] Pametni predlogi: "pogosto" in "morda rabiš" se pokažeta iz arhiva
- [ ] Collapse/expand predlogov dela, stanje se ohrani
- [ ] Tap na čip doda artikel na seznam
- [ ] Če premalo podatkov, sekcija skrita
- [ ] "Počisti kupljene" → odpre checkout modal
- [ ] Vnos trgovine + zneska se shrani; "Preskoči" arhivira brez njiju
- [ ] purchase_group pravilno povezuje artikle enega nakupa
- [ ] Amount se šteje samo enkrat na nakup (ne per-artikel)
- [ ] Analiza: ta mesec €, po trgovinah (store_note, brez → Ostalo), najpogostejše
- [ ] Seznam nakupov 2-nivojski (nakup → klik → artikli)
- [ ] Stari podatki brez purchase_group še vedno prikazani (fallback)
- [ ] Light + dark tema OK
- [ ] npm run build brez napak

## Backlog (NE zdaj)

- Cene per-artikel / avtomatske cene s spleta (nezanesljivo — parkirano)
- Graf porabe skozi čas (trend)
- Budget cilji / opozorila
