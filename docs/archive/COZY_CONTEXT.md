# Cožy — Project Context (master)

Ta dokument je master kontekst za Claude Code v VS Code. Naloži ga na začetku vsake seje.

---

## O projektu

**Cožy** (prej ZMRZKO) je domača PWA za gospodinjstvo. Ime = "cozy" + slovenski Ž (lastnikova črka). V aktivni produkcijski uporabi na **zmrzko.vercel.app** (→ cozy.vercel.app).

Uporabniki: B (Blaž, lastnik, non-developer) + partnerka Tina + družina (Žan, Nika). B vodi produkt/design/QA, Claude piše vso kodo.

---

## Tech stack

- **Frontend:** Next.js 14 + React 18, Tailwind
- **Backend:** Supabase (PostgreSQL, Auth, RLS, Real-time, RPC)
- **Auth:** Google OAuth (Supabase redirect OAuth, NE GSI knjižnica)
- **Hosting:** Vercel (auto-deploy iz GitHub)
- **Repo:** github.com/blazzitnik-code/zmrzko
- **Ikone:** lucide-react (line ikone za UI/nav; emoji za vsebino)

---

## Ključne datoteke

```
components/
  ZmrzkoApp.js      # glavna komponenta (~1300+ vrstic)
  TodoApp.js        # Listko modul
  HomeModule.js     # Home modul (promet/bus/bike)
  CalendarApp.js    # Koledarko (v gradnji)
lib/
  hooks.js          # vsi Supabase hooks + normalizujNiz + useHouseholdTable (generični)
  i18n.js           # SL/EN prevodi, useT(lang)
  supabase.js       # client
app/
  page.js, layout.js, globals.css
```

---

## KRITIČNA tehnična pravila

- **NIKOLI recursive RLS ali helper funkcije** — vedno direkten subquery:
  `household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())`
- **RPC z SECURITY DEFINER** za elevated operacije (npr. brisanje članov). Dodaj `SET search_path = public`.
- **`household_members.id` je INTEGER, ne UUID!** (pogost vir bugov). `assigned_to`/`created_by` so UUID (auth.users).
- **Nested joins ne delajo** v Supabase → sekvenčni queryji.
- **Optimistic updates:** hook drži lokalni state, posodobi TAKOJ ob kliku, Supabase write brez `await`. Generični `useHouseholdTable` ima `mutateLocal(updater)`. Realtime echo se uskladi kasneje.
- **Hooks vedno na vrhu** komponent, nikoli v pogojih (React error #310).
- **File integrity:** minimalne, kirurške spremembe (str_replace), NIKOLI prepis celih datotek. B preverja s primerjavo števila vrstic.
- **React.memo** na row komponentah (ShopItemRow, TodoItemRow) da toggle ne re-renderira celega seznama.

## Jezik

App je v **slovenščini** (+ EN switch prek useT). NE hrvaščina:

- ✅ "opravičujem se", "shrani", "izbriši", "uredi", "dodaj", "zameni", "opravki"
- ❌ "izvinjujem se", "zamenjaj", "obriši"

Iskanje brez šumnikov prek `normalizujNiz` (č→c, š→s, ž→z).

---

## Imena modulov

| Modul    | SL        | EN     | Emoji/ikona     |
| -------- | --------- | ------ | --------------- |
| Home     | Cožy      | Cožy   | 🏠 House        |
| Freezer  | Zmrzko    | Freezy | ❄️ Snowflake    |
| Shopping | Trgovko   | Shopzy | 🛒 ShoppingCart |
| Calendar | Koledarko | Calzy  | 📅 Calendar     |
| To-do    | Listko    | Taskzy | ✅ ListChecks   |

---

## UI konsistenca (dogovorjeno)

- **Header pattern povsod:** `[Ime modula] ... [⏳ Arhiv] [⚙️ Settings]`
- **Klik na naslov/logo na VSAKEM screenu → home page**
- **Arhiv:** povsod ⏳ (Lucide History/Hourglass) ikona
- **Settings:** en in isti modal iz vseh screenov (jezik, tema, invite code, člani, calendar connect, notifications, sign out)
- **Člani v settings:** klik → nastavi rojstni dan + barvo (iz ~8 palete). Shrani v `household_members.birthday` + `.color`.
- **Navigacija (bottom nav) = HIBRID:** neaktivni tabi = Lucide line ikone (text-secondary); aktivni tab = glossy squircle (zaobljen kvadrat ~32px, oranžni gradient #FF9D5C→#E85D04, bela ikona, glass shine overlay 0.55→0.05).
- **Emoji ostane za vsebino** (kategorije hrane, emoji list, vreme), Lucide za UI/nav.
- **Tema:** dark/light, shrani v localStorage. `getStyles(isDark)` vrne dinamične style objekte.

---

## Supabase tabele

| Tabela                                                                                   | Namen                                                            |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| households                                                                               | gospodinjstva                                                    |
| household_members                                                                        | člani (id INTEGER!, +birthday, +color)                           |
| items, archived, freezers, categories                                                    | Zmrzko                                                           |
| shopping_items (ima sort_order), shopping_archived, shopping_favourites, shopping_stores | Trgovko                                                          |
| todo_lists, todo_items                                                                   | Listko                                                           |
| home_settings                                                                            | Home modul (naslov, destinacije, bus/bike postaje, bike_api_key) |
| board_notes                                                                              | Deska (text, author_name, done_at)                               |
| calendar_events                                                                          | Koledarko (recurrence, skip_dates[])                             |

Vse imajo RLS + realtime.

---

## Moduli — status

| Modul                                 | Status                                    |
| ------------------------------------- | ----------------------------------------- |
| ❄️ Zmrzko                             | ✅ produkcija                             |
| 🛒 Trgovko                            | ✅ produkcija                             |
| ✅ Listko                             | ✅ produkcija                             |
| 🏠 Home modul (promet/bus/bike/vreme) | ✅ produkcija                             |
| 📅 Koledarko                          | 🔨 v gradnji (faza 1: ročni eventi)       |
| 📌 Deska                              | 📋 spec pripravljen (na home page, 3+več) |
| 🍽️ Jedilnik                           | 💭 ideja (coming soon)                    |

---

## Produktna vizija

Cožy = **koordinacijski layer za ENO gospodinjstvo**. Ne komunikacijski (brez chata — za to obstajajo druga orodja). Telefoni so osebni, družina rabi share-ano plast.

Načela:

- **Glanceability** — home page pokaže vse bistveno brez klika. Severna zvezda = ePaper family dashboard na steni.
- **Zero friction za člane** — vsak feature mora delati za člana ki odpre app 1x/dan za 10s.
- **Notifikacije previdno** — samo time-sensitive + actionable (smeti nocoj, task assigned). NIKOLI "nekdo je dodal item".
- **"Danes pri nas" koncept** — home poveže module (smeti nocoj, Nika trening 16h, večerja 3 doma, mleko manjka).
- Omejeno na eno gospodinjstvo (ne širša družina) — vsako ima svoje "življenje".

---

## BACKLOG (revisit po trenutnih featurih)

**Performance** (naredi re-check po novih featurih):

- Instant shell/skeleton (LCP) — deferred, touches loading gates + HomeScreen
- Render-blocking CSS — samo če trivialno
- Keyboard resize hiding filters — parkirano

**Koledarko faza 2:**

- Google freebusy (Tina) — kdaj zasedena brez podrobnosti
- Outlook (B) — težji, freebusy je Google-to-Google
- "Kdaj sva prosta" čez cel teden
- "ta in vsi naslednji" urejanje (override instanc)

**Listko faza 2:**

- Notifikacije (task assigned, due date)
- Pin / drag & drop ordering
- Recurring tasks (temelji na archive autocomplete)
- Prioritete 🔴🟡🟢
- Lista vezana na osebo (owner avatar + "samo moje" filter)
- Item notes (delno, oseba še ni prikazana)

**Trgovko:** analize iz purchase history (kaj se ponavlja, budget)

**Novi moduli:**

- Check-in "kdo je doma za večerjo" + ura (home page)
- Vault — dokumenti/navodila (slike dokumentov, "kako zapreti vodo na vikendu") — z novo fazo menija
- Deska history view (shranjujemo, ne kažemo — dokler ni potreba)

**Večje:**

- EV polnjenje, hiša integracije
- ePaper family dashboard (severna zvezda)

**Menu:** zdaj 5 tabov (Dom/Zmrzko/Trgovko/Koledarko/Listko). Ko pridejo Deska+Vault → preveč → Deska na home page, Vault pod settings.

**Out of scope:** chat, photo sharing, širitev izven enega gospodinjstva.

---

## Workflow

- Spremembe prek Claude Code v VS Code → commit → Vercel auto-deploy
- Supabase SQL zažene uporabnik ročno v SQL Editorju
- Vsak večji korak: `npm run build` da preveriš da ni napak

---

_Master kontekst — posodobi ob večjih spremembah._
