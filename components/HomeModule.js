'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { House, Pencil, RotateCw, X } from 'lucide-react';
import { cx } from '@/lib/utils';
import { motion } from 'motion/react';
import { Modal, Input, Card, SectionHeader, ModalActions, POPOVER, POPOVER_POP, PRESS_SM, ROW_PRESS } from './ui';

const BIKE_API_KEY = process.env.NEXT_PUBLIC_BICIKELJ_API_KEY;
const BIKE_CONTRACT = 'ljubljana';

// Repeated class recipes local to this module
const DIM_LABEL = 'text-stone-400 dark:text-stone-600';
const ROW = 'flex gap-1.5 mb-2 items-center';
const CHIP =
  'flex-1 bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-white/10 rounded-lg py-2 px-3';
const ADD_BTN = cx(
  'cursor-pointer rounded-full border-none bg-stone-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-stone-100 dark:text-stone-900',
  PRESS_SM,
);
const RM_BTN = cx(
  'flex h-10.5 w-10.5 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-red-500/10 text-red-600 dark:text-red-400',
  PRESS_SM,
);
// One cell of the Domov ETA grid (bus / bike / navigation). Inner tile on a
// subtle secondary surface, matching the compact mock.
function EtaTile({ emoji, value, sub, tone, badge, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'relative rounded-xl bg-stone-50 px-1 py-2 text-center dark:bg-stone-950/60',
        onClick && cx('cursor-pointer', PRESS_SM),
      )}
    >
      {badge != null && (
        <span className="absolute top-1 right-1 rounded-full bg-orange-500/15 px-1.25 py-px text-[9px] font-bold text-orange-600 dark:text-orange-400">
          {badge}
        </span>
      )}
      <div className="text-sm">{emoji}</div>
      <div className={cx('truncate text-sm leading-tight font-bold', tone || 'text-stone-900 dark:text-stone-100')}>
        {value}
      </div>
      <div className="truncate text-[9px] text-stone-400 dark:text-stone-500">{sub || ' '}</div>
    </div>
  );
}

// Trim overly long addresses so the navigation tile subtitle stays on one line.
// Safety net only — the user types the address; CSS ellipsis handles the rest.
function shortAddress(addr) {
  if (!addr) return '';
  return addr
    .trim()
    .replace(/\s+\d+[a-zA-Z]?$/, '') // drop a trailing house number
    .replace(/\bcesta\b/gi, 'c.')
    .replace(/\bulica\b/gi, 'ul.');
}

// Both LPP calls go through our own /api/lpp/* proxy — data.lpp.si has no CORS
// headers, so calling it from the browser is blocked (see app/api/lpp/*).
async function fetchLppStations() {
  try {
    const res = await fetch('/api/lpp/stations');
    const json = await res.json();
    return json?.data || [];
  } catch {
    return [];
  }
}

async function fetchBusArrivals(stationCode) {
  try {
    const res = await fetch(`/api/lpp/arrivals?station-code=${encodeURIComponent(stationCode)}`);
    const json = await res.json();
    return json?.data || [];
  } catch {
    return [];
  }
}

async function fetchAllBikeStations() {
  try {
    const res = await fetch(
      `https://api.jcdecaux.com/vls/v1/stations?contract=${BIKE_CONTRACT}&apiKey=${BIKE_API_KEY}`,
    );
    return await res.json();
  } catch {
    return [];
  }
}

function mapsNavLink(from, to) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from || '')}&destination=${encodeURIComponent(to || '')}&travelmode=driving`;
}
function mapsTrafficLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || 'Ljubljana')}`;
}

// ─── STATION SEARCH DROPDOWN ───
function StationSearch({ placeholder, stations, onSelect }) {
  const [query, setQuery] = useState('');
  const results =
    query.length > 1 ? stations.filter((s) => s.name?.toLowerCase().includes(query.toLowerCase())).slice(0, 6) : [];

  return (
    <div className="relative mb-2">
      <Input size="xs" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} />
      {results.length > 0 && (
        <motion.div
          {...POPOVER_POP}
          className={cx(POPOVER, 'absolute inset-x-0 top-full z-50 mt-1 origin-top overflow-hidden rounded-lg p-0')}
        >
          {results.map((s, i) => (
            <div
              key={i}
              onClick={() => {
                onSelect(s);
                setQuery('');
              }}
              className={cx(
                'px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                ROW_PRESS,
                i < results.length - 1 && 'border-b border-stone-200 dark:border-white/10',
              )}
            >
              {s.name}
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ─── EDIT MODAL ───
// Always-mounted Modal shell; the form body renders only while open, so its
// useState-from-props form state and the stations fetch reset on every open.
function EditModal({ open, settings, onSave, onClose }) {
  return (
    <Modal open={open} onClose={onClose}>
      <EditModalBody settings={settings} onSave={onSave} onClose={onClose} />
    </Modal>
  );
}

function EditModalBody({ settings, onSave, onClose }) {
  const t = useTranslations('HomeModule');
  const tc = useTranslations('Common');
  const ta = useTranslations('A11y');
  const [homeAddress, setHomeAddress] = useState(settings?.home_address || '');
  const [destinations, setDestinations] = useState(settings?.destinations?.length ? settings.destinations : []);
  const [shortcuts, setShortcuts] = useState(settings?.shortcuts?.length ? settings.shortcuts : []);
  const [busStops, setBusStops] = useState(settings?.bus_stops?.length ? settings.bus_stops : []);
  const [bikeStations, setBikeStations] = useState(settings?.bike_stations?.length ? settings.bike_stations : []);
  const [lppStations, setLppStations] = useState([]);
  const [allBikeStations, setAllBikeStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchLppStations(), fetchAllBikeStations()])
      .then(([lpp, bike]) => {
        if (cancelled) return;
        setLppStations(lpp);
        setAllBikeStations(Array.isArray(bike) ? bike : []);
      })
      .finally(() => {
        if (!cancelled) setLoadingStations(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = () => {
    onSave({
      home_address: homeAddress,
      destinations: destinations.filter((d) => d.name && d.address),
      shortcuts: shortcuts.filter((s) => s.name && s.url),
      bus_stops: busStops.filter((s) => s.name && s.code),
      bike_stations: bikeStations.filter((s) => s.name && s.number !== undefined),
    });
  };

  return (
    <>
      <h3 className="mb-5 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
        {t('settingsTitle')}
      </h3>

      {/* Home address */}
      <SectionHeader className="mb-1.5">{t('homeAddress')}</SectionHeader>
      <Input
        size="xs"
        value={homeAddress}
        onChange={(e) => setHomeAddress(e.target.value)}
        placeholder={t('homeAddressPlaceholder')}
        className="mb-5"
      />

      {/* Destinations */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader className="mb-0">{t('navigation')}</SectionHeader>
          {destinations.length < 3 && (
            <button onClick={() => setDestinations([...destinations, { name: '', address: '' }])} className={ADD_BTN}>
              {t('addBtn')}
            </button>
          )}
        </div>
        {destinations.map((d, i) => (
          <div key={i} className={ROW}>
            <Input
              size="xs"
              value={d.name}
              onChange={(e) => {
                const n = [...destinations];
                n[i] = { ...n[i], name: e.target.value };
                setDestinations(n);
              }}
              placeholder={tc('name')}
              className="max-w-22.5"
            />
            <Input
              size="xs"
              value={d.address}
              onChange={(e) => {
                const n = [...destinations];
                n[i] = { ...n[i], address: e.target.value };
                setDestinations(n);
              }}
              placeholder={t('address')}
              className="flex-1"
            />
            <button
              aria-label={ta('remove')}
              onClick={() => setDestinations(destinations.filter((_, j) => j !== i))}
              className={RM_BTN}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Shortcuts */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader className="mb-0">{t('shortcuts')}</SectionHeader>
          {shortcuts.length < 6 && (
            <button onClick={() => setShortcuts([...shortcuts, { name: '', url: '', emoji: '' }])} className={ADD_BTN}>
              {t('addBtn')}
            </button>
          )}
        </div>
        {shortcuts.map((s, i) => (
          <div key={i} className={ROW}>
            <Input
              size="xs"
              value={s.emoji}
              onChange={(e) => {
                const n = [...shortcuts];
                n[i] = { ...n[i], emoji: e.target.value };
                setShortcuts(n);
              }}
              placeholder="🔗"
              className="w-12 shrink-0 px-1 text-center text-lg"
            />
            <Input
              size="xs"
              value={s.name}
              onChange={(e) => {
                const n = [...shortcuts];
                n[i] = { ...n[i], name: e.target.value };
                setShortcuts(n);
              }}
              placeholder={tc('name')}
              className="max-w-22.5"
            />
            <Input
              size="xs"
              value={s.url}
              onChange={(e) => {
                const n = [...shortcuts];
                n[i] = { ...n[i], url: e.target.value };
                setShortcuts(n);
              }}
              placeholder={t('linkPlaceholder')}
              className="flex-1"
            />
            <button
              aria-label={ta('remove')}
              onClick={() => setShortcuts(shortcuts.filter((_, j) => j !== i))}
              className={RM_BTN}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {/* LPP bus stops */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader className="mb-0">{t('lppStops')}</SectionHeader>
        </div>
        {busStops.map((s, i) => (
          <div key={i} className={ROW}>
            <div className={CHIP}>
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">{s.name}</div>
              <div className="text-xs text-stone-400 dark:text-stone-500">{t('codeLabel', { code: s.code })}</div>
            </div>
            <button
              aria-label={ta('remove')}
              onClick={() => setBusStops(busStops.filter((_, j) => j !== i))}
              className={RM_BTN}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {busStops.length < 3 &&
          (loadingStations ? (
            <div className="py-2 text-xs text-stone-400 dark:text-stone-500">{t('loadingStations')}</div>
          ) : lppStations.length > 0 ? (
            <StationSearch
              placeholder={t('searchLpp')}
              stations={lppStations}
              onSelect={(s) =>
                setBusStops([
                  ...busStops,
                  { name: s.name, code: s.ref_id || s.station_code || s.code || String(s.id || '') },
                ])
              }
            />
          ) : (
            <div className="py-2 text-xs text-stone-400 dark:text-stone-500">
              {t('searchUnavailable')} <span className="text-orange-600 dark:text-orange-400">opendata.si/lpp</span>
            </div>
          ))}
      </div>

      {/* BicikeLJ stations */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader className="mb-0">{t('bikeStations')}</SectionHeader>
        </div>
        {bikeStations.map((s, i) => (
          <div key={i} className={ROW}>
            <div className={CHIP}>
              <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">{s.name}</div>
              <div className="text-xs text-stone-400 dark:text-stone-500">
                {t('stationNumber', { number: s.number })}
              </div>
            </div>
            <button
              aria-label={ta('remove')}
              onClick={() => setBikeStations(bikeStations.filter((_, j) => j !== i))}
              className={RM_BTN}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        {bikeStations.length < 3 &&
          (loadingStations ? (
            <div className="py-2 text-xs text-stone-400 dark:text-stone-500">{t('loadingStations')}</div>
          ) : (
            <StationSearch
              placeholder={t('searchBike')}
              stations={allBikeStations.map((s) => ({ name: s.name, number: s.number }))}
              onSelect={(s) => setBikeStations([...bikeStations, { name: s.name, number: s.number }])}
            />
          ))}
      </div>

      <ModalActions onSave={handleSave} onCancel={onClose} />
    </>
  );
}

// Last-fetched bus/bike data, kept at module scope so a tab-switch remount
// paints the previous values instantly and revalidates in the background
// (state alone would reset — the module unmounts on every tab switch).
let busCache = {};
let bikeCache = {};

// ─── MAIN COMPONENT ───
// `settings`/`loading`/`saveSettings` come from AppShell's persistent
// useHomeSettings, so tab entry renders warm data without a refetch.
export default function HomeModule({ settings, loading, saveSettings }) {
  const t = useTranslations('HomeModule');
  const ta = useTranslations('A11y');
  const [editing, setEditing] = useState(false);
  const [busModalOpen, setBusModalOpen] = useState(false);
  const [bikeModalOpen, setBikeModalOpen] = useState(false);
  const [navModalOpen, setNavModalOpen] = useState(false);
  const [busData, setBusData] = useState(() => busCache);
  const [bikeData, setBikeData] = useState(() => bikeCache);
  const [busRefreshing, setBusRefreshing] = useState(false);
  // The module unmounts on every tab switch — stop the sequential fetch loop
  // instead of letting it keep fetching (and setting state) after unmount.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  // The 120 s interval and the manual refresh button share this loop — an
  // overlapping second run would fight over busRefreshing and refetch the
  // same stops.
  const busInflight = useRef(false);

  const refreshBus = useCallback(async () => {
    if (!settings?.bus_stops?.length || busInflight.current) return;
    busInflight.current = true;
    setBusRefreshing(true);
    for (const stop of settings.bus_stops) {
      if (!stop.code) continue;
      const arrivals = await fetchBusArrivals(stop.code);
      busCache = { ...busCache, [stop.code]: arrivals };
      if (!alive.current) break;
      setBusData(busCache);
    }
    busInflight.current = false;
    if (alive.current) setBusRefreshing(false);
  }, [settings]);

  const refreshBike = useCallback(async () => {
    if (!settings?.bike_stations?.length) return;
    const all = await fetchAllBikeStations();
    if (!Array.isArray(all)) return;
    const map = {};
    for (const station of settings.bike_stations) {
      const found = all.find((s) => s.number === station.number);
      if (found) map[station.number] = found;
    }
    bikeCache = map;
    if (alive.current) setBikeData(map);
  }, [settings]);

  useEffect(() => {
    refreshBus();
    refreshBike();
    const interval = setInterval(refreshBus, 120000);
    return () => clearInterval(interval);
  }, [refreshBus, refreshBike]);

  const handleSave = async (data) => {
    await saveSettings(data);
    setEditing(false);
  };

  // Reserve the Domov card's height while settings load so the sections below
  // don't shift down when it appears (CLS).
  if (loading)
    return (
      <div className="mb-2.5 h-[124px] rounded-2xl border border-stone-200/70 bg-white dark:border-white/10 dark:bg-stone-900" />
    );

  const destinations = settings?.destinations || [];
  const shortcuts = settings?.shortcuts || [];
  const busStops = settings?.bus_stops || [];
  const bikeStations = settings?.bike_stations || [];

  // ─── EMPTY STATE ───
  if (!settings?.home_address) {
    return (
      <div className="mb-5">
        <SectionHeader className={DIM_LABEL}>{t('sectionTitle')}</SectionHeader>
        <Card onClick={() => setEditing(true)} className="px-4 py-5 text-center">
          <div className="mb-2 text-4xl">🏠</div>
          <div className="mb-1 text-sm font-bold text-stone-900 dark:text-stone-100">{t('setupTitle')}</div>
          <div className="text-xs text-stone-400 dark:text-stone-500">{t('setupDesc')}</div>
        </Card>
        <EditModal open={editing} settings={settings} onSave={handleSave} onClose={() => setEditing(false)} />
      </div>
    );
  }

  // ─── MAIN DISPLAY (consolidated "Domov" card) ───
  // Car/walk are placeholders ("–") until a Routes API is wired; bus reads the
  // first configured LPP stop's next arrival, bike the first BicikeLJ station.
  const firstBus = busStops[0];
  const busArr = firstBus ? (busData[firstBus.code] || [])[0] : null;
  const busEtaMin = busArr
    ? busArr.eta_seconds != null
      ? Math.round(busArr.eta_seconds / 60)
      : (busArr.eta_min ?? busArr.eta)
    : null;
  const busVal = busEtaMin != null ? t('minutes', { min: busEtaMin }) : '–';
  const busSub = firstBus ? busArr?.route_name || busArr?.route_id || busArr?.line || firstBus.name : t('noData');

  const firstBike = bikeStations[0];
  const bike0 = firstBike ? bikeData[firstBike.number] : null;
  const bikeVal = firstBike ? (bike0?.available_bikes ?? '?') : '–';
  const bikeTone =
    firstBike && bike0?.available_bikes === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';

  const firstDest = destinations[0];

  return (
    <div className="mb-2.5">
      <Card className="rounded-2xl px-3.5 py-3">
        {/* Header: House + Domov + Maps + refresh + edit */}
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <House className="size-3.5 text-stone-900 dark:text-stone-100" />
            <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('home')}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <a
              href={mapsTrafficLink(settings.home_address)}
              target="_blank"
              rel="noopener noreferrer"
              className={cx('text-[11px] font-semibold text-orange-600 no-underline dark:text-orange-400', PRESS_SM)}
            >
              {t('mapsShort')}
            </a>
            {firstBus && (
              <button
                aria-label={ta('refresh')}
                onClick={refreshBus}
                className={cx(
                  'cursor-pointer border-none bg-transparent p-0.5 text-stone-400 dark:text-stone-500',
                  PRESS_SM,
                )}
              >
                <RotateCw className={cx('size-3.5', busRefreshing && 'animate-spin motion-reduce:animate-none')} />
              </button>
            )}
            <button
              aria-label={ta('edit')}
              onClick={() => setEditing(true)}
              className={cx(
                'cursor-pointer border-none bg-transparent p-0.5 text-stone-400 dark:text-stone-500',
                PRESS_SM,
              )}
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        </div>

        {/* 3-col ETA grid: bus / bike / navigation */}
        <div className="grid grid-cols-3 gap-1.5">
          <EtaTile
            emoji="🚌"
            value={busVal}
            sub={busSub}
            badge={busStops.length > 1 ? `+${busStops.length - 1}` : null}
            onClick={busStops.length > 1 ? () => setBusModalOpen(true) : undefined}
          />
          <EtaTile
            emoji="🚲"
            value={bikeVal}
            sub={firstBike?.name}
            tone={firstBike ? bikeTone : undefined}
            badge={bikeStations.length > 1 ? `+${bikeStations.length - 1}` : null}
            onClick={bikeStations.length > 1 ? () => setBikeModalOpen(true) : undefined}
          />
          <EtaTile
            emoji="📍"
            value={firstDest ? firstDest.name : '–'}
            sub={firstDest ? shortAddress(firstDest.address) : undefined}
            badge={destinations.length > 1 ? `+${destinations.length - 1}` : null}
            onClick={
              destinations.length > 1
                ? () => setNavModalOpen(true)
                : firstDest
                  ? () => window.open(mapsNavLink(settings.home_address, firstDest.address), '_blank', 'noopener')
                  : undefined
            }
          />
        </div>

        {/* Shortcuts */}
        {shortcuts.length > 0 && (
          <div className="mt-1.5 flex flex-col gap-px border-t border-dotted border-stone-300 pt-1.5 dark:border-stone-700">
            {shortcuts.map((s, i) => (
              <a
                key={i}
                href={s.url.startsWith('http') ? s.url : 'https://' + s.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cx('flex items-center gap-2 rounded-lg px-1.5 py-1.5 no-underline', ROW_PRESS)}
              >
                <span className="text-base">{s.emoji || '🔗'}</span>
                <span className="flex-1 truncate text-xs font-semibold text-stone-700 dark:text-stone-300">
                  {s.name}
                </span>
                <span className="text-[10px] text-stone-400 dark:text-stone-500">↗</span>
              </a>
            ))}
          </div>
        )}
      </Card>

      <EditModal open={editing} settings={settings} onSave={handleSave} onClose={() => setEditing(false)} />

      {/* All bus stops — next 3 arrivals each */}
      <Modal open={busModalOpen} onClose={() => setBusModalOpen(false)}>
        <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          🚌 {t('avtobusi')}
        </h3>
        <div className="flex flex-col gap-4">
          {busStops.map((stop, si) => {
            const arrivals = (busData[stop.code] || []).slice(0, 3);
            return (
              <div key={si}>
                <div className="mb-1 text-[11px] font-bold tracking-[1px] text-stone-400 uppercase dark:text-stone-500">
                  {stop.name}
                </div>
                {arrivals.length === 0 ? (
                  <div className="py-1 text-sm text-stone-400 dark:text-stone-500">{t('niPodatkovPrihodi')}</div>
                ) : (
                  arrivals.map((a, ai) => {
                    const eta = a.eta_seconds != null ? Math.round(a.eta_seconds / 60) : (a.eta_min ?? a.eta);
                    const soon = ai === 0 && eta != null && eta <= 3;
                    return (
                      <div
                        key={ai}
                        className="flex items-center gap-2.5 border-b border-dotted border-stone-300 py-2 last:border-b-0 dark:border-stone-700"
                      >
                        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-stone-900 px-1.5 text-xs font-bold text-white dark:bg-stone-100 dark:text-stone-900">
                          {a.route_name || a.route_id || '?'}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-stone-700 dark:text-stone-300">
                          {a.stations?.arrival || a.trip_name || ''}
                        </span>
                        <span
                          className={cx(
                            'shrink-0 text-sm font-bold',
                            soon ? 'text-green-600 dark:text-green-400' : 'text-stone-500 dark:text-stone-400',
                          )}
                        >
                          {eta != null ? t('minutes', { min: eta }) : '–'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* All BicikeLJ stations — bikes + free stands */}
      <Modal open={bikeModalOpen} onClose={() => setBikeModalOpen(false)}>
        <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          🚲 {t('bicikelj')}
        </h3>
        <div className="flex flex-col">
          {bikeStations.map((station, si) => {
            const d = bikeData[station.number];
            const bikes = d?.available_bikes;
            const stands = d?.available_bike_stands;
            return (
              <div
                key={si}
                className="flex items-center gap-3 border-b border-dotted border-stone-300 py-2.5 last:border-b-0 dark:border-stone-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">{station.name}</div>
                  {stands != null && (
                    <div className="text-xs text-stone-400 dark:text-stone-500">{t('prostihMest', { n: stands })}</div>
                  )}
                </div>
                <div
                  className={cx(
                    'shrink-0 text-2xl font-extrabold',
                    bikes === 0
                      ? 'text-red-600 dark:text-red-400'
                      : bikes != null
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-stone-400 dark:text-stone-500',
                  )}
                >
                  {bikes ?? '?'}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      {/* All destinations — tap a row to navigate in Google Maps */}
      <Modal open={navModalOpen} onClose={() => setNavModalOpen(false)}>
        <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          📍 {t('navigacija')}
        </h3>
        <div className="flex flex-col">
          {destinations.map((dest, i) => (
            <a
              key={i}
              href={mapsNavLink(settings.home_address, dest.address)}
              target="_blank"
              rel="noopener noreferrer"
              className={cx(
                'flex items-center gap-3 border-b border-dotted border-stone-300 py-2.5 no-underline last:border-b-0 dark:border-stone-700',
                ROW_PRESS,
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">{dest.name}</div>
                {dest.address && (
                  <div className="truncate text-xs text-stone-400 dark:text-stone-500">{dest.address}</div>
                )}
              </div>
              <span className="shrink-0 text-base text-orange-600 dark:text-orange-400">↗</span>
            </a>
          ))}
        </div>
      </Modal>
    </div>
  );
}
