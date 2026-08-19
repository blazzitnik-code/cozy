# Cožy — Home: tri fiksne ploščice (bus / bicikelj / navigacija)

## Kontekst

Preberi najprej `COZY_CONTEXT.md`. Spreminjamo ETA kartico v `components/HomeModule.js`.

**Trenutno:** grid 4 ploščic — 🚗 avto, 🚌 bus, 🚶 peš, 🚲 bicikelj. Avto in peš vedno kažeta "–" ker Routes API ni vklopljen (v backlogu). Dve prazni ploščici izgledata kot napaka.

**Cilj:** grid 3 ploščic — 🚌 bus, 🚲 bicikelj, 📍 navigacija. Vse tri delujejo in vse tri imajo isti vzorec: prva postavka + "+N" badge + tap odpre modal z vsemi.

Brez SQL sprememb — vsi podatki (bus_stops, bike_stations, destinations, shortcuts) so že v `home_settings`.

---

## KORAK 1: Odstrani avto in peš ploščici

- V ETA gridu odstrani 🚗 in 🚶 ploščici.
- Grid iz `grid-template-columns: 1fr 1fr 1fr 1fr` → `1fr 1fr 1fr`.
- Odstrani tudi namig "tap 🚌 or 🚲 for all stops" pod gridom — badge je dovolj evidenten.
- Kodo za avto/peš (če obstajajo placeholderji) lahko odstraniš; Routes API integracija je v backlogu in bo takrat dodana na novo.

---

## KORAK 2: Tretja ploščica = navigacija (destinations)

Destinacije so že v `settings.destinations` (max 3, vsaka ima `name` + `address`). Trenutno se prikazujejo kot ločena vrstica pod gridom ("📍 Work"). Premakni jih v grid kot tretjo ploščico, po istem vzorcu kot bus/bike:

- **Ploščica kaže PRVO destinacijo:**
  - Emoji 📍 zgoraj
  - Ime destinacije (`name`) kot glavni tekst — npr. "Work"
  - Pod njim naslov (`address`) kot podnapis (`sub`), v isti tipografiji kot "3" pri busu ali "Špica" pri biciklju
- **Badge "+N"** če je `destinations.length > 1` (enako kot bus/bike)
- **Tap:**
  - Če je 1 destinacija → odpre Google Maps navigacijo direktno (obstoječi `getMapsNavLink`)
  - Če je >1 → odpre **modal z vsemi destinacijami**

### Skrajšava naslova (fallback)

Naslov je lahko dolg ("Litostrojska cesta 52a") in ploščica ozka (~100px). Uporabnik lahko sam vpiše karkoli v polje `address` v settings, zato je to samo varovalo za predolge vnose:

```javascript
function shortAddress(addr) {
  if (!addr) return '';
  let s = addr.trim();
  s = s.replace(/\s+\d+[a-zA-Z]?$/, ''); // odreži hišno številko na koncu
  s = s.replace(/\bcesta\b/gi, 'c.').replace(/\bulica\b/gi, 'ul.');
  return s;
}
```

Poleg tega na elementu uporabi CSS ellipsis (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`) da se karkoli predolgega lepo odreže.

---

## KORAK 3: Modal za destinacije

Bottom-sheet modal (isti stil kot bus/bike modala):

- Header: 📍 + "Navigacija" / "Navigation"
- Seznam vseh destinacij, vsaka vrstica:
  - Ime (`name`) + pod njim poln naslov (`address`, nepokrajšan)
  - Desno puščica/ikona za navigacijo
  - Tap na vrstico → odpre Google Maps navigacijo za to destinacijo (`getMapsNavLink(settings.home_address, dest.address)`)

---

## KORAK 4: Shortcuts ostanejo nespremenjeni

Custom linki (shortcuts) se še naprej prikazujejo kot vrstice pod črto, kot doslej. Brez sprememb.

---

## KORAK 5: i18n

Dodaj/preveri ključe (SL + EN):

```
navigacija: "Navigacija" / "Navigation"
```

Odstrani ključ za namig "tapni za vse postaje" če ni več v rabi.

---

## Pravila (COZY_CONTEXT.md)

- Minimalne, kirurške spremembe — ne prepisuj cele datoteke
- Ne spreminjaj polling/cache logike za bus/bike
- Hooks na vrhu
- Slovenščina, ne hrvaščina
- Light + dark tema
- Modal isti bottom-sheet vzorec kot obstoječa bus/bike modala

## Testni checklist

- [ ] Grid ima 3 ploščice, avto in peš odstranjena
- [ ] Namig pod gridom odstranjen
- [ ] Navigacija ploščica: ime + naslov, badge "+N" če >1 destinacija
- [ ] 1 destinacija → tap odpre Maps direktno
- [ ] >1 destinacija → tap odpre modal z vsemi, tap na vrstico odpre Maps
- [ ] Dolg naslov se lepo skrajša (ne razbije layouta)
- [ ] Bus in bike ploščici delujeta kot doslej
- [ ] Shortcuts pod črto nespremenjeni
- [ ] Light + dark tema OK
- [ ] npm run build brez napak
