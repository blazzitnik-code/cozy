# CLAUDE.md

## What this is

**Cožy** — a household PWA for Nik and partner: shared freezer inventory, shopping lists, todo lists, calendar, home screen (traffic/LPP buses/BicikeLJ). Mobile-first (max-width 430px), UI in Slovenian, dark theme by default. Realtime sync between household members via Supabase.

## Stack and commands

- Next.js 14 app router (JS, no TypeScript), React 18, Supabase JS v2.
- Inline styles everywhere — **Tailwind is in the config but NOT used**; do not introduce Tailwind classes.
- `npm run dev` — app on http://localhost:3000
- `npx supabase start|stop|status` — local stack in Docker, ports **55321+** (API 55321, DB 55322, Studio 55323; intentionally non-default to avoid clashing with other projects)
- `npx supabase db reset` — re-runs `supabase/migrations/` + `supabase/seed.sql` (wipes local data)
- New migration: `npx supabase migration new <name>`

## Env

- `.env.local` (Next.js): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_BICIKELJ_API_KEY`
- `.env` (Supabase CLI, config.toml substitution): `SUPABASE_AUTH_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_GOOGLE_SECRET`
- Both are gitignored; the template is `.env.example`. Never hardcode keys in code.

## Structure

```
app/page.js              — auth flow: login → create/join household → ZmrzkoApp
components/ZmrzkoApp.js  — MEGA-FILE (~1800 lines): app shell, BottomNav, settings,
                           home screen, freezer, shopping, calendar module
components/TodoApp.js    — todo module (already extracted)
components/HomeModule.js — traffic, shortcuts, LPP, BicikeLJ (already extracted)
lib/hooks.js             — ALL Supabase access (17 hooks); generic useHouseholdTable
lib/supabase.js          — client from env
lib/i18n.js              — translations (useT) — only partially used
supabase/migrations/     — schema (reconstructed from hooks.js; cloud was never pulled)
supabase/seed.sql        — 10 global categories; REQUIRED, otherwise the app hangs
                           on "Nalagam..." (hasCats check)
```

## Database (essentials)

- All tables are household-scoped (`household_id`), RLS "user is a member" via `is_household_member()` (security definer).
- RPC: `create_household` (creates + owner + seeds the 'home' freezer and default stores), `join_household` (by 6-char code), `remove_household_member` (owner only).
- `freezers` and `shopping_stores` have a **text id** and composite PK `(household_id, id)` — the code expects the ids `home` and `mercator`.
- `categories.household_id = null` means a global default category.
- Realtime: hooks listen to `postgres_changes` — a new table must be added to the `supabase_realtime` publication and have RLS/grants.

## Conventions

- One module = one file in `components/`; DB logic lives exclusively in `lib/hooks.js`.
- **Code comments (JS/SQL/config/env) in English**; UI strings in Slovenian. Exception: `raise exception` messages in RPC functions are Slovenian because the app shows them to the user (`setError(e.message)`).
- Inline styles; slate/indigo palette (#0B1120 background, #E2E8F0 text, accents #38BDF8/#6366F1/#F59E0B).
- UI strings in Slovenian directly in JSX (i18n via `useT` is half-implemented — don't extend it without agreeing first).
- Dates: `sl-SI` locale, formatted via `toLocaleDateString`.

## Known tech debt (deliberately deferred)

- `ZmrzkoApp.js` mega-file → plan is to split into FreezerModule/ShoppingModule/CalendarModule + a shared `ui.js`.
- Light theme and EN translations are half-implemented (dark colors hardcoded in many places).
- DB writes mostly lack error handling (errors are silently swallowed).
- `toISOString().split('T')[0]` timezone bug (UTC vs. local time around midnight).
- Google Calendar access tokens stored in plaintext in `calendar_connections` (readable by household members — a deliberate decision for a two-person app).

## Agreed roadmap

1. ~~Local setup (Docker Supabase, migrations, env, CLAUDE.md)~~ ✅
2. Bump all dependency versions (+ adapt the code)
3. Add MCP servers for Next + Supabase
4. Split `ZmrzkoApp.js` into modules
5. Then: theme/i18n decision, error handling
