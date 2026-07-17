'use client';
import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Pencil, RotateCw, X } from 'lucide-react';
import { useHomeSettings } from '@/lib/hooks';
import { cx } from '@/lib/utils';
import { Modal, Input, Card, SectionHeader, ModalActions, POPOVER, PRESS_SM } from './ui';

const LPP_BASE = 'https://data.lpp.si/api';
const BIKE_API_KEY = process.env.NEXT_PUBLIC_BICIKELJ_API_KEY;
const BIKE_CONTRACT = 'ljubljana';

// Repeated class recipes local to this module
const DIM_LABEL = 'text-stone-400 dark:text-stone-600';
const ROW = 'flex gap-1.5 mb-2 items-center';
const CHIP =
  'flex-1 bg-stone-50 dark:bg-stone-950/60 border border-stone-200 dark:border-white/10 rounded-lg py-2 px-3';
const ADD_BTN =
  'text-xs py-1 px-2.5 rounded-full border-none bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 cursor-pointer font-bold';
const RM_BTN =
  'w-9 h-9 rounded-full border-none bg-red-500/10 text-red-600 dark:text-red-400 cursor-pointer shrink-0 flex items-center justify-center';
const TILE = 'rounded-xl py-3 px-2 text-center';

async function fetchLppStations() {
  try {
    const res = await fetch(`${LPP_BASE}/station/active-stations`);
    const json = await res.json();
    return json?.data || [];
  } catch {
    return [];
  }
}

async function fetchBusArrivals(stationCode) {
  try {
    const res = await fetch(`${LPP_BASE}/station/arrival-on-station?station-code=${stationCode}&route-id=&limit=5`);
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
        <div className={cx(POPOVER, 'absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg p-0')}>
          {results.map((s, i) => (
            <div
              key={i}
              onClick={() => {
                onSelect(s);
                setQuery('');
              }}
              className={cx(
                'cursor-pointer px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                i < results.length - 1 && 'border-b border-stone-200 dark:border-white/10',
              )}
            >
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EDIT MODAL ───
function EditModal({ settings, onSave, onClose }) {
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
    Promise.all([fetchLppStations(), fetchAllBikeStations()])
      .then(([lpp, bike]) => {
        setLppStations(lpp);
        setAllBikeStations(Array.isArray(bike) ? bike : []);
      })
      .finally(() => setLoadingStations(false));
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
    <Modal onClose={onClose}>
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
          <SectionHeader className="mb-1.5">{t('navigation')}</SectionHeader>
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
          <SectionHeader className="mb-1.5">{t('shortcuts')}</SectionHeader>
          {shortcuts.length < 6 && (
            <button onClick={() => setShortcuts([...shortcuts, { name: '', url: '', emoji: '' }])} className={ADD_BTN}>
              {t('addBtn')}
            </button>
          )}
        </div>
        {shortcuts.map((s, i) => (
          <div key={i} className={ROW}>
            <input
              value={s.emoji}
              onChange={(e) => {
                const n = [...shortcuts];
                n[i] = { ...n[i], emoji: e.target.value };
                setShortcuts(n);
              }}
              placeholder="🔗"
              className="box-border w-12 shrink-0 rounded-lg border border-stone-300 bg-white px-1 py-2.5 text-center text-lg text-stone-900 transition-colors outline-none focus:border-orange-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
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
              placeholder="https://..."
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
          <SectionHeader className="mb-1.5">{t('lppStops')}</SectionHeader>
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
          <SectionHeader className="mb-1.5">{t('bikeStations')}</SectionHeader>
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
    </Modal>
  );
}

// ─── MAIN COMPONENT ───
export default function HomeModule({ user, householdId }) {
  const t = useTranslations('HomeModule');
  const ta = useTranslations('A11y');
  const { settings, loading, saveSettings } = useHomeSettings(householdId, user.id);
  const [editing, setEditing] = useState(false);
  const [busData, setBusData] = useState({});
  const [bikeData, setBikeData] = useState({});

  const refreshBus = useCallback(async () => {
    if (!settings?.bus_stops?.length) return;
    for (const stop of settings.bus_stops) {
      if (!stop.code) continue;
      const arrivals = await fetchBusArrivals(stop.code);
      setBusData((prev) => ({ ...prev, [stop.code]: arrivals }));
    }
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
    setBikeData(map);
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

  if (loading) return null;

  const destinations = settings?.destinations || [];
  const shortcuts = settings?.shortcuts || [];
  const busStops = settings?.bus_stops || [];
  const bikeStations = settings?.bike_stations || [];
  const gridCols = (n) => (n === 1 ? 'grid-cols-1' : n === 2 ? 'grid-cols-2' : 'grid-cols-3');

  // ─── EMPTY STATE ───
  if (!settings?.home_address) {
    return (
      <div className="mb-5">
        <SectionHeader className={DIM_LABEL}>{t('sectionTitle')}</SectionHeader>
        <Card onClick={() => setEditing(true)} className="cursor-pointer px-4 py-5 text-center">
          <div className="mb-2 text-4xl">🏠</div>
          <div className="mb-1 text-sm font-bold text-stone-900 dark:text-stone-100">{t('setupTitle')}</div>
          <div className="text-xs text-stone-400 dark:text-stone-500">{t('setupDesc')}</div>
        </Card>
        {editing && <EditModal settings={settings} onSave={handleSave} onClose={() => setEditing(false)} />}
      </div>
    );
  }

  // ─── MAIN DISPLAY ───
  return (
    <div className="mb-5">
      <div className="mb-2.5 flex items-center justify-between">
        <SectionHeader className={DIM_LABEL}>{t('sectionTitle')}</SectionHeader>
        <button
          aria-label={ta('edit')}
          onClick={() => setEditing(true)}
          className={cx('cursor-pointer border-none bg-transparent p-1 text-stone-400 dark:text-stone-500', PRESS_SM)}
        >
          <Pencil className="size-4" />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {/* Traffic → Google Maps */}
        <a
          href={mapsTrafficLink(settings.home_address)}
          target="_blank"
          rel="noopener noreferrer"
          className="no-underline"
        >
          <Card className="flex items-center gap-3 rounded-xl px-3.5 py-3">
            <span className="text-2xl">🚦</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('traffic')}</div>
              <div className="text-xs text-stone-400 dark:text-stone-500">{t('viewInMaps')}</div>
            </div>
          </Card>
        </a>

        {/* Destinations grid */}
        {destinations.length > 0 && (
          <div className={cx('grid gap-2', gridCols(destinations.length))}>
            {destinations.map((dest, i) => (
              <a
                key={i}
                href={mapsNavLink(settings.home_address, dest.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline"
              >
                <Card className={TILE}>
                  <div className="mb-1 text-xl">📍</div>
                  <div className="overflow-hidden text-xs font-bold text-ellipsis whitespace-nowrap text-stone-900 dark:text-stone-100">
                    {dest.name}
                  </div>
                  <div className="mt-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                    {t('navigate')}
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}

        {/* Shortcuts grid (always 2 cols except 1 = full width) */}
        {shortcuts.length > 0 && (
          <div className={cx('grid gap-2', shortcuts.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
            {shortcuts.map((s, i) => (
              <a
                key={i}
                href={s.url.startsWith('http') ? s.url : 'https://' + s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="no-underline"
              >
                <Card className={TILE}>
                  <div className="mb-1 text-2xl">{s.emoji || '🔗'}</div>
                  <div className="overflow-hidden text-xs font-bold text-ellipsis whitespace-nowrap text-stone-900 dark:text-stone-100">
                    {s.name}
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}

        {/* LPP bus arrivals */}
        {busStops.map((stop, i) => {
          const arrivals = busData[stop.code] || [];
          return (
            <Card key={i} className="rounded-xl px-3.5 py-3">
              <div className={cx('flex items-center gap-2', arrivals.length > 0 && 'mb-2')}>
                <span className="text-lg">🚌</span>
                <div className="flex-1 text-sm font-bold text-stone-900 dark:text-stone-100">{stop.name}</div>
                <button
                  aria-label={ta('refresh')}
                  onClick={refreshBus}
                  className="cursor-pointer border-none bg-transparent p-1 text-sm text-stone-400 dark:text-stone-500"
                >
                  <RotateCw className="size-4" />
                </button>
              </div>
              {arrivals.length === 0 ? (
                <div className="text-xs text-stone-400 dark:text-stone-500">{t('noData')}</div>
              ) : (
                arrivals.slice(0, 3).map((arr, j) => {
                  const eta = arr.eta_min ?? arr.eta ?? arr.eta_seconds;
                  const etaMin = arr.eta_seconds != null ? Math.round(arr.eta_seconds / 60) : eta;
                  return (
                    <div
                      key={j}
                      className={cx(
                        'flex items-center justify-between py-1 text-sm',
                        j > 0 && 'border-t border-dotted border-stone-200 dark:border-stone-800',
                      )}
                    >
                      <span className="font-bold text-stone-900 dark:text-stone-100">
                        {arr.route_name || arr.route_id || arr.line || '—'}
                      </span>
                      <span
                        className={cx(
                          'font-semibold',
                          etaMin <= 2 ? 'text-green-600 dark:text-green-400' : 'text-stone-400 dark:text-stone-500',
                        )}
                      >
                        {etaMin <= 0 ? t('arriving') : t('minutes', { min: etaMin })}
                      </span>
                    </div>
                  );
                })
              )}
            </Card>
          );
        })}

        {/* BicikeLJ */}
        {bikeStations.length > 0 && (
          <div className={cx('grid gap-2', gridCols(bikeStations.length))}>
            {bikeStations.map((station, i) => {
              const data = bikeData[station.number];
              const available = data?.available_bikes ?? '?';
              const stands = data?.available_bike_stands ?? '?';
              return (
                <Card key={i} className={TILE}>
                  <div className="mb-1 text-lg">🚲</div>
                  <div className="mb-0.5 overflow-hidden text-xs font-bold text-ellipsis whitespace-nowrap text-stone-900 dark:text-stone-100">
                    {station.name}
                  </div>
                  <div
                    className={cx(
                      'text-2xl leading-none font-extrabold',
                      available === 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
                    )}
                  >
                    {available}
                  </div>
                  <div className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">
                    {typeof stands === 'number' ? t('stands', { count: stands }) : t('standsUnknown')}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {editing && <EditModal settings={settings} onSave={handleSave} onClose={() => setEditing(false)} />}
    </div>
  );
}
