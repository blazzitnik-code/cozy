---
name: visual-check
description: Headlessly screenshot Cožy's authenticated screens against the local Supabase stack — creates a throwaway test user, injects the session into agent-browser, seeds data, captures both themes, cleans up. Use for visual verification of UI work.
---

# Visual check of authenticated screens

The app's only real sign-in is Google, but authenticated screens can be tested headlessly against the local stack — either through the dev-only password login (dev builds) or by minting a session over the admin API and injecting it into the browser (works on any build).

## Prerequisites

- Local stack running: `npx supabase status` (start with `npx supabase start` if not) — copy the **anon** and **service_role** keys from its output. API URL: `http://127.0.0.1:55321`.
- App running on `http://localhost:3000` — `npm run dev` is fine for styling; use `npm run build && npm start` when the service worker / offline behavior matters.
- `agent-browser` CLI (installed globally).

## Dev-build shortcut

On `npm run dev` builds the login screen shows a password form under the Google button (`NODE_ENV === 'development'` only). That replaces steps 1 and 3 of the recipe:

- Instead of the admin-API curl: `node scripts/dev-user.mjs vtest@cozy.local vtest-pass-1234` (creates/updates a confirmed user; password defaults to `cozy-dev` if omitted).
- Instead of injecting the session: have agent-browser open the dev login and fill the form.

Step 2 (password-grant JWT) is still needed for the seeding curls in step 4. Prod builds (`npm run build && npm start`) have no dev login — use the full recipe below.

## Recipe

1. **Create a confirmed test user** (service role):

```bash
curl -s http://127.0.0.1:55321/auth/v1/admin/users \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"vtest@cozy.local","password":"vtest-pass-1234","email_confirm":true}'
# → note the user id (uuid)
```

2. **Get a session** via password grant (anon key):

```bash
curl -s "http://127.0.0.1:55321/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
  -d '{"email":"vtest@cozy.local","password":"vtest-pass-1234"}'
# → keep the WHOLE response JSON; access_token inside is the user JWT
```

3. **Inject the session**: open `http://localhost:3000` in agent-browser, then eval
   `localStorage.setItem('sb-127-auth-token', JSON.stringify(<whole token response>))` and reload.
   The key is `sb-127-auth-token` because supabase-js derives the ref from the URL host `127.0.0.1`.

4. **Create a household + seed data** (user JWT, anon apikey):

```bash
curl -s http://127.0.0.1:55321/rest/v1/rpc/create_household \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" -H 'Content-Type: application/json' \
  -d '{"p_name":"Vtest","p_user_id":"<user uuid>","p_display_name":"Vtest"}'
# NOTE: the signature has p_user_id — do not omit it.
# Returns the household id as a bare JSON string ("01ec…") — that's your household_id.
```

Then seed whatever the screens need (`items`, `shopping_items`, `todo_lists` + `todo_items`, …) via plain REST inserts with the same headers. **Check column names in `supabase/migrations/` first** — they are terser than you'd guess. Working `items` example (`cat` not category, `qty` is text, `freezer` is the text id `home`):

```bash
curl -s http://127.0.0.1:55321/rest/v1/items \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $JWT" \
  -H 'Content-Type: application/json' -H 'Prefer: return=minimal' \
  -d '[{"household_id":"<hh id>","name":"Testni burek","cat":"pripravljena","qty":"2x","freezer":"home","frozen":"2026-07-01","expiry":"2026-08-01"}]'
```

Reload the app → signed in with data.

5. **Navigate and capture**:

- Tabs via the bottom nav: `agent-browser eval "[...document.querySelectorAll('.fixed.bottom-0 button')][N].click()"` — order: 0 home, 1 freezer, 2 shopping, 3 calendar, 4 todo.
- Theme flip: `document.documentElement.dataset.theme='light'` (or `'dark'`); capture both themes.
- `agent-browser screenshot <ABSOLUTE path>` — always an absolute path into the session scratchpad, never into the repo. The agent-browser daemon persists across sessions and resolves relative paths against **its own original cwd**, so relative paths land in the wrong (possibly stale) directory.

6. **Caveat — calendar in dark mode**: the CALENDAR tab screenshots with inverted-looking colors in dark mode (page renders light, ink capsules white) even though computed styles are correct. This is an agent-browser/Chromium capture artifact, NOT an app bug — verify calendar styling via `getComputedStyle` evals instead of pixels.

7. **Clean up** (service role): delete the household row (`DELETE /rest/v1/households?id=eq.<id>` with service-role apikey+bearer — cascades to all seeded data), the auth user (`DELETE /auth/v1/admin/users/<uuid>`), and the injected browser session (`agent-browser eval "localStorage.removeItem('sb-127-auth-token')"`).
