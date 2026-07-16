# CLAUDE.md

## What this is

**Cožy** — a household PWA for Nik and partner: shared freezer inventory, shopping lists, todo lists, calendar, home screen (traffic/LPP buses/BicikeLJ). Mobile-first (max-width 430px), UI in Slovenian, dark theme by default. Realtime sync between household members via Supabase.

## Stack and commands

- Next.js 16 app router (JS, no TypeScript, Turbopack), React 19, Supabase JS v2.
- Inline styles everywhere — **Tailwind 4 is loaded only for its preflight reset** (`@import "tailwindcss"` in `globals.css`); utility classes are NOT used, do not introduce them.
- `npm run dev` — app on http://localhost:3000
- `npx supabase start|stop|status` — local stack in Docker, ports **55321+** (API 55321, DB 55322, Studio 55323; intentionally non-default to avoid clashing with other projects)
- `npx supabase db reset` — re-runs `supabase/migrations/` + `supabase/seed.sql` (wipes local data)
- New migration: `npx supabase migration new <name>`

## MCP servers (.mcp.json, project scope)

- `supabase` — hosted MCP for the cloud project (`https://mcp.supabase.com/mcp`); requires one-time OAuth: run `claude /mcp` in a regular terminal → "supabase" → Authenticate.
- `supabase-local` — local stack MCP (`http://127.0.0.1:55321/mcp`); no auth, works whenever `npx supabase start` is running. Prefer this one for local DB work.
- `next-devtools` — official Next.js devtools MCP (`npx next-devtools-mcp`); most useful while `npm run dev` is running.

## Env

- `.env.local` (Next.js): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_BICIKELJ_API_KEY`
- `.env` (Supabase CLI, config.toml substitution): `SUPABASE_AUTH_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_GOOGLE_SECRET`
- Both are gitignored; the template is `.env.example`. Never hardcode keys in code.

## Structure

```
app/page.js                  — auth flow: login → create/join household → AppShell
components/AppShell.js       — app shell (~330 lines): ALL Supabase hooks, mode/lang/theme,
                               calendar connection orchestration, settings modal, routing
components/HomeScreen.js     — home mode: quick stats, today's events, todo previews
components/FreezerModule.js  — freezer: list+filters, swipe archive, add flow, archive views
components/ShoppingModule.js — shopping: store tabs, categorized list, history, modals
components/CalendarModule.js — two-lane partner calendar + event detail modal
components/TodoApp.js        — todo module
components/HomeModule.js     — traffic, shortcuts, LPP, BicikeLJ
components/ui.js             — shared UI: Pill, FC, Btn, Modal, ConfirmModal, BottomNav,
                               SwipeCard, LogoToggle
lib/hooks.js                 — ALL Supabase access (17 hooks); generic useHouseholdTable
lib/constants.js             — CATS, SUGG, SHOP_SUGG, FICONS, QO
lib/utils.js                 — expiry status + date/calendar formatting helpers
lib/styles.js                — getStyles(isDark) + static dark style constants
lib/supabase.js              — client from env
lib/i18n.js                  — translations (useT) — only partially used
supabase/migrations/         — schema (reconstructed from hooks.js; cloud was never pulled)
supabase/seed.sql            — 10 global categories; REQUIRED, otherwise the app hangs
                               on "Nalagam..." (hasCats check)
```

Architecture: data hooks live in AppShell and flow into modules via props — modules own only their UI state. Reason: switching tabs unmounts modules; module-owned hooks would refetch and flicker on every switch, and unmount naturally resets per-module UI state.

## Database (essentials)

- All tables are household-scoped (`household_id`), RLS "user is a member" via `is_household_member()` (security definer).
- RPC: `create_household` (creates + owner + seeds the 'home' freezer and default stores), `join_household` (by 6-char code), `remove_household_member` (owner only).
- `freezers` and `shopping_stores` have a **text id** and composite PK `(household_id, id)` — the code expects the ids `home` and `mercator`.
- `categories.household_id = null` means a global default category.
- Realtime: hooks listen to `postgres_changes` — a new table must be added to the `supabase_realtime` publication and have RLS/grants.

## Theming

- Design tokens are CSS custom properties in `app/globals.css`: `:root` = dark (default), `:root[data-theme="light"]` = light. The saved theme is applied pre-paint by an inline script in `app/layout.js`; `switchTheme` in AppShell toggles `<html data-theme>` + localStorage (`zmrzko_theme`).
- `lib/styles.js` `getStyles()` returns `var(--…)` references — all `st.*` consumers follow the theme via CSS. Shared `components/ui.js` is fully on tokens (reference pattern).
- **Rule: new colors go through tokens only — no new hardcoded hex/rgba.**
- Migration status: ui.js ✓; module-internal colors (~240 spots in Freezer/Shopping/Calendar) intentionally still hardcode the dark palette — they migrate together with Nik's upcoming visual design (roadmap 7).
- Errors: failed DB writes surface via `notifyError()` (`lib/notify.js`) → `<Toaster />`; never swallow write errors silently.

## Conventions

- One module = one file in `components/`; DB logic lives exclusively in `lib/hooks.js`.
- **Code comments (JS/SQL/config/env) in English**; UI strings in Slovenian. Exception: `raise exception` messages in RPC functions are Slovenian because the app shows them to the user (`setError(e.message)`).
- Inline styles; slate/indigo palette (#0B1120 background, #E2E8F0 text, accents #38BDF8/#6366F1/#F59E0B).
- UI strings in Slovenian directly in JSX (i18n via `useT` is half-implemented — don't extend it without agreeing first).
- Dates: `sl-SI` locale, formatted via `toLocaleDateString`.

## Known tech debt (deliberately deferred)

- Module-internal colors still hardcode the dark palette (light theme only works on token-backed surfaces) — migrates with the visual design (roadmap 7).
- i18n via `useT` is ad-hoc and only covers the freezer module + settings — gets replaced by next-intl (roadmap 6).
- Google Calendar access tokens stored in plaintext in `calendar_connections` (readable by household members — a deliberate decision for a two-person app).

## Agreed roadmap

1. ~~Local setup (Docker Supabase, migrations, env, CLAUDE.md)~~ ✅
2. ~~Bump all dependency versions (Next 16, React 19, Tailwind 4, supabase-js)~~ ✅
3. ~~Add MCP servers for Next + Supabase~~ ✅
4. ~~Split `ZmrzkoApp.js` into modules (AppShell + HomeScreen/Freezer/Shopping/Calendar + ui.js)~~ ✅
5. ~~Toast error handling + timezone fix + CSS design-token theming foundation~~ ✅
6. i18n refactor with **next-intl** ("without i18n routing" mode — client app, locale from settings, SL + EN) replacing the ad-hoc `useT`
7. Theme design migration: Nik provides the visual design → map module-internal colors onto the token catalogue in globals.css
