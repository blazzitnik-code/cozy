# Cožy 🏠

Domača PWA aplikacija za gospodinjstvo — narejena za dva (ali več) članov z realtime sinhronizacijo prek Supabase.

**Moduli:**

- 🏠 **Dom** — pregled dneva: promet, LPP prihodi, BicikeLJ, bližnjice, današnji dogodki, opravila
- ❄️ **Zmrzko** — inventar zamrzovalnika z roki uporabe, arhivom in statistiko zavržene hrane
- 🛒 **Nakupi** — nakupovalni seznam po trgovinah s pametno kategorizacijo in zgodovino
- 📅 **Koledar** — skupni pogled Google koledarjev obeh partnerjev (dve stezi, proste ure)
- ✅ **Opravila** — deljene todo liste z roki, dodeljevanjem in arhivom

## Stack

Next.js 16 (app router, Turbopack) · React 19 · Supabase (auth, Postgres, realtime) · Tailwind 4 (samo preflight) · PWA

## Lokalni razvoj

Predpogoji: Node 18+, Docker (za lokalni Supabase).

```bash
npm install

# 1. Env fajli
cp .env.example .env.local   # Next.js del — vpiši vrednosti
cp .env.example .env         # Supabase CLI del — vpiši Google OAuth vrednosti

# 2. Lokalni Supabase (Postgres + auth + realtime v Dockerju)
npx supabase start           # prvič potraja (vleče slike); izpiše API_URL in ANON_KEY
                             # → ta dva vpiši v .env.local

# 3. Aplikacija
npm run dev                  # http://localhost:3000
```

Lokalni stack teče na portih **55321+** (API `http://127.0.0.1:55321`, Studio `http://127.0.0.1:55323`, DB `55322`), da ne trči z drugimi lokalnimi Supabase projekti.

Uporabni ukazi:

```bash
npx supabase status    # URL-ji in ključi
npx supabase db reset  # ponovno požene migracije + seed (počisti podatke!)
npx supabase stop      # ustavi stack
```

### Google prijava lokalno (enkratna nastavitev)

V [Google Cloud Console](https://console.cloud.google.com/apis/credentials) pri obstoječem OAuth clientu dodaj:

- **Authorized redirect URI:** `http://127.0.0.1:55321/auth/v1/callback`
- **Authorized JavaScript origin:** `http://localhost:3000`

Nato vpiši client ID + secret v `.env` (za Supabase) in client ID v `.env.local` (za Google Calendar povezavo). Brez tega se lokalni stack normalno zažene, samo Google prijava ne dela.

## Baza

Shema je v `supabase/migrations/`, globalne privzete kategorije v `supabase/seed.sql` (brez njih se app ne naloži). Vse tabele so vezane na `household_id` z RLS politiko "uporabnik je član gospodinjstva". Gospodinjstva se ustvarjajo/pridružujejo prek RPC funkcij (`create_household`, `join_household`).

## Deploy (Vercel)

1. Push na GitHub → import v [Vercel](https://vercel.com/new)
2. Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` — URL produkcijskega Supabase projekta
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — produkcijski anon key
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth client ID
   - `NEXT_PUBLIC_BICIKELJ_API_KEY` — JCDecaux ključ
3. Deploy → PWA: na telefonu _Add to Home Screen_
