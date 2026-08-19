# Cožy — Font optimizacija

## Kontekst

Preberi `COZY_CONTEXT.md`. Majhen performance task, nizko tveganje.

Lighthouse (incognito, 88/100) kaže **4 woff2 datoteke, skupaj ~257 KiB**:

- 84 KiB · 1bffadaabf893a1e-s.p.woff2
- 66 KiB · 791bf8c4bb753ed6-s.p.woff2
- 59 KiB · e455bcff747f0d5e-s.p.woff2
- 48 KiB · 83afe278b6a6bb3c-s.p.woff2

To je verjetno več, kot app dejansko rabi. Cilj: ugotoviti katere so in odrezati nepotrebne.

---

## KORAK 1: Ugotovi kaj se nalaga

Poišči kje se fonti definirajo — verjetno `app/layout.js` (`next/font/google` ali `next/font/local`) in/ali `app/globals.css`.

Izpiši seznam: kateri font, katere uteži (weights), kateri subseti (latin, latin-ext), kateri stili (normal/italic).

Pomembno: app je v slovenščini — potrebuje **latin-ext** subset (šumniki č/š/ž). Tega ne odstranjuj.

---

## KORAK 2: Odreži nepotrebno

Tipični viri odvečnih datotek:

- **Preveč uteži** — če je naloženih npr. 300/400/500/600/700/800/900, app pa uporablja samo 3-4. Vsaka utež = svoja datoteka.
- **Neuporabljen font** — npr. serif za logo naložen kot cel font, čeprav se uporablja samo za besedo "Cožy". Za logo je bolje uporabiti sistemski serif (`font-family: Georgia, serif`) ali SVG.
- **Italic varianta** — če se nikjer ne uporablja.
- **Preveč subsetov** — če je naložen cyrillic/greek, ki ju ne rabiš.

Preveri v kodi katere `font-weight` vrednosti so dejansko v rabi (grep za `font-weight`, `fontWeight`, Tailwind `font-*` razrede). Naloži samo tiste.

---

## KORAK 3: Preveri da so pravilno nastavljeni

Če uporabljaš `next/font`, preveri da ima:

- `display: 'swap'` — besedilo se prikaže takoj s sistemskim fontom, zamenja ko se naloži
- `subsets: ['latin', 'latin-ext']` — latin-ext je nujen za šumnike
- `weight: [...]` — samo dejansko uporabljene uteži

---

## Pravila

- Minimalne spremembe
- Po spremembi VIZUALNO preveri app (light + dark, home + vsi moduli) da se tipografija ni razsula
- Posebej preveri šumnike (č, š, ž) — če izginejo ali se prikažejo v fallback fontu, je latin-ext subset odstranjen po pomoti
- `npm run build` brez napak

## Testni checklist

- [ ] Seznam naloženih fontov/uteži izpisan pred spremembo
- [ ] Odstranjene samo neuporabljene uteži/variante
- [ ] Šumniki (č š ž) se pravilno prikažejo povsod
- [ ] Logo "Cožy" izgleda enako kot prej
- [ ] Tipografija nespremenjena na home, Zmrzko, Trgovko, Koledarko, Listko
- [ ] Light + dark tema OK
- [ ] npm run build brez napak
- [ ] Po deployu: nov Lighthouse (INCOGNITO) — manj woff2 datotek, manjši transfer
