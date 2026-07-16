# CLAUDE.md

## What this is

**Cožy** — a household PWA for Nik and partner: shared freezer inventory, shopping lists, todo lists, calendar, home screen (traffic/LPP buses/BicikeLJ). Mobile-first (max-width 430px), bilingual UI (Slovenian default + English via next-intl), dark theme by default. Realtime sync between household members via Supabase.

## Stack and commands

- Next.js 16 app router (JS, no TypeScript, Turbopack), React 19, Supabase JS v2.
- **Stock Tailwind 4 utility classes everywhere** — no custom tokens, no `@utility`, no CSS modules/styled-components. `app/globals.css` contains ONLY the import, the `dark` custom variant and the Outfit font. Inline `style` props are allowed ONLY for the documented dynamic cases (see Theming).
- `npm run dev` — app on http://localhost:3000
- `npm run format` — Prettier with `prettier-plugin-tailwindcss` (canonical class order; `.vscode/settings.json` wires format-on-save + Tailwind IntelliSense for `cx()` and ALL-CAPS class consts). Run before committing.
- `npx supabase start|stop|status` — local stack in Docker, ports **55321+** (API 55321, DB 55322, Studio 55323; intentionally non-default to avoid clashing with other projects)
- `npx supabase db reset` — re-runs `supabase/migrations/` + `supabase/seed.sql` (wipes local data)
- New migration: `npx supabase migration new <name>`

## MCP servers (.mcp.json, project scope)

- `supabase` — hosted MCP for the cloud project (`https://mcp.supabase.com/mcp`); requires one-time OAuth: run `claude /mcp` in a regular terminal → "supabase" → Authenticate.
- `supabase-local` — local stack MCP (`http://127.0.0.1:55321/mcp`); no auth, works whenever `npx supabase start` is running. Prefer this one for local DB work.
- `next-devtools` — official Next.js devtools MCP (`npx next-devtools-mcp`); most useful while `npm run dev` is running.
- `motion` — free Motion registry MCP (`motion-studio-mcp` via npx, no API key): Motion docs + CSS spring/bounce easing generators. (The paid `npx motion-ai` AI Kit with premium examples needs a Motion+ key — deliberately skipped.)

## Env

- `.env.local` (Next.js): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_BICIKELJ_API_KEY`
- `.env` (Supabase CLI, config.toml substitution): `SUPABASE_AUTH_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_GOOGLE_SECRET`
- Both are gitignored; the template is `.env.example`. Never hardcode keys in code.

## Structure

```
app/page.js                  — auth flow: login → create/join household → AppShell
components/AppShell.js       — app shell (~330 lines): ALL Supabase hooks, mode/theme,
                               calendar connection orchestration, settings modal, routing
components/IntlProvider.js   — next-intl client provider: locale state (localStorage
                               zmrzko_lang), NextIntlClientProvider (explicit props),
                               date-format presets, useLocaleSwitch() context
components/HomeScreen.js     — home mode: quick stats, today's events, todo previews
components/FreezerModule.js  — freezer: list+filters, swipe archive, add flow, archive views
components/ShoppingModule.js — shopping: store tabs, categorized list, history, modals
components/CalendarModule.js — two-lane partner calendar + event detail modal
components/TodoApp.js        — todo module
components/HomeModule.js     — traffic, shortcuts, LPP, BicikeLJ
components/ui.js             — shared UI: Screen, PageBody, Loader, Card, Input, Label,
                               SectionHeader, EmptyState, IconButton, Fab, Avatar,
                               Segmented, Badge, Pill, FC, Btn, BackBtn, Modal,
                               ModalActions, ConfirmModal, Toaster, LogoToggle,
                               BottomNav, SwipeCard + shared class consts
                               (CHIP_OFF/CHIP_*_ON, POPOVER, PRESS/PRESS_SM)
                               + Motion vocabulary (SPRING_FAST/SPRING_POP/
                               POP/POPOVER_POP/LIST_ROW)
lib/hooks.js                 — ALL Supabase access (17 hooks); generic useHouseholdTable
lib/constants.js             — CATS; per-locale SUGG/SHOP_SUGG/QO ({ sl, en }); FICONS
lib/utils.js                 — cx (clsx + tailwind-merge), expiry status + STATUS_*
                               class maps, expiryInfo(), localDateStr()
lib/intl.js                  — useCatLabel(), useExpiryText(), RPC error → key mapping
lib/supabase.js              — client from env
messages/sl.json, en.json    — ALL UI strings (next-intl, namespaced per module)
supabase/migrations/         — schema (reconstructed from hooks.js; cloud was never pulled)
supabase/seed.sql            — 10 global categories; REQUIRED, otherwise the app hangs
                               on "Nalagam..." (hasCats check)
```

Architecture: data hooks live in AppShell and flow into modules via props — modules own only their UI state. Reason: switching tabs unmounts modules; module-owned hooks would refetch and flicker on every switch, and unmount naturally resets per-module UI state.

## i18n (next-intl, "without i18n routing")

- Fully client-side: **no** `createNextIntlPlugin`, **no** `i18n/request.js` — `components/IntlProvider.js` (mounted in layout.js `<body>`) passes explicit `locale`/`messages`/`timeZone`/`formats` to `NextIntlClientProvider`. Both locale JSONs are statically imported (instant offline switch, ~4 KB gzip each).
- Locale = `localStorage['zmrzko_lang']` (`sl` default, `en`); the layout.js pre-paint script also sets `<html lang>`; the switcher in SettingsModal uses `useLocaleSwitch()` from IntlProvider.
- Components use `useTranslations('<Namespace>')` (namespace per module + `Common`/`Errors`/`Expiry`/`Categories`/`Nav`/`A11y`/`NotFound`) and `useFormatter()` with the named dateTime presets from IntlProvider (`day`, `dayShort`, `monthYear`, `time`, …) — never `toLocaleDateString('sl-SI', …)` directly.
- **`npm run i18n:check`** (scripts/check-messages.mjs) — run before committing, alongside `npm run format`: verifies sl/en key parity, ICU syntax, and that every key referenced in code exists (dynamic `'prefix.' + key` references are listed in `DYNAMIC_KEYS` inside the script — extend it when adding such a pattern).
- Icon-only buttons need a translated `aria-label` from the `A11y` namespace (`IconButton`/`Fab` pass it through; `Fab` defaults to `A11y.add`).
- Untitled calendar events are stored with an empty `title`; render through `eventTitle()` from `lib/intl.js` (translates empty/legacy `'Brez naslova'` titles in the viewer's locale). `app/not-found.js` is the translated 404 (`NotFound.*`).
- Missing keys fall back en → sl → key path (`getMessageFallback` in IntlProvider). Plurals use ICU (`{count, plural, one {…} two {…} few {…} other {…}}` — Slovenian has 4 forms). ICU treats `{ } #` as special — escape literal ones with `'`.
- **New UI strings go into BOTH `messages/sl.json` and `messages/en.json`** — never hardcode UI text in JSX.
- Category labels: translate by stable id via `useCatLabel()` (`Categories.*`); user-created categories fall back to their DB label. Suggestion lists (SUGG/SHOP_SUGG/QO) are per-locale in `lib/constants.js`; picked values become DB data, so shared lists can contain mixed-language names — the shopping `detectCategory` regexes match both languages.
- Toast errors: `lib/hooks.js` passes `Errors.*` **keys** to `notifyError()`; `<Toaster />` translates known keys at render time and shows unknown strings verbatim.
- Out of scope (stays Slovenian): static metadata in layout.js, `public/manifest.json`, data stored in the DB.

## Database (essentials)

- All tables are household-scoped (`household_id`), RLS "user is a member" via `is_household_member()` (security definer).
- RPC: `create_household` (creates + owner + seeds the 'home' freezer and default stores), `join_household` (by 6-char code), `remove_household_member` (owner only).
- `freezers` and `shopping_stores` have a **text id** and composite PK `(household_id, id)` — the code expects the ids `home` and `mercator`.
- `categories.household_id = null` means a global default category.
- Realtime: hooks listen to `postgres_changes` — a new table must be added to the `supabase_realtime` publication and have RLS/grants.

## Theming

- **Stock Tailwind v4 utilities only** — no custom `@theme` tokens, no `@utility` classes. `app/globals.css` is just: the tailwind import, the `dark` custom variant, and `--font-sans` (Outfit).
- Dark mode: `@custom-variant dark` bound to `<html data-theme="dark">`. `layout.js` ships `data-theme="dark"` (app default) + `suppressHydrationWarning`; its pre-paint script applies the saved localStorage `zmrzko_theme`; `switchTheme` in AppShell toggles the attribute. Base page classes (bg/text/scheme) live on `<html>` in layout.js.
- Convention: **unprefixed classes = light theme, `dark:` = dark theme.** Accents are theme-invariant and take no `dark:`: `sky-400` (accent), `indigo-500`/`indigo-400`, `amber-500`, `red-500` (danger), `green-500` (success), `purple-500` (todo/due), `indigo-500` (me) / `pink-500` (partner) calendar lanes, `violet-300` (nav active).
- Palette recipe: page `bg-indigo-50 dark:bg-slate-950`; cards `bg-white/80 border-indigo-500/15 dark:bg-slate-800/60 dark:border-slate-600/20`; inputs `bg-white/90 border-indigo-500/25 dark:bg-slate-800/80 dark:border-indigo-500/30`; text `slate-800/500/400/300` ↔ `dark:slate-200/400/500/600` (primary → dim). Gradients via `bg-linear-135 from-… to-…` / `bg-radial`; gradient text via `bg-clip-text text-transparent`.
- **Rule: no hardcoded hex/rgba.** Audit: `grep -rnE '#[0-9A-Fa-f]{3,8}\b|rgba?\(' app components lib --include='*.js' | grep -vE 'lib/constants\.js|fill="#|themeColor'` must stay empty (exclusions: CATS data colors, the Google logo SVG, the PWA themeColor meta).
- Arbitrary values only where stock has no equivalent: app frame `max-w-[430px]`, `text-[9px]`/`text-[10px]` micro-captions, `env(safe-area-inset-*)`/`calc()` offsets, `tracking-[…]`, scrollbar hiding (`[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`).
- Inline `style` props are allowed ONLY for truly runtime-dynamic values: CSS-var bridges for data-driven colors (`style={{'--cat': cat.color}}` + `bg-(--cat)/13`), computed widths/heights (progress bars, chart bars), Motion animation/drag transforms (Motion writes inline `transform`/`opacity` — expected), Avatar size. Everything else is a class.
- Conditional classes use `cx()` from `lib/utils.js` (clsx + tailwind-merge: later classes win per CSS property, so `className` overrides on shared components are safe — e.g. `<Card className="rounded-xl">`). Always **full literal class strings** — never concatenate class-name fragments (Tailwind's scanner can't see them). Caveat: twMerge does not merge across variants — a `dark:bg-*` on a component base can only be overridden by another `dark:bg-*`.
- Repeated visual recipes live in `components/ui.js`, not inline: `PageBody` (page content wrapper), `Card` (surface), `BackBtn`, `ModalActions` (Save/Cancel pair, tones primary/violet/orange/danger), `POPOVER` (opaque dropdown panel), chip states (`CHIP_OFF` + `CHIP_SKY_ON`/`CHIP_INDIGO_ON`/`CHIP_AMBER_ON`). Reuse before writing a new one.
- Interactive baseline: shared primitives ship press feedback + keyboard focus ring via the `PRESS`/`PRESS_SM` consts (`active:scale-*`, `focus-visible:outline-*`); `Input` highlights its border on focus. New tappable elements should include `PRESS`/`PRESS_SM`.
- Errors: failed DB writes surface via `notifyError()` (`lib/notify.js`) → `<Toaster />`; never swallow write errors silently.

## Motion / animations

- **Micro-animations only** (~200 ms springs): enter/exit, layout moves, drag, small glyph pops. No page/tab/module transitions, no auth-flow transitions — deliberate scope.
- Import from `motion/react` (plain imports, no LazyMotion — drag + layout need full `domMax` anyway). Shared recipes live in `components/ui.js` (`SPRING_FAST`, `SPRING_POP`, `POP`, `POPOVER_POP`, `LIST_ROW`) — reuse/spread these before inventing new values: `<motion.div {...LIST_ROW} key={item.id}>`.
- **Reduced motion**: global `<MotionConfig reducedMotion="user">` in IntlProvider covers declarative animations; any imperative `animate()` call must gate itself with `useReducedMotion()` (see SwipeCard).
- **CSS vs Motion**: class-swap transitions (colors, `PRESS`/`PRESS_SM`, chevron rotate) stay CSS. **Never add `whileTap` to elements that have `PRESS`/`PRESS_SM`** — Tailwind v4 `active:scale-*` (the `scale` property) composes with Motion's inline `transform`, so both would fire.
- **Lists**: `<AnimatePresence initial={false} mode="popLayout">` around the map (`initial={false}` because modules remount on every tab switch), `relative` on the list container (popLayout positions exiting rows absolutely), stable DB-uuid keys only — never animate index-keyed lists (HomeModule edit rows, Calendar EventBlock). `layout` goes on rows, never on scroll containers.
- **Modal is entrance-only by design** — all call sites conditional-render (`{state && <Modal>}`) and close via caller state setters, so exit animations can't run; do not wrap modal call sites in AnimatePresence.
- Motion's animating inline `transform` creates a CSS containing block — never wrap `Screen`/`PageBody`/anything containing `fixed` UI in a motion element (an element animating itself, like Fab/Toaster, is fine).

## Conventions

- One module = one file in `components/`; DB logic lives exclusively in `lib/hooks.js`.
- **Code comments (JS/SQL/config/env) in English**; UI strings via next-intl messages (see i18n). Exception: `raise exception` messages in RPC functions are Slovenian — the client maps the known ones to `Errors.rpc.*` keys via `rpcErrorKey()` in `lib/intl.js` and shows unknown ones verbatim.
- Stock Tailwind utility classes (see Theming); slate/indigo palette with sky/amber accents, light + dark via the `dark:` variant.
- Dates/times: `useFormatter()` presets (locale-aware); `localDateStr()` only for YYYY-MM-DD data values.

## Known tech debt (deliberately deferred)

- Google Calendar access tokens stored in plaintext in `calendar_connections` (readable by household members — a deliberate decision for a two-person app).

## Agreed roadmap

1. ~~Local setup (Docker Supabase, migrations, env, CLAUDE.md)~~ ✅
2. ~~Bump all dependency versions (Next 16, React 19, Tailwind 4, supabase-js)~~ ✅
3. ~~Add MCP servers for Next + Supabase~~ ✅
4. ~~Split `ZmrzkoApp.js` into modules (AppShell + HomeScreen/Freezer/Shopping/Calendar + ui.js)~~ ✅
5. ~~Toast error handling + timezone fix + CSS design-token theming foundation~~ ✅
6. ~~i18n refactor with **next-intl** ("without i18n routing" mode — client app, locale from settings, SL + EN) replacing the ad-hoc `useT`~~ ✅
7. Theme design migration: ~~unify all styling onto stock Tailwind utilities (light + dark via `dark:`)~~ ✅ → Nik provides the visual design → restyle by editing classes, mostly in `components/ui.js` and the shared class-map constants
