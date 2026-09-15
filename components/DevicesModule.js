'use client';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Check, ChevronDown, ChevronUp, Minus, Pencil, Plus, RefreshCw, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/utils';
import { useNapraveFavorites } from '@/lib/hooks';
import { SliderButton } from './SliderButton';
import {
  Screen,
  PageBody,
  ModuleHeader,
  Card,
  EmptyState,
  Modal,
  ModalActions,
  SectionHeader,
  IconButton,
  CHIP_ON,
  CHIP_OFF,
  COLLAPSE,
  PRESS,
  PRESS_SM,
  ROW_PRESS,
} from './ui';

// device_type → icon shown next to the device name. Falls back to a plug for
// any future device type this module doesn't know about yet.
const DEVICE_ICONS = {
  air_conditioner: '❄️',
  heating_zone: '🔥',
  domestic_hot_water: '🚿',
  shelly_switch: '💡',
  shelly_dimmer: '🔆',
  shelly_cover: '🪟',
  netatmo_indoor: '🌡️',
  netatmo_outdoor: '🌤️',
};

// Known rooms get a nicer icon than the generic fallback — purely cosmetic,
// any room name not listed here (or the "no room set" bucket) still renders
// fine with 🏠.
const ROOM_ICONS = {
  Spalnica: '🛏️',
  'Dnevna soba': '🛋️',
  Galerija: '🪜', // gallery/mezzanine — the two-level part of the house
  Terasa: '⛱️', // outdoor deck/balcony at the house
};

// Netatmo Weather Station pairs are grouped by physical location (backfilled
// onto home_devices.room, same mechanism as the Shelly room backfill — see
// supabase/migrations/20260915110000_netatmo_room_backfill.sql), not by
// device_type — B has 2 stations (indoor+outdoor module each) at 2 real
// locations. Any location name not listed here still renders with 🌡️.
const NETATMO_LOCATION_ICONS = {
  Orlova: '🏠',
  Golte: '🏔️',
};

const MODE_META = {
  cool: { emoji: '❄️', key: 'modeCool' },
  heat: { emoji: '🔥', key: 'modeHeat' },
  auto: { emoji: '🌀', key: 'modeAuto' },
  dry: { emoji: '💧', key: 'modeDry' },
  fan: { emoji: '🌬️', key: 'modeFan' },
};

const VANE_OPTIONS = ['left', 'both', 'right'];

const VAILLANT_MODES = ['manual', 'time_controlled', 'off'];
const VAILLANT_MODE_KEYS = {
  manual: 'vaillantModeManual',
  time_controlled: 'vaillantModeSchedule',
  off: 'vaillantModeOff',
};
const WIFI_KEYS = { good: 'wifiGood', fair: 'wifiFair', poor: 'wifiPoor' };

// Minute-granularity "synced N min/h ago" note — relativeDay() in lib/utils
// is day-granularity (built for board notes) so this stays local to the one
// place that needs finer resolution.
function useSyncedLabel(lastSyncedAt) {
  const t = useTranslations('Devices');
  if (!lastSyncedAt) return t('neverSynced');
  const minutes = Math.max(0, Math.round((Date.now() - new Date(lastSyncedAt).getTime()) / 60000));
  if (minutes < 1) return t('syncedJustNow');
  if (minutes < 60) return t('syncedMinutesAgo', { n: minutes });
  return t('syncedHoursAgo', { n: Math.round(minutes / 60) });
}

// ---------------------------------------------------------------------
// Shared accordion shell for every top-level Naprave section (a single
// device like the AC, or a room group of Shelly devices). Collapsed by
// default so the whole screen doesn't turn into one long scroll of always-
// expanded cards — open state is owned by the parent (not local) so a tap
// on a Bližnjice favorite can open the right one and scroll it into view.
// ---------------------------------------------------------------------
function AccordionCard({ anchorId, icon, title, subtitle, summary, warn, open, onToggle, children }) {
  return (
    <div id={anchorId}>
      <Card className="overflow-hidden p-0">
        <button
          type="button"
          onClick={onToggle}
          className={cx('flex w-full cursor-pointer items-center gap-3 border-none bg-transparent p-4 text-left', ROW_PRESS)}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 truncate text-sm font-bold text-stone-900 dark:text-stone-100">
              {icon} {title}
              {warn && <AlertTriangle className="size-3.5 shrink-0 text-amber-500 dark:text-amber-400" />}
            </div>
            {subtitle && <div className="mt-0.5 truncate text-xs text-stone-400 dark:text-stone-500">{subtitle}</div>}
          </div>
          {summary && (
            <div className="shrink-0 text-[12.5px] font-semibold text-stone-500 tabular-nums dark:text-stone-400">
              {summary}
            </div>
          )}
          {open ? (
            <ChevronUp className="size-4 shrink-0 text-stone-400 dark:text-stone-500" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-stone-400 dark:text-stone-500" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div {...COLLAPSE} className="overflow-hidden">
              <div className="border-t border-stone-200/70 px-4 pt-3.5 pb-4 dark:border-white/10">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

function DeviceCard({ device, open, onToggle, sendCommand, refreshDevice }) {
  const t = useTranslations('Devices');
  const [modeOpen, setModeOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const syncedLabel = useSyncedLabel(device.last_synced_at);

  const { state, capabilities } = device;
  const step = capabilities?.halfDegreeIncrements ? 0.5 : 1;
  const min = capabilities?.minTemperature ?? 16;
  const max = capabilities?.maxTemperature ?? 31;
  const modeMeta = MODE_META[state.mode];

  const adjustTemp = (delta) => {
    const next = Math.round(Math.min(max, Math.max(min, state.targetTemperature + delta)) * 10) / 10;
    if (next !== state.targetTemperature) {
      sendCommand(device.id, 'set_temperature', next, { targetTemperature: next });
    }
  };

  const handleRefresh = async (e) => {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await refreshDevice(device.id);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AccordionCard
      anchorId={`device-${device.id}`}
      icon={DEVICE_ICONS[device.device_type] || '🔌'}
      title={device.name}
      subtitle={[device.room, device.provider === 'melcloud_home' && 'Mitsubishi Electric'].filter(Boolean).join(' · ')}
      summary={`${state.currentTemperature}° → ${state.targetTemperature.toFixed(1)}°`}
      open={open}
      onToggle={onToggle}
    >
      <div className="mb-2.5 flex items-center justify-end">
        <button
          onClick={handleRefresh}
          className={cx(
            'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-2 text-xs font-semibold',
            PRESS_SM,
            state.online
              ? 'bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400'
              : 'bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
          )}
        >
          <span
            className={cx('size-1.5 shrink-0 rounded-full', state.online ? 'bg-green-600 dark:bg-green-400' : 'bg-stone-400')}
          />
          {state.online ? t('connected') : t('offline')}
          <RefreshCw className={cx('size-3 opacity-75', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="my-2.5 text-center">
        <div className="font-serif text-5xl font-medium text-stone-900 tabular-nums dark:text-stone-100">
          {state.currentTemperature}°
        </div>
        <div className="mt-3.5 flex items-center justify-center gap-5">
          <button
            onClick={() => adjustTemp(-step)}
            disabled={!state.power || state.targetTemperature <= min}
            className={cx(
              'flex size-13.5 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white shadow-md shadow-stone-900/25 disabled:cursor-default disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900',
              PRESS,
            )}
          >
            <Minus className="size-6" strokeWidth={2.5} />
          </button>
          <div className="min-w-14.5 text-center text-[13.5px] font-semibold text-stone-500 dark:text-stone-400">
            {t('target')}
            <div className="mt-0.5 text-[15px] font-bold text-stone-900 tabular-nums dark:text-stone-100">
              {state.targetTemperature.toFixed(1)}°
            </div>
          </div>
          <button
            onClick={() => adjustTemp(step)}
            disabled={!state.power || state.targetTemperature >= max}
            className={cx(
              'flex size-13.5 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white shadow-md shadow-stone-900/25 disabled:cursor-default disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900',
              PRESS,
            )}
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="mb-3.5 flex justify-center">
        <button
          onClick={() => setModeOpen(true)}
          className={cx(
            'inline-flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-stone-100 px-3.5 py-1.75 text-[13px] font-semibold text-stone-900 dark:bg-stone-800 dark:text-stone-100',
            PRESS_SM,
          )}
        >
          <span>{modeMeta?.emoji}</span>
          {modeMeta ? t(modeMeta.key) : state.mode}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </div>

      <SliderButton
        kind="switch"
        value={!!state.power}
        onChange={(next) => sendCommand(device.id, 'power', next, { power: next })}
        icon="⏻"
        label={t('power')}
        valueText={state.power ? t('stateOn') : t('stateOff')}
      />

      <button
        onClick={() => setAdvOpen((v) => !v)}
        className={cx(
          'mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 border-t border-none border-stone-200/70 bg-transparent pt-2.5 text-xs font-bold text-stone-400 dark:border-white/10 dark:text-stone-500',
          ROW_PRESS,
        )}
      >
        {t('advanced')}
        {advOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      <AnimatePresence initial={false}>
        {advOpen && (
          <motion.div {...COLLAPSE} className="overflow-hidden">
            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-1.5 text-[10px] font-bold tracking-[0.5px] text-stone-400 uppercase dark:text-stone-500">
                  {t('fanSpeed')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(capabilities?.fanSpeeds || []).map((fs) => (
                    <button
                      key={fs}
                      onClick={() => sendCommand(device.id, 'fan_speed', fs, { fanSpeed: fs })}
                      className={cx(
                        'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold',
                        fs === state.fanSpeed ? CHIP_ON : CHIP_OFF,
                        PRESS_SM,
                      )}
                    >
                      {fs === 'auto' ? t('fanAuto') : fs}
                    </button>
                  ))}
                </div>
              </div>

              {capabilities?.hasHorizontalVane && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold tracking-[0.5px] text-stone-400 uppercase dark:text-stone-500">
                    {t('vane')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {VANE_OPTIONS.map((v) => (
                      <button
                        key={v}
                        onClick={() => sendCommand(device.id, 'horizontal_vane', v, { vaneHorizontal: v })}
                        className={cx(
                          'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold',
                          v === state.vaneHorizontal ? CHIP_ON : CHIP_OFF,
                          PRESS_SM,
                        )}
                      >
                        {t(`vane${v.charAt(0).toUpperCase()}${v.slice(1)}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between py-1 text-[11.5px] text-stone-500 dark:text-stone-400">
                  <span>{t('wifiSignal')}</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {t(WIFI_KEYS[state.wifiSignal] || 'wifiUnknown')}
                  </span>
                </div>
                {typeof state.outdoorTemperature === 'number' && (
                  <div className="flex items-center justify-between py-1 text-[11.5px] text-stone-500 dark:text-stone-400">
                    <span>{t('outdoorTemp')}</span>
                    <span className="font-semibold text-stone-900 tabular-nums dark:text-stone-100">
                      {state.outdoorTemperature}°
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-1 text-[11.5px] text-stone-500 dark:text-stone-400">
                  <span>{t('error')}</span>
                  <span
                    className={cx('font-semibold', state.error ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400')}
                  >
                    {state.error || t('noError')}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-3 text-center text-[10.5px] text-stone-400 dark:text-stone-500">{syncedLabel}</div>

      <Modal open={modeOpen} onClose={() => setModeOpen(false)}>
        <div className="mb-3 text-lg font-bold text-stone-900 dark:text-stone-100">{t('chooseMode')}</div>
        <div className="space-y-1">
          {(capabilities?.modes || []).map((m) => {
            const meta = MODE_META[m];
            const active = m === state.mode;
            return (
              <button
                key={m}
                onClick={() => {
                  sendCommand(device.id, 'mode', m, { mode: m });
                  setModeOpen(false);
                }}
                className={cx(
                  'flex w-full cursor-pointer items-center gap-3 rounded-xl border-none px-3 py-3 text-left text-sm font-semibold',
                  active ? 'bg-stone-100 dark:bg-stone-800' : 'bg-transparent',
                  ROW_PRESS,
                )}
              >
                <span className="text-lg">{meta?.emoji}</span>
                <span className="flex-1 text-stone-900 dark:text-stone-100">{meta ? t(meta.key) : m}</span>
              </button>
            );
          })}
        </div>
      </Modal>
    </AccordionCard>
  );
}

function VaillantZoneCard({ device, open, onToggle, sendCommand, refreshDevice }) {
  const t = useTranslations('Devices');
  const [refreshing, setRefreshing] = useState(false);
  const syncedLabel = useSyncedLabel(device.last_synced_at);

  const { state, capabilities } = device;
  const min = capabilities?.minTemperature ?? 5;
  const max = capabilities?.maxTemperature ?? 30;
  const step = 0.5;
  const displayTarget = state.quickVetoActive ? state.targetTemperature : (state.manualSetpoint ?? state.targetTemperature);

  const handleRefresh = async (e) => {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await refreshDevice(device.id);
    } finally {
      setRefreshing(false);
    }
  };

  const adjustTemp = (delta) => {
    const base = displayTarget ?? 20;
    const next = Math.round(Math.min(max, Math.max(min, base + delta)) * 10) / 10;
    if (next === displayTarget) return;
    if (state.mode === 'manual' && !state.quickVetoActive) {
      sendCommand(device.id, 'zone_setpoint', next, { targetTemperature: next, manualSetpoint: next });
    } else {
      sendCommand(device.id, 'quick_veto', next, { targetTemperature: next, quickVetoActive: true });
    }
  };

  return (
    <AccordionCard
      anchorId={`device-${device.id}`}
      icon={DEVICE_ICONS[device.device_type] || '🔌'}
      title={device.name}
      subtitle="Vaillant"
      summary={displayTarget != null ? `${displayTarget.toFixed(1)}°` : '—'}
      open={open}
      onToggle={onToggle}
    >
      <div className="mb-2.5 flex items-center justify-end">
        <button
          onClick={handleRefresh}
          className={cx(
            'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-green-600/10 py-1.5 pr-2.5 pl-2 text-xs font-semibold text-green-700 dark:bg-green-400/10 dark:text-green-400',
            PRESS_SM,
          )}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-green-600 dark:bg-green-400" />
          {t('connected')}
          <RefreshCw className={cx('size-3 opacity-75', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="my-2.5 text-center">
        <div className="font-serif text-5xl font-medium text-stone-900 tabular-nums dark:text-stone-100">
          {state.currentTemperature != null ? `${state.currentTemperature}°` : '—'}
        </div>
        <div className="mt-3.5 flex items-center justify-center gap-5">
          <button
            onClick={() => adjustTemp(-step)}
            disabled={state.mode === 'off'}
            className={cx(
              'flex size-13.5 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white shadow-md shadow-stone-900/25 disabled:cursor-default disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900',
              PRESS,
            )}
          >
            <Minus className="size-6" strokeWidth={2.5} />
          </button>
          <div className="min-w-14.5 text-center text-[13.5px] font-semibold text-stone-500 dark:text-stone-400">
            {t('target')}
            <div className="mt-0.5 text-[15px] font-bold text-stone-900 tabular-nums dark:text-stone-100">
              {displayTarget != null ? `${displayTarget.toFixed(1)}°` : '—'}
            </div>
          </div>
          <button
            onClick={() => adjustTemp(step)}
            disabled={state.mode === 'off'}
            className={cx(
              'flex size-13.5 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white shadow-md shadow-stone-900/25 disabled:cursor-default disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900',
              PRESS,
            )}
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="mb-1 flex flex-wrap justify-center gap-1.5">
        {VAILLANT_MODES.map((m) => (
          <button
            key={m}
            onClick={() => sendCommand(device.id, 'zone_mode', m, { mode: m })}
            className={cx('cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold', m === state.mode ? CHIP_ON : CHIP_OFF, PRESS_SM)}
          >
            {t(VAILLANT_MODE_KEYS[m])}
          </button>
        ))}
      </div>

      {state.quickVetoActive && (
        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-amber-600/20 bg-amber-600/8 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t('vaillantQuickVetoActive')}</span>
          <button
            onClick={() => sendCommand(device.id, 'cancel_quick_veto', null, { quickVetoActive: false })}
            className={cx('cursor-pointer rounded-full border-none bg-transparent text-xs font-bold text-amber-700 underline dark:text-amber-400', PRESS_SM)}
          >
            {t('vaillantCancelQuickVeto')}
          </button>
        </div>
      )}

      {state.holidayActive && (
        <div className="mt-2.5 rounded-xl border border-sky-600/20 bg-sky-600/8 px-3 py-2 text-center text-xs font-semibold text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400">
          {t('vaillantHolidayActive')}
        </div>
      )}

      <div className="mt-3 text-center text-[10.5px] text-stone-400 dark:text-stone-500">{syncedLabel}</div>
    </AccordionCard>
  );
}

function VaillantDhwCard({ device, open, onToggle, sendCommand, refreshDevice }) {
  const t = useTranslations('Devices');
  const [refreshing, setRefreshing] = useState(false);
  const syncedLabel = useSyncedLabel(device.last_synced_at);

  const { state, capabilities } = device;
  const min = capabilities?.minTemperature ?? 35;
  const max = capabilities?.maxTemperature ?? 65;

  const handleRefresh = async (e) => {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await refreshDevice(device.id);
    } finally {
      setRefreshing(false);
    }
  };

  const adjustTemp = (delta) => {
    const base = state.targetTemperature ?? 50;
    const next = Math.round(Math.min(max, Math.max(min, base + delta)));
    if (next !== state.targetTemperature) {
      sendCommand(device.id, 'dhw_setpoint', next, { targetTemperature: next });
    }
  };

  return (
    <AccordionCard
      anchorId={`device-${device.id}`}
      icon={DEVICE_ICONS[device.device_type] || '🔌'}
      title={device.name}
      subtitle="Vaillant"
      summary={state.targetTemperature != null ? `${state.targetTemperature}°` : '—'}
      open={open}
      onToggle={onToggle}
    >
      <div className="mb-2.5 flex items-center justify-end">
        <button
          onClick={handleRefresh}
          className={cx(
            'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-green-600/10 py-1.5 pr-2.5 pl-2 text-xs font-semibold text-green-700 dark:bg-green-400/10 dark:text-green-400',
            PRESS_SM,
          )}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-green-600 dark:bg-green-400" />
          {t('connected')}
          <RefreshCw className={cx('size-3 opacity-75', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="my-2.5 text-center">
        <div className="font-serif text-5xl font-medium text-stone-900 tabular-nums dark:text-stone-100">
          {state.currentTemperature != null ? `${state.currentTemperature}°` : '—'}
        </div>
        <div className="mt-3.5 flex items-center justify-center gap-5">
          <button
            onClick={() => adjustTemp(-1)}
            disabled={state.mode === 'off'}
            className={cx(
              'flex size-13.5 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white shadow-md shadow-stone-900/25 disabled:cursor-default disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900',
              PRESS,
            )}
          >
            <Minus className="size-6" strokeWidth={2.5} />
          </button>
          <div className="min-w-14.5 text-center text-[13.5px] font-semibold text-stone-500 dark:text-stone-400">
            {t('target')}
            <div className="mt-0.5 text-[15px] font-bold text-stone-900 tabular-nums dark:text-stone-100">
              {state.targetTemperature != null ? `${state.targetTemperature}°` : '—'}
            </div>
          </div>
          <button
            onClick={() => adjustTemp(1)}
            disabled={state.mode === 'off'}
            className={cx(
              'flex size-13.5 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white shadow-md shadow-stone-900/25 disabled:cursor-default disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900',
              PRESS,
            )}
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="mb-1 flex flex-wrap justify-center gap-1.5">
        {VAILLANT_MODES.map((m) => (
          <button
            key={m}
            onClick={() => sendCommand(device.id, 'dhw_mode', m, { mode: m })}
            className={cx('cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold', m === state.mode ? CHIP_ON : CHIP_OFF, PRESS_SM)}
          >
            {t(VAILLANT_MODE_KEYS[m])}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-stone-200/70 pt-3 dark:border-white/10">
        <div className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">{t('vaillantDhwBoost')}</div>
        <button
          role="switch"
          aria-checked={state.boostActive}
          onClick={() =>
            state.boostActive
              ? sendCommand(device.id, 'dhw_cancel_boost', null, { boostActive: false })
              : sendCommand(device.id, 'dhw_boost', null, { boostActive: true })
          }
          className={cx(
            'relative h-8 w-14 cursor-pointer rounded-full border-none transition-colors',
            state.boostActive ? 'bg-stone-900 dark:bg-stone-100' : 'bg-stone-300 dark:bg-stone-700',
            PRESS_SM,
          )}
        >
          <span
            className={cx(
              'absolute top-1 size-6 rounded-full bg-white shadow-sm transition-[left] dark:bg-stone-900',
              state.boostActive ? 'left-[calc(100%-28px)]' : 'left-1',
            )}
          />
        </button>
      </div>

      <div className="mt-3 text-center text-[10.5px] text-stone-400 dark:text-stone-500">{syncedLabel}</div>
    </AccordionCard>
  );
}

// Netatmo Weather Station card — read-only sensors, no control of any
// kind (unlike every other card here), so this is just AccordionCard +
// a Refresh pill + a small stat grid, no adjust buttons/toggles/sliders.
// Two device_types share this one component (netatmo_indoor has more
// fields than netatmo_outdoor) rather than splitting into two components,
// since the only difference is which stat rows apply.
function NetatmoStatRow({ label, value, warn }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between border-b border-stone-100 py-2 text-sm last:border-0 dark:border-white/5">
      <span className="text-stone-500 dark:text-stone-400">{label}</span>
      <span className={cx('font-semibold', warn ? 'text-amber-600 dark:text-amber-400' : 'text-stone-900 dark:text-stone-100')}>
        {warn ? `${value} ⚠️` : value}
      </span>
    </div>
  );
}

// One location = one card, showing its indoor module (temperature front and
// center, plus CO2/noise/pressure) and its outdoor module (temperature plus
// battery) stacked inside a single accordion — B asked for the 4 raw
// Netatmo devices to read as 2 real places, not 4 flat sensor cards, and to
// sit under Prostori rather than above Klima (see the "Vremenske postaje"
// mock at claude.ai/artifact/EeYUgnwzQ5Y7WZMhxkQ9rj). One Refresh pill for
// the pair — refreshDevice is called for both device ids at once — since
// there's no real reason to refresh only one module of the same station.
function NetatmoLocationCard({ location, group, open, onToggle, refreshDevice }) {
  const t = useTranslations('Devices');
  const [refreshing, setRefreshing] = useState(false);
  const indoor = group.find((d) => d.device_type === 'netatmo_indoor');
  const outdoor = group.find((d) => d.device_type === 'netatmo_outdoor');
  const latestSync = [indoor, outdoor]
    .filter(Boolean)
    .map((d) => d.last_synced_at)
    .sort()
    .pop();
  const syncedLabel = useSyncedLabel(latestSync);
  const online = [indoor, outdoor].filter(Boolean).every((d) => d.state.online);
  const hasError = [indoor, outdoor].filter(Boolean).some((d) => d.last_error || d.state?.online === false);

  const handleRefresh = async (e) => {
    e.stopPropagation();
    setRefreshing(true);
    try {
      await Promise.all([indoor, outdoor].filter(Boolean).map((d) => refreshDevice(d.id)));
    } finally {
      setRefreshing(false);
    }
  };

  const indoorTemp = indoor?.state?.temperature;
  const outdoorTemp = outdoor?.state?.temperature;
  const summary =
    indoorTemp != null && outdoorTemp != null
      ? t('netatmoLocationSummary', { indoor: indoorTemp, outdoor: outdoorTemp })
      : indoorTemp != null
        ? `${indoorTemp}°`
        : outdoorTemp != null
          ? `${outdoorTemp}°`
          : null;

  const lowBattery = outdoor?.state?.batteryPercent != null && outdoor.state.batteryPercent <= 25;

  return (
    <AccordionCard
      anchorId={`netatmo-${location}`}
      icon={NETATMO_LOCATION_ICONS[location] || '🌡️'}
      title={location}
      summary={summary}
      warn={hasError}
      open={open}
      onToggle={onToggle}
    >
      <div className="mb-2.5 flex items-center justify-end">
        <button
          onClick={handleRefresh}
          className={cx(
            'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-2 text-xs font-semibold',
            PRESS_SM,
            online
              ? 'bg-green-600/10 text-green-700 dark:bg-green-400/10 dark:text-green-400'
              : 'bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
          )}
        >
          <span className={cx('size-1.5 shrink-0 rounded-full', online ? 'bg-green-600 dark:bg-green-400' : 'bg-stone-400')} />
          {online ? t('connected') : t('offline')}
          <RefreshCw className={cx('size-3 opacity-75', refreshing && 'animate-spin')} />
        </button>
      </div>

      {hasError && (
        <div className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[12.5px] font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-400">
          {[indoor, outdoor].filter(Boolean).find((d) => d.last_error)?.last_error || t('netatmoModuleUnreachable')}
        </div>
      )}

      {indoor && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-stone-400 uppercase dark:text-stone-500">
            <span>{DEVICE_ICONS.netatmo_indoor}</span> {t('netatmoIndoorLabel')}
          </div>
          <div className="my-1 text-center">
            <div className="font-serif text-4xl font-medium text-stone-900 tabular-nums dark:text-stone-100">
              {indoor.state.temperature != null ? `${indoor.state.temperature}°` : '—'}
            </div>
          </div>
          <div className="mt-1.5">
            <NetatmoStatRow label={t('netatmoHumidity')} value={indoor.state.humidity != null ? `${indoor.state.humidity}%` : null} />
            <NetatmoStatRow label={t('netatmoCo2')} value={indoor.state.co2 != null ? `${indoor.state.co2} ppm` : null} />
            <NetatmoStatRow label={t('netatmoNoise')} value={indoor.state.noise != null ? `${indoor.state.noise} dB` : null} />
            <NetatmoStatRow label={t('netatmoPressure')} value={indoor.state.pressure != null ? `${indoor.state.pressure} mbar` : null} />
          </div>
        </div>
      )}

      {indoor && outdoor && <div className="my-3.5 h-px bg-stone-100 dark:bg-white/5" />}

      {outdoor && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-stone-400 uppercase dark:text-stone-500">
            <span>{DEVICE_ICONS.netatmo_outdoor}</span> {t('netatmoOutdoorLabel')}
          </div>
          <div className="my-1 text-center">
            <div className="font-serif text-4xl font-medium text-stone-900 tabular-nums dark:text-stone-100">
              {outdoor.state.temperature != null ? `${outdoor.state.temperature}°` : '—'}
            </div>
          </div>
          <div className="mt-1.5">
            <NetatmoStatRow label={t('netatmoHumidity')} value={outdoor.state.humidity != null ? `${outdoor.state.humidity}%` : null} />
            <NetatmoStatRow
              label={t('netatmoBattery')}
              value={outdoor.state.batteryPercent != null ? `${outdoor.state.batteryPercent}%` : null}
              warn={lowBattery}
            />
          </div>
        </div>
      )}

      <div className="mt-3 text-center text-[10.5px] text-stone-400 dark:text-stone-500">{syncedLabel}</div>
    </AccordionCard>
  );
}

// One row inside a room's accordion — no card/header of its own (the room
// AccordionCard supplies that), just the SliderButton (+ Odpri/Stop/Zapri
// for a cover) matching the given device's control shape.
const COVER_ACTIONS = ['open', 'stop', 'close'];
const COVER_ACTION_KEYS = { open: 'shellyCoverOpen', stop: 'shellyCoverStop', close: 'shellyCoverClose' };

function ShellyDeviceRow({ device, sendCommand }) {
  const t = useTranslations('Devices');
  const { state } = device;

  if (device.device_type === 'shelly_dimmer') {
    return (
      <SliderButton
        kind="dimmer"
        value={state.on ? (state.brightness ?? 100) : 0}
        lastValue={state.brightness ?? 100}
        onChange={(pct) => {
          if (pct <= 0) sendCommand(device.id, 'power', false, { on: false });
          else sendCommand(device.id, 'brightness', pct, { brightness: pct, on: true });
        }}
        icon={DEVICE_ICONS.shelly_dimmer}
        label={device.name}
        valueText={state.on ? `${state.brightness ?? 100}%` : t('stateOff')}
      />
    );
  }

  if (device.device_type === 'shelly_cover') {
    return (
      <div>
        <SliderButton
          kind="cover"
          value={state.position ?? 0}
          onChange={(pct) => sendCommand(device.id, 'cover_position', pct, { position: pct })}
          icon={DEVICE_ICONS.shelly_cover}
          label={device.name}
          valueText={state.moving ? t('shellyCoverMoving') : coverPositionLabel(state.position, t)}
        />
        <div className="mt-2 grid grid-cols-3 gap-2">
          {COVER_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => sendCommand(device.id, 'cover_action', action, { moving: action !== 'stop' })}
              className={cx('cursor-pointer rounded-full border px-3 py-2 text-xs font-semibold', CHIP_OFF, PRESS_SM)}
            >
              {t(COVER_ACTION_KEYS[action])}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // shelly_switch (and any future simple on/off type)
  return (
    <SliderButton
      kind="switch"
      value={!!state.on}
      onChange={(next) => sendCommand(device.id, 'power', next, { on: next })}
      icon={DEVICE_ICONS[device.device_type] || '💡'}
      label={device.name}
      valueText={state.on ? t('stateOn') : t('stateOff')}
    />
  );
}

function ComingSoonCard({ icon, title, subtitle }) {
  const t = useTranslations('Devices');
  return (
    <div className="mb-2 flex items-center gap-2.5 rounded-2xl border border-dashed border-stone-300 px-3.5 py-3 dark:border-stone-700">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-stone-100 text-sm dark:bg-stone-800">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-stone-500 dark:text-stone-400">{title}</div>
        {subtitle && <div className="truncate text-[10.5px] text-stone-400 dark:text-stone-500">{subtitle}</div>}
      </div>
      <div className="shrink-0 text-[9.5px] font-bold tracking-[0.5px] text-stone-400 uppercase dark:text-stone-500">{t('soonTag')}</div>
    </div>
  );
}

// Which shortcut behavior a device gets in Bližnjice: 'klima' and 'other'
// (Vaillant zones/dhw) just open/scroll to their own accordion; the Shelly
// kinds act directly (switch/dimmer toggle in place, cover opens the shared
// mini control panel below the grid — there's no sensible single tap action
// for "open to what position?").
// Shared label for a cover's position: fully open/closed reads as a word
// (matches how B thinks about žaluzije — "open"/"closed", not a number),
// anything in between still shows the percentage. Used on the device row,
// the Bližnjice tile, and a room summary that's covers-only.
function coverPositionLabel(position, t) {
  const pos = position ?? 0;
  if (pos >= 100) return t('coverOpen');
  if (pos <= 0) return t('coverClosed');
  return `${pos}%`;
}

function favoriteKind(device) {
  if (device.device_type === 'shelly_switch') return 'switch';
  if (device.device_type === 'shelly_dimmer') return 'dimmer';
  if (device.device_type === 'shelly_cover') return 'cover';
  return 'expand';
}

function favoriteStateLabel(device, t) {
  const kind = favoriteKind(device);
  const { state } = device;
  if (kind === 'switch') return state.on ? t('stateOn') : t('stateOff');
  if (kind === 'dimmer') return state.on ? `${state.brightness ?? 100}%` : t('stateOff');
  if (kind === 'cover') return coverPositionLabel(state.position, t);
  if (device.device_type === 'air_conditioner') return state.power ? `${state.currentTemperature}°` : t('stateOff');
  return state.targetTemperature != null ? `${state.targetTemperature}°` : '—';
}

function favoriteIsOn(device) {
  const kind = favoriteKind(device);
  if (kind === 'switch' || kind === 'dimmer') return !!device.state.on;
  if (device.device_type === 'air_conditioner') return !!device.state.power;
  if (device.device_type === 'heating_zone') return device.state.mode !== 'off';
  return false;
}

// Bottom-sheet picker for which (up to 3) devices show as Bližnjice —
// same "reorder/manage in a modal" shape as ShoppingModule's
// ManageSectionsModal, but selection rather than drag-reorder.
function FavoritesEditModal({ open, onClose, devices, favoriteIds, onSave }) {
  const t = useTranslations('Devices');
  const tc = useTranslations('Common');
  const [selected, setSelected] = useState(favoriteIds);

  useEffect(() => {
    if (open) setSelected(favoriteIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= 3) return cur;
      return [...cur, id];
    });
  };

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="mb-1 text-center font-serif text-xl font-semibold tracking-tight">{t('favoritesPickTitle')}</h3>
      <p className="mb-4 text-center text-sm text-stone-500 dark:text-stone-400">{t('favoritesPickHint')}</p>
      <div className="mb-3 flex max-h-[45dvh] flex-col gap-1 overflow-y-auto">
        {devices.map((d) => {
          const checked = selected.includes(d.id);
          const disabled = !checked && selected.length >= 3;
          return (
            <button
              key={d.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(d.id)}
              className={cx(
                'flex w-full cursor-pointer items-center gap-3 rounded-xl border-none px-3 py-3 text-left text-sm font-semibold disabled:cursor-default disabled:opacity-40',
                checked ? 'bg-stone-100 dark:bg-stone-800' : 'bg-transparent',
                ROW_PRESS,
              )}
            >
              <span className="text-lg">{DEVICE_ICONS[d.device_type] || '🔌'}</span>
              <span className="min-w-0 flex-1 truncate text-stone-900 dark:text-stone-100">{d.name}</span>
              <span
                className={cx(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                  checked ? 'border-stone-900 bg-stone-900 dark:border-stone-100 dark:bg-stone-100' : 'border-stone-300 dark:border-stone-600',
                )}
              >
                {checked && <Check className="size-3.5 text-white dark:text-stone-900" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mb-3 text-center text-xs font-semibold text-stone-400 dark:text-stone-500">
        {t('favoritesCount', { n: selected.length })}
      </div>
      <ModalActions
        onSave={() => {
          onSave(selected);
          onClose();
        }}
        onCancel={onClose}
        saveLabel={tc('save')}
        cancelLabel={tc('cancel')}
      />
    </Modal>
  );
}

export default function DevicesModule({
  devices,
  loading,
  sendCommand,
  refreshDevice,
  connections,
  connectionsLoading,
  householdId,
  onGoHome,
  onOpenSettings,
}) {
  const tMod = useTranslations('Modules');
  const t = useTranslations('Devices');
  const ta = useTranslations('A11y');

  const { favoriteIds: savedFavoriteIds, setFavorites } = useNapraveFavorites(householdId);
  const [editOpen, setEditOpen] = useState(false);
  const [favCoverTarget, setFavCoverTarget] = useState(null);
  const [openTop, setOpenTop] = useState({}); // deviceId -> bool (klima/vaillant accordions)
  const [openRooms, setOpenRooms] = useState({}); // room key -> bool
  const [openNetatmo, setOpenNetatmo] = useState({}); // location name -> bool

  const showReauthBanner = !connectionsLoading && (connections || []).some((c) => c?.status === 'error');
  const notConnected = !connectionsLoading && (connections || []).every((c) => !c);

  // No customization saved yet → default to the first 3 devices so the
  // shortcuts bar isn't empty before anyone opens "Uredi".
  const effectiveFavoriteIds = savedFavoriteIds.length ? savedFavoriteIds : devices.slice(0, 3).map((d) => d.id);
  const favoriteDevices = effectiveFavoriteIds.map((id) => devices.find((d) => d.id === id)).filter(Boolean);

  const openDeviceAccordion = (deviceId) => {
    setOpenTop((prev) => {
      const opening = !prev[deviceId];
      if (opening) {
        requestAnimationFrame(() => {
          document.getElementById(`device-${deviceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
      return { ...prev, [deviceId]: opening };
    });
  };

  const handleFavoriteTap = (device) => {
    const kind = favoriteKind(device);
    if (kind === 'switch') {
      sendCommand(device.id, 'power', !device.state.on, { on: !device.state.on });
    } else if (kind === 'dimmer') {
      const turningOn = !device.state.on;
      sendCommand(device.id, 'power', turningOn, { on: turningOn });
    } else if (kind === 'cover') {
      setFavCoverTarget((cur) => (cur === device.id ? null : device.id));
    } else {
      openDeviceAccordion(device.id);
    }
  };

  const favCoverDevice = favCoverTarget ? devices.find((d) => d.id === favCoverTarget) : null;

  const nonShellyDevices = devices.filter((d) => d.provider !== 'shelly' && d.provider !== 'netatmo');
  const shellyDevices = devices.filter((d) => d.provider === 'shelly');
  const netatmoDevices = devices.filter((d) => d.provider === 'netatmo');

  const roomGroups = useMemo(() => {
    const map = new Map();
    for (const d of shellyDevices) {
      const key = d.room || '__other__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
    return Array.from(map.entries());
  }, [shellyDevices]);

  // Grouped by home_devices.room (backfilled per-location, see
  // supabase/migrations/20260915110000_netatmo_room_backfill.sql) rather
  // than by device_type — 2 stations (indoor + outdoor module each) at 2
  // real places, shown as 2 cards, not 4.
  const netatmoGroups = useMemo(() => {
    const map = new Map();
    for (const d of netatmoDevices) {
      const key = d.room || '__other__';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
    return Array.from(map.entries());
  }, [netatmoDevices]);

  // Covers/žaluzije don't have a meaningful "on" state (100% closed isn't
  // "on") and don't consume standby energy the way lights do, so they're
  // excluded from the on-count entirely — only switches/dimmers count
  // toward "X/Y prižgani". A room made up only of covers falls back to
  // showing that cover's position instead.
  const roomSummary = (group) => {
    const lights = group.filter((d) => d.device_type !== 'shelly_cover');
    if (lights.length === 0) {
      return coverPositionLabel(group[0].state.position, t);
    }
    const onCount = lights.filter((d) => !!d.state.on).length;
    return t('roomOnCount', { on: onCount, total: lights.length });
  };

  return (
    <Screen>
      <PageBody key="devices-home">
        <ModuleHeader title={tMod('devices')} emoji="🔌" onHome={onGoHome}>
          <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
            <Settings className="size-4.5" />
          </IconButton>
        </ModuleHeader>

        {showReauthBanner && (
          <button
            onClick={onOpenSettings}
            className={cx(
              'mb-3 flex w-full cursor-pointer items-center gap-2.5 rounded-2xl border-none bg-amber-500/10 px-4 py-3 text-left text-amber-700 dark:bg-amber-400/10 dark:text-amber-400',
              PRESS,
            )}
          >
            <span className="text-lg">⚠️</span>
            <span className="text-[13px] font-semibold">{t('reconnectBanner')}</span>
          </button>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-64 rounded-2xl border border-stone-200/70 bg-white dark:border-white/10 dark:bg-stone-900" />
            ))}
          </div>
        ) : devices.length === 0 && notConnected ? (
          <Card onClick={onOpenSettings} className="py-12 text-center">
            <div className="mb-3 text-5xl">🔌</div>
            <div className="mb-1 text-sm text-stone-400 dark:text-stone-500">{t('empty')}</div>
            <div className="text-xs font-bold text-stone-900 dark:text-stone-100">{t('connectCta')}</div>
          </Card>
        ) : devices.length === 0 ? (
          <EmptyState icon="🔌">{t('empty')}</EmptyState>
        ) : (
          <>
            {favoriteDevices.length > 0 && (
              <div className="mb-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <SectionHeader className="mb-0">{t('favoritesTitle')}</SectionHeader>
                  <button
                    onClick={() => setEditOpen(true)}
                    className={cx('flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-bold text-stone-400 dark:text-stone-500', ROW_PRESS)}
                  >
                    <Pencil className="size-3.5" /> {t('editFavorites')}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {favoriteDevices.map((d) => {
                    const on = favoriteIsOn(d);
                    return (
                      <button
                        key={d.id}
                        onClick={() => handleFavoriteTap(d)}
                        className={cx(
                          'flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-center',
                          PRESS_SM,
                          on
                            ? 'border-orange-500/40 bg-orange-500/10'
                            : 'border-stone-200/70 bg-white dark:border-white/10 dark:bg-stone-900',
                        )}
                      >
                        <span className="text-xl">{DEVICE_ICONS[d.device_type] || '🔌'}</span>
                        <span className="w-full truncate text-[11.5px] font-semibold text-stone-900 dark:text-stone-100">{d.name}</span>
                        <span className={cx('rounded-full px-2 py-0.5 text-[10px] font-bold', on ? CHIP_ON : CHIP_OFF)}>
                          {favoriteStateLabel(d, t)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence initial={false}>
                  {favCoverDevice && (
                    <motion.div {...COLLAPSE} className="overflow-hidden">
                      <div className="mt-2 rounded-2xl border border-stone-200/70 bg-white p-3 dark:border-white/10 dark:bg-stone-900">
                        <ShellyDeviceRow device={favCoverDevice} sendCommand={sendCommand} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="space-y-3">
              {nonShellyDevices.map((device) => {
                const open = !!openTop[device.id];
                const onToggle = () => openDeviceAccordion(device.id);
                if (device.provider === 'vaillant' && device.device_type === 'heating_zone') {
                  return (
                    <VaillantZoneCard key={device.id} device={device} open={open} onToggle={onToggle} sendCommand={sendCommand} refreshDevice={refreshDevice} />
                  );
                }
                if (device.provider === 'vaillant' && device.device_type === 'domestic_hot_water') {
                  return (
                    <VaillantDhwCard key={device.id} device={device} open={open} onToggle={onToggle} sendCommand={sendCommand} refreshDevice={refreshDevice} />
                  );
                }
                return (
                  <DeviceCard key={device.id} device={device} open={open} onToggle={onToggle} sendCommand={sendCommand} refreshDevice={refreshDevice} />
                );
              })}
            </div>

            {roomGroups.length > 0 && (
              <>
                <div className="mt-6 mb-2.5">
                  <SectionHeader className="mb-0">{t('roomsLabel')}</SectionHeader>
                </div>
                <div className="space-y-3">
                  {roomGroups.map(([key, group]) => {
                    const roomKey = `room-${key}`;
                    const open = !!openRooms[roomKey];
                    return (
                      <AccordionCard
                        key={roomKey}
                        anchorId={roomKey}
                        icon={key === '__other__' ? '🏠' : ROOM_ICONS[key] || '🏠'}
                        title={key === '__other__' ? t('otherDevices') : key}
                        summary={roomSummary(group)}
                        open={open}
                        onToggle={() => setOpenRooms((prev) => ({ ...prev, [roomKey]: !prev[roomKey] }))}
                      >
                        <div className="flex flex-col gap-2">
                          {group.map((device) => (
                            <ShellyDeviceRow key={device.id} device={device} sendCommand={sendCommand} />
                          ))}
                        </div>
                      </AccordionCard>
                    );
                  })}
                </div>
              </>
            )}

            {netatmoGroups.length > 0 && (
              <>
                <div className="mt-6 mb-2.5">
                  <SectionHeader className="mb-0">{t('weatherStationsLabel')}</SectionHeader>
                </div>
                <div className="space-y-3">
                  {netatmoGroups.map(([location, group]) => (
                    <NetatmoLocationCard
                      key={location}
                      location={location}
                      group={group}
                      open={!!openNetatmo[location]}
                      onToggle={() => setOpenNetatmo((prev) => ({ ...prev, [location]: !prev[location] }))}
                      refreshDevice={refreshDevice}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Hitre akcije / Fotovoltaika "coming soon" cards hidden 2026-09-15
            (B: keep them on the backlog, don't show unfinished stubs) —
            both still on the backlog, see project overview. Re-add these
            two ComingSoonCard lines (icon="⚡"/title={t('soonQuickActions')}/
            subtitle={t('soonQuickActionsDesc')}, and icon="☀️"/
            title={t('soonSolar')}) plus the soonSectionLabel header above
            them once either ships enough to preview. */}

        <FavoritesEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          devices={devices}
          favoriteIds={effectiveFavoriteIds}
          onSave={setFavorites}
        />
      </PageBody>
    </Screen>
  );
}
