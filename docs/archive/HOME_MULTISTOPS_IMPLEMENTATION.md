# Cožy — Home: več postaj (bus + bike) z modalom: navodila za Claude Code

## Kontekst

Preberi najprej `COZY_CONTEXT.md`. Nadgrajujemo **Home modul** (`components/HomeModule.js`).

Trenutno: uporabnik lahko nastavi do 3 LPP postaje in 3 BicikeLJ postaje, ampak ETA kartica na home pokaže samo PRVO od vsake. Ostale se shranijo, a niso dostopne.

Cilj: kartica ostane kompaktna (prikaže prvo postajo), a če je nastavljenih več, pokaže **"+N" badge** in tap odpre **bottom-sheet modal** z vsemi postajami in njihovimi podatki.

Brez sprememb v Supabase — podatki (bus_stops, bike_stations) so že shranjeni. Samo UI + fetch za vse postaje.

Naredi po korakih, `npm run build` na koncu.

---

## KORAK 1: Fetch podatkov za VSE postaje (ne samo prvo)

V `components/HomeModule.js` trenutno `refreshBus` že zanka čez `settings.bus_stops` in shrani v `busCache` keyed po `stop.code` — torej podatki za vse postaje SE ŽE nabirajo. Preveri isto za bike (`refreshBike` — mora napolniti podatke za vse `bike_stations`, ne samo prvo).

Če bike trenutno bere samo prvo, razširi da napolni vse (podobno kot bus). BicikeLJ vrne vsa polja v enem klicu (`fetchAllBikeStations`), zato samo mapiraj vse nastavljene postaje.

Rezultat: `busData` ima podatke za vse bus kode, `bikeData` za vse bike številke.

---

## KORAK 2: "+N" badge na tile

V ETA kartici (grid 4 tiles: avto/bus/peš/bike):

- **Bus tile**: če `settings.bus_stops.length > 1`, pokaži badge "+{length-1}" v zgornjem desnem kotu tile. Prva postaja se prikaže kot doslej (naslednji prihod).
- **Bike tile**: če `settings.bike_stations.length > 1`, pokaži badge "+{length-1}". Prva postaja kot doslej (št. koles).
- Badge stil: majhen, `background: var(--bg-accent)` (ali oranžni tint), `color: var(--text-accent)`, font 9px, padding 1-5px, border-radius 10px, position absolute top-right.
- Če je samo 1 postaja: BREZ badge, tile ni klikabilen (ali klik ne naredi nič).

---

## KORAK 3: Tile postane klikabilen → modal

- Bus tile (če >1 postaja): tap odpre **bus modal**.
- Bike tile (če >1 postaja): tap odpre **bike modal**.
- Dodaj `useState` za `busModalOpen` in `bikeModalOpen`.
- Namig pod gridom (opcijsko): mala siva vrstica "tapni 🚌 ali 🚲 za vse postaje" — samo če je vsaj ena skupina >1.

---

## KORAK 4: Bus modal

Bottom-sheet modal (isti stil kot ostali modali v appu, light+dark):

- Header: 🚌 + "Avtobusi" / "Buses"
- Za VSAKO nastavljeno bus postajo:
  - Ime postaje (mala uppercase label, `text-muted`)
  - Kartica s **naslednjimi 3 prihodi**: linija (badge) + smer/destinacija + čas (npr. "3 min")
  - Naslednji prihod (prvi) poudarjen z `text-success` če je kmalu (≤3 min), ostali `text-secondary`
- Če postaja nima podatkov: "Ni podatkov o prihodih"
- Podatke beri iz `busData[stop.code]` (že naloženo)

Struktura LPP arrival objekta (preveri dejansko): `route_name` / `route` (linija), `eta_min` (minute), destinacija morda `trip_name` ali `route_name`. Prilagodi prikaz dejanskim poljem (isto kot že delaš za prvo postajo v kartici).

---

## KORAK 5: Bike modal

Bottom-sheet modal:

- Header: 🚲 + "BicikeLJ"
- Za VSAKO nastavljeno bike postajo:
  - Ime postaje + pod njim "X prostih mest" (`available_bike_stands`)
  - Desno veliko število koles (`available_bikes`)
  - Barva števila: `text-success` če >0, `text-danger` če 0
- Podatke beri iz `bikeData[station.number]`

BicikeLJ polja: `available_bikes` (koles), `available_bike_stands` (prosta mesta). Preveri dejanska imena v tvojem `fetchAllBikeStations` rezultatu.

---

## KORAK 6: i18n

Dodaj ključe (SL + EN):

```
avtobusi: "Avtobusi" / "Buses"
bicikelj: "BicikeLJ" / "BicikeLJ"
niPodatkovPrihodi: "Ni podatkov o prihodih" / "No arrival data"
prostihMest: "{n} prostih mest" / "{n} free stands"
tapniZaVse: "tapni {bus} ali {bike} za vse postaje" / "tap {bus} or {bike} for all stops"
vsePostaje: "Vse postaje" / "All stops"
```

---

## Pravila (COZY_CONTEXT.md)

- Minimalne, kirurške spremembe — ne prepisuj cele datoteke
- Ne spreminjaj polling/cache logike (refreshBus interval), samo razširi bike na vse postaje če ni že
- Hooks na vrhu
- Slovenščina, ne hrvaščina
- Light + dark tema
- Modali isti bottom-sheet stil kot obstoječi (Modal komponenta če obstaja, ali enak vzorec)

## Testni checklist

- [ ] 1 bus postaja: brez badge, kartica kaže prvo, tap ne odpre modala
- [ ] 2-3 bus postaje: badge "+1"/"+2", tap odpre modal z vsemi
- [ ] Bus modal: vsaka postaja, naslednji 3 prihodi, prvi poudarjen če kmalu
- [ ] 1 bike postaja: brez badge
- [ ] 2-3 bike postaje: badge, tap odpre modal
- [ ] Bike modal: koles + prosta mesta, rdeče če 0 koles
- [ ] Light + dark tema OK
- [ ] npm run build brez napak

## Opomba

Če se izkaže da bike modal potrebuje dodatna polja ki jih fetchAllBikeStations ne vrne, jih ni treba dodajati — pokaži kar je na voljo (koles + mesta je dovolj).
