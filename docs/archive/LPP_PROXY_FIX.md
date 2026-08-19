# Cožy — LPP CORS fix (proxy prek Next.js API route)

## Problem

LPP API (`data.lpp.si`) blokira klice direktno iz brskalnika s CORS politiko:

```
Access to fetch at 'https://data.lpp.si/api/...' from origin 'https://zmrzko.vercel.app'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

Zato `fetchBusArrivals` in `fetchLppStations` v `components/HomeModule.js` vedno vrneta prazno (napake so požrte v `[]`), bus ETA se ne prikaže.

## Rešitev

Next.js API route deluje kot proxy: brskalnik → naš strežnik → LPP. Strežnik nima CORS omejitev.

---

## KORAK 1: Ustvari API route za arrivals

Ustvari `app/api/lpp/arrivals/route.js`:

```javascript
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('station-code');
  if (!code) {
    return Response.json({ data: [] }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://data.lpp.si/api/station/arrival-on-station?station-code=${encodeURIComponent(code)}&route-id=&limit=5`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } },
    );
    if (!res.ok) {
      return Response.json({ data: [] }, { status: res.status });
    }
    const data = await res.json();
    return Response.json(data);
  } catch (e) {
    return Response.json({ data: [], error: String(e) }, { status: 500 });
  }
}
```

## KORAK 2: Ustvari API route za postaje (iskanje)

Ustvari `app/api/lpp/stations/route.js`:

```javascript
export async function GET() {
  try {
    const res = await fetch('https://data.lpp.si/api/station/active-stations', {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return Response.json({ data: [] }, { status: res.status });
    }
    const data = await res.json();
    return Response.json(data);
  } catch (e) {
    return Response.json({ data: [], error: String(e) }, { status: 500 });
  }
}
```

Opomba: `active-stations` se redko spreminja, zato `revalidate: 3600` (cache 1h). Arrivals morajo biti live, zato `revalidate: 0`.

---

## KORAK 3: Popravi HomeModule.js — kliči proxy namesto LPP direktno

V `components/HomeModule.js`:

### 3a. fetchBusArrivals (okoli vrstice 59)

Zamenjaj URL iz `${LPP_BASE}/station/arrival-on-station?...` na naš proxy:

```javascript
async function fetchBusArrivals(stationCode) {
  try {
    const res = await fetch(`/api/lpp/arrivals?station-code=${encodeURIComponent(stationCode)}`);
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}
```

### 3b. fetchLppStations (okoli vrstice 49)

Zamenjaj `${LPP_BASE}/station/active-stations` na proxy:

```javascript
async function fetchLppStations() {
  try {
    const res = await fetch('/api/lpp/stations');
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}
```

### 3c. LPP_BASE konstanta (vrstica 20)

Lahko ostane (če se uporablja kje drugje) ali odstrani če ni več v rabi. Preveri z grep-om.

---

## KORAK 4: Preveri strukturo odgovora

Ko proxy dela, preveri v konzoli kaj arrivals dejansko vrnejo. Struktura LPP `arrival-on-station` je približno:

```json
{ "data": [ { "route_name": "6", "eta_min": 4, ... }, ... ] }
```

Če se polja razlikujejo (npr. `route` namesto `route_name`, ali `eta` namesto `eta_min`), prilagodi prikaz v ETA kartici (okoli vrstice 468+ kjer se bere prvi prihod).

Za debug: v API route lahko začasno `console.log(data)` — izpis bo v Vercel logih (ali terminalu pri `npm run dev`).

---

## KORAK 5: Test lokalno

```bash
npm run dev
```

- Odpri http://localhost:3000/api/lpp/stations → mora vrniti JSON s postajami
- Odpri http://localhost:3000/api/lpp/arrivals?station-code=600011 → mora vrniti arrivals
- V appu: Home modul → nastavi LPP postajo → preveri da bus ETA kaže podatke

---

## Pravila (COZY_CONTEXT.md)

- Minimalne spremembe — samo zamenjaj URL-je, dodaj dve route datoteki
- Ne spreminjaj logike refreshBus / polling / cache — samo vir podatkov
- npm run build brez napak

## Testni checklist

- [ ] /api/lpp/stations vrne postaje (JSON, ne CORS napaka)
- [ ] /api/lpp/arrivals?station-code=XXX vrne prihode
- [ ] Home modul: iskanje LPP postaj deluje (StationSearch dobi rezultate)
- [ ] Bus ETA v Domov kartici kaže dejanski čas prihoda
- [ ] Struktura polj (route_name, eta_min) pravilno prikazana
- [ ] npm run build brez napak

## Opomba: BicikeLJ

JCDecaux API (`api.jcdecaux.com`) verjetno DELA (ima CORS dovoljen). Če pa tudi bike kaže "0" / "?", je morda isti problem — v tem primeru naredi enak proxy `app/api/bike/route.js`. Najprej preveri v konzoli če je CORS napaka tudi za `api.jcdecaux.com`.
