'use client';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { useTranslations, useFormatter } from 'next-intl';
import { ChevronRight, House, Pencil, Plus, Wind, Droplets, X } from 'lucide-react';
import { cx, weatherInfo, weatherLocationsOf, localDateFromStr } from '@/lib/utils';
import { fetchWeatherOnce, geocodeLocation } from '@/lib/hooks';
import { Card, Modal, Input, SectionHeader, POPOVER, POPOVER_POP, ROW_PRESS, PRESS_SM } from './ui';

// ─── 7-DAY FORECAST ROW (shared: compact + full modal) ───
function SevenDayRow({ daily }) {
  const tw = useTranslations('Weather');
  const format = useFormatter();
  if (!daily?.time?.length) return null;
  return (
    <div className="grid grid-cols-7 gap-1">
      {daily.time.map((d, i) => (
        <div key={d} className="flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-center">
          <div className="text-[10px] font-semibold text-stone-400 uppercase dark:text-stone-500">
            {format.dateTime(localDateFromStr(d), 'weekdayShort')}
          </div>
          <div className="text-lg">{weatherInfo(daily.weather_code?.[i]).emoji}</div>
          <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
            {Math.round(daily.temperature_2m_max?.[i])}°
          </div>
          <div className="text-[11px] text-stone-400 dark:text-stone-500">
            {Math.round(daily.temperature_2m_min?.[i])}°
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CURRENT CONDITIONS BLOCK (shared: compact + full modal) ───
function CurrentBlock({ weather }) {
  const tw = useTranslations('Weather');
  const c = weather?.current;
  if (!c) {
    return <div className="flex h-16 items-center text-sm text-stone-400 dark:text-stone-500">{tw('unavailable')}</div>;
  }
  const info = weatherInfo(c.weather_code);
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            {Math.round(c.temperature_2m)}°
          </span>
          <span className="text-sm font-semibold text-stone-500 capitalize dark:text-stone-400">{tw(info.key)}</span>
        </div>
        {c.apparent_temperature != null && (
          <div className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">
            {tw('feelsLike', { n: Math.round(c.apparent_temperature) })}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-4xl">{info.emoji}</span>
        <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 dark:text-stone-500">
          {c.precipitation_probability != null && (
            <span className="flex items-center gap-0.5 text-orange-600 dark:text-orange-400">
              <Droplets className="size-3" />
              {c.precipitation_probability}%
            </span>
          )}
          {c.wind_speed_10m != null && (
            <span className="flex items-center gap-0.5">
              <Wind className="size-3" />
              {Math.round(c.wind_speed_10m)} km/h
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── GEOCODING SEARCH (debounced) + manual lat/lng fallback ───
function AddLocationForm({ onAdd, onDone }) {
  const t = useTranslations('Weather');
  const tc = useTranslations('Common');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [mName, setMName] = useState('');
  const [mLat, setMLat] = useState('');
  const [mLng, setMLng] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      const r = await geocodeLocation(q);
      if (active) {
        setResults(r);
        setSearching(false);
      }
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const addManual = () => {
    const lat = parseFloat(mLat.replace(',', '.'));
    const lng = parseFloat(mLng.replace(',', '.'));
    if (!mName.trim() || isNaN(lat) || isNaN(lng)) return;
    onAdd({ name: mName.trim(), lat, lng });
    onDone();
  };

  return (
    <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-3 dark:border-white/10 dark:bg-stone-950/60">
      {!manual ? (
        <>
          <div className="relative mb-2">
            <Input
              size="xs"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
            />
            {query.trim().length >= 2 && (
              <motion.div
                {...POPOVER_POP}
                className={cx(
                  POPOVER,
                  'absolute inset-x-0 top-full z-50 mt-1 origin-top overflow-hidden rounded-lg p-0',
                )}
              >
                {searching ? (
                  <div className="px-3 py-2.5 text-sm text-stone-400 dark:text-stone-500">{tc('loading')}</div>
                ) : results.length === 0 ? (
                  <div className="px-3 py-2.5 text-sm text-stone-400 dark:text-stone-500">{tc('noResults')}</div>
                ) : (
                  results.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        onAdd({ name: r.name, lat: r.lat, lng: r.lng });
                        onDone();
                      }}
                      className={cx(
                        'px-3 py-2.5 text-sm text-stone-900 dark:text-stone-100',
                        ROW_PRESS,
                        i < results.length - 1 && 'border-b border-stone-200 dark:border-white/10',
                      )}
                    >
                      {r.label}
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </div>
          <button
            onClick={() => setManual(true)}
            className={cx('text-xs font-semibold text-orange-600 dark:text-orange-400', PRESS_SM)}
          >
            {t('manualEntry')}
          </button>
        </>
      ) : (
        <>
          <Input
            size="xs"
            autoFocus
            value={mName}
            onChange={(e) => setMName(e.target.value)}
            placeholder={t('placeName')}
            className="mb-2"
          />
          <div className="mb-2 flex gap-2">
            <Input size="xs" value={mLat} onChange={(e) => setMLat(e.target.value)} placeholder={t('latPlaceholder')} />
            <Input size="xs" value={mLng} onChange={(e) => setMLng(e.target.value)} placeholder={t('lngPlaceholder')} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={addManual}
              className={cx(
                'flex-1 cursor-pointer rounded-lg border-none bg-stone-900 py-2 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900',
                PRESS_SM,
              )}
            >
              {tc('add')}
            </button>
            <button
              onClick={() => setManual(false)}
              className={cx(
                'flex-1 cursor-pointer rounded-lg border border-stone-300 bg-transparent py-2 text-sm font-semibold text-stone-600 dark:border-stone-700 dark:text-stone-300',
                PRESS_SM,
              )}
            >
              {tc('cancel')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── WEATHER MODAL: chips to switch locations, edit mode toggled by pencil ───
function WeatherModal({ open, onClose, locations, onSetMain, onRemove, onAdd, mainWeather }) {
  const t = useTranslations('Weather');
  const ta = useTranslations('A11y');
  const [selIdx, setSelIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [cache, setCache] = useState({}); // "lat,lng" -> weather payload

  useEffect(() => {
    if (!open) return;
    setSelIdx(0);
    setEditing(false);
    setAdding(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const loc = locations[selIdx];
    if (!loc) return;
    const key = `${loc.lat},${loc.lng}`;
    if (cache[key]) return;
    // The main (index 0) location is already loaded on the home card — reuse
    // it instead of firing a duplicate request.
    if (selIdx === 0 && mainWeather?.current) {
      setCache((c) => ({ ...c, [key]: mainWeather }));
      return;
    }
    let active = true;
    fetchWeatherOnce(loc.lat, loc.lng).then((data) => {
      if (active && data) setCache((c) => ({ ...c, [key]: data }));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selIdx, locations]);

  const selLoc = locations[selIdx];
  const selWeather = selLoc ? cache[`${selLoc.lat},${selLoc.lng}`] : null;

  return (
    <Modal open={open} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {t('title')}
        </h3>
        <button
          aria-label={ta('edit')}
          onClick={() => setEditing((v) => !v)}
          className={cx(
            'flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-stone-400 dark:text-stone-500',
            editing && 'text-orange-600 dark:text-orange-400',
            PRESS_SM,
          )}
        >
          <Pencil className="size-4" />
        </button>
      </div>

      {/* Location chips — only worth switching between once there's >1 */}
      {locations.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {locations.map((loc, i) => (
            <button
              key={`${loc.lat},${loc.lng}`}
              onClick={() => setSelIdx(i)}
              className={cx(
                'flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold whitespace-nowrap',
                PRESS_SM,
                i === selIdx
                  ? 'border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900'
                  : 'border-stone-300 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
              )}
            >
              {i === 0 && <House className="size-3" />}
              {loc.name}
            </button>
          ))}
        </div>
      )}

      {/* Selected location's current + 7-day */}
      <CurrentBlock weather={selWeather} />
      <SevenDayRow daily={selWeather?.daily} />

      {editing && (
        <>
          <SectionHeader className="mt-5 mb-1.5">{t('editLocations')}</SectionHeader>
          <div className="mb-3">
            {locations.map((loc, i) => (
              <div
                key={`${loc.lat},${loc.lng}`}
                className="flex items-center gap-2 border-b border-dotted border-stone-300 py-2.5 last:border-b-0 dark:border-stone-700"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {loc.name}
                    {i === 0 && (
                      <span className="rounded-full bg-orange-500/15 px-1.5 py-0.25 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                        {t('main')}
                      </span>
                    )}
                  </div>
                </div>
                {i !== 0 && (
                  <button
                    onClick={() => onSetMain(i)}
                    className={cx(
                      'shrink-0 rounded-full border border-stone-300 bg-transparent px-2.5 py-1 text-[11px] font-semibold text-stone-600 dark:border-stone-700 dark:text-stone-300',
                      PRESS_SM,
                    )}
                  >
                    {t('setAsMain')}
                  </button>
                )}
                {locations.length > 1 && i !== 0 && (
                  <button
                    aria-label={ta('remove')}
                    onClick={() => onRemove(i)}
                    className={cx(
                      'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-red-500/10 text-red-600 dark:text-red-400',
                      PRESS_SM,
                    )}
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {adding ? (
            <AddLocationForm onAdd={onAdd} onDone={() => setAdding(false)} />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className={cx(
                'flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 bg-transparent py-2.5 text-sm font-semibold text-stone-600 dark:border-stone-700 dark:text-stone-300',
                PRESS_SM,
              )}
            >
              <Plus className="size-4" />
              {t('addLocation')}
            </button>
          )}
        </>
      )}
    </Modal>
  );
}

// ─── HOME CARD (Open-Meteo) ───
// Always occupies the same height (skeleton while the API resolves) so the
// cards below it never shift when the data lands — CLS stays flat.
export default function WeatherWidget({ weather, settings, saveSettings }) {
  const tw = useTranslations('Weather');
  const ready = weather?.current;
  const [open, setOpen] = useState(false);
  // Local-first so add/reorder/remove show instantly (per project convention)
  // instead of waiting on the settings round-trip. `settings` itself loads
  // asynchronously (starts null/default before the home_settings fetch
  // resolves), so re-sync whenever it changes — except while our own write
  // is still in flight, since that response would otherwise briefly stomp
  // the optimistic update with the pre-save value.
  const [locations, setLocations] = useState(() => weatherLocationsOf(settings));
  const saving = useRef(false);

  useEffect(() => {
    if (saving.current) return;
    setLocations(weatherLocationsOf(settings));
  }, [settings]);

  const persist = (next) => {
    setLocations(next);
    saving.current = true;
    Promise.resolve(saveSettings({ weather_locations: next })).finally(() => {
      saving.current = false;
    });
  };
  const setMain = (idx) => persist([locations[idx], ...locations.filter((_, i) => i !== idx)]);
  const remove = (idx) => {
    if (locations.length <= 1) return; // always keep at least one location
    persist(locations.filter((_, i) => i !== idx));
  };
  const add = (loc) => {
    if (locations.some((l) => l.lat === loc.lat && l.lng === loc.lng)) return; // no dupes
    persist([...locations, loc]);
  };

  return (
    <>
      <Card
        onClick={() => setOpen(true)}
        className="mb-2.5 flex h-[84px] items-center justify-between rounded-2xl px-3.5"
      >
        {ready ? (
          <>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-semibold tracking-[1px] text-stone-400 uppercase dark:text-stone-500">
                {locations[0]?.name}
              </div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-serif text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                  {Math.round(weather.current.temperature_2m)}°
                </span>
                <span className="text-sm font-semibold text-stone-500 capitalize dark:text-stone-400">
                  {tw(weatherInfo(weather.current.weather_code).key)}
                </span>
              </div>
              <div className="mt-0.5 text-xs font-semibold text-stone-400 dark:text-stone-500">
                {weather.daily?.precipitation_probability_max?.[0] != null && (
                  <span className="text-orange-600 dark:text-orange-400">
                    {tw('precip', { p: weather.daily.precipitation_probability_max[0] })} ·{' '}
                  </span>
                )}
                H {Math.round(weather.daily?.temperature_2m_max?.[0])}° · L{' '}
                {Math.round(weather.daily?.temperature_2m_min?.[0])}°
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 pl-2">
              <span className="text-4xl">{weatherInfo(weather.current.weather_code).emoji}</span>
              <ChevronRight className="size-4 text-stone-300 dark:text-stone-600" />
            </div>
          </>
        ) : (
          <>
            <div>
              <div className="mb-1.5 h-6 w-24 rounded-md bg-stone-200 dark:bg-stone-800" />
              <div className="h-3 w-32 rounded bg-stone-200 dark:bg-stone-800" />
            </div>
            <div className="size-9 rounded-full bg-stone-200 dark:bg-stone-800" />
          </>
        )}
      </Card>

      <WeatherModal
        open={open}
        onClose={() => setOpen(false)}
        locations={locations}
        mainWeather={weather}
        onSetMain={setMain}
        onRemove={remove}
        onAdd={add}
      />
    </>
  );
}
