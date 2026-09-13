'use client';
import { useState } from 'react';
import { ChevronDown, ChevronUp, Minus, Plus, RefreshCw, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cx } from '@/lib/utils';
import {
  Screen,
  PageBody,
  ModuleHeader,
  Card,
  EmptyState,
  Modal,
  IconButton,
  CHIP_ON,
  CHIP_OFF,
  PRESS,
  PRESS_SM,
  ROW_PRESS,
} from './ui';

// device_type → icon shown next to the device name. Falls back to a plug for
// any future device type this module doesn't know about yet.
const DEVICE_ICONS = { air_conditioner: '❄️', heating_zone: '🔥', domestic_hot_water: '🚿' };

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

function DeviceCard({ device, sendCommand, refreshDevice }) {
  const t = useTranslations('Devices');
  const [advOpen, setAdvOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshDevice(device.id);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
            {DEVICE_ICONS[device.device_type] || '🔌'} {device.name}
          </div>
          <div className="mt-0.5 truncate text-xs text-stone-400 dark:text-stone-500">
            {[device.room, device.provider === 'melcloud_home' && 'Mitsubishi Electric'].filter(Boolean).join(' · ')}
          </div>
        </div>
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
            className={cx(
              'size-1.5 shrink-0 rounded-full',
              state.online ? 'bg-green-600 dark:bg-green-400' : 'bg-stone-400',
            )}
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

      <div className="flex items-center justify-between border-t border-stone-200/70 pt-3 dark:border-white/10">
        <div className="text-[13px] font-semibold text-stone-900 dark:text-stone-100">{t('power')}</div>
        <button
          role="switch"
          aria-checked={state.power}
          onClick={() => sendCommand(device.id, 'power', !state.power, { power: !state.power })}
          className={cx(
            'relative h-8 w-14 cursor-pointer rounded-full border-none transition-colors',
            state.power ? 'bg-stone-900 dark:bg-stone-100' : 'bg-stone-300 dark:bg-stone-700',
            PRESS_SM,
          )}
        >
          <span
            className={cx(
              'absolute top-1 size-6 rounded-full bg-white shadow-sm transition-[left] dark:bg-stone-900',
              state.power ? 'left-[calc(100%-28px)]' : 'left-1',
            )}
          />
        </button>
      </div>

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

      {advOpen && (
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
                className={cx(
                  'font-semibold',
                  state.error ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400',
                )}
              >
                {state.error || t('noError')}
              </span>
            </div>
          </div>
        </div>
      )}

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
    </Card>
  );
}

function VaillantZoneCard({ device, sendCommand, refreshDevice }) {
  const t = useTranslations('Devices');
  const [refreshing, setRefreshing] = useState(false);
  const syncedLabel = useSyncedLabel(device.last_synced_at);

  const { state, capabilities } = device;
  const min = capabilities?.minTemperature ?? 5;
  const max = capabilities?.maxTemperature ?? 30;
  const step = 0.5;
  const displayTarget = state.quickVetoActive
    ? state.targetTemperature
    : (state.manualSetpoint ?? state.targetTemperature);

  const handleRefresh = async () => {
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
      sendCommand(device.id, 'zone_setpoint', next, {
        targetTemperature: next,
        manualSetpoint: next,
      });
    } else {
      // Adjusting the temperature while on a schedule (or already in a quick
      // veto) starts/updates a temporary override — same as tapping +/- in
      // the myVAILLANT app while in Auto.
      sendCommand(device.id, 'quick_veto', next, { targetTemperature: next, quickVetoActive: true });
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
            {DEVICE_ICONS[device.device_type] || '🔌'} {device.name}
          </div>
          <div className="mt-0.5 truncate text-xs text-stone-400 dark:text-stone-500">Vaillant</div>
        </div>
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
            className={cx(
              'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold',
              m === state.mode ? CHIP_ON : CHIP_OFF,
              PRESS_SM,
            )}
          >
            {t(VAILLANT_MODE_KEYS[m])}
          </button>
        ))}
      </div>

      {state.quickVetoActive && (
        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-amber-600/20 bg-amber-600/8 px-3 py-2 dark:border-amber-500/20 dark:bg-amber-500/10">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            {t('vaillantQuickVetoActive')}
          </span>
          <button
            onClick={() => sendCommand(device.id, 'cancel_quick_veto', null, { quickVetoActive: false })}
            className={cx(
              'cursor-pointer rounded-full border-none bg-transparent text-xs font-bold text-amber-700 underline dark:text-amber-400',
              PRESS_SM,
            )}
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
    </Card>
  );
}

function VaillantDhwCard({ device, sendCommand, refreshDevice }) {
  const t = useTranslations('Devices');
  const [refreshing, setRefreshing] = useState(false);
  const syncedLabel = useSyncedLabel(device.last_synced_at);

  const { state, capabilities } = device;
  const min = capabilities?.minTemperature ?? 35;
  const max = capabilities?.maxTemperature ?? 65;

  const handleRefresh = async () => {
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
    <Card className="p-4">
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
            {DEVICE_ICONS[device.device_type] || '🔌'} {device.name}
          </div>
          <div className="mt-0.5 truncate text-xs text-stone-400 dark:text-stone-500">Vaillant</div>
        </div>
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
            className={cx(
              'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold',
              m === state.mode ? CHIP_ON : CHIP_OFF,
              PRESS_SM,
            )}
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
    </Card>
  );
}

function ComingSoonCard({ icon, title, subtitle }) {
  const t = useTranslations('Devices');
  return (
    <div className="mb-2 flex items-center gap-2.5 rounded-2xl border border-dashed border-stone-300 px-3.5 py-3 dark:border-stone-700">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-stone-100 text-sm dark:bg-stone-800">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-semibold text-stone-500 dark:text-stone-400">{title}</div>
        {subtitle && <div className="truncate text-[10.5px] text-stone-400 dark:text-stone-500">{subtitle}</div>}
      </div>
      <div className="shrink-0 text-[9.5px] font-bold tracking-[0.5px] text-stone-400 uppercase dark:text-stone-500">
        {t('soonTag')}
      </div>
    </div>
  );
}

export default function DevicesModule({
  devices,
  loading,
  sendCommand,
  refreshDevice,
  connections,
  connectionsLoading,
  onGoHome,
  onOpenSettings,
}) {
  const tMod = useTranslations('Modules');
  const t = useTranslations('Devices');
  const ta = useTranslations('A11y');

  const showReauthBanner = !connectionsLoading && (connections || []).some((c) => c?.status === 'error');
  const notConnected = !connectionsLoading && (connections || []).every((c) => !c);

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
              <div
                key={i}
                className="h-64 rounded-2xl border border-stone-200/70 bg-white dark:border-white/10 dark:bg-stone-900"
              />
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
          <div className="space-y-3">
            {devices.map((device) => {
              if (device.provider === 'vaillant' && device.device_type === 'heating_zone') {
                return (
                  <VaillantZoneCard
                    key={device.id}
                    device={device}
                    sendCommand={sendCommand}
                    refreshDevice={refreshDevice}
                  />
                );
              }
              if (device.provider === 'vaillant' && device.device_type === 'domestic_hot_water') {
                return (
                  <VaillantDhwCard
                    key={device.id}
                    device={device}
                    sendCommand={sendCommand}
                    refreshDevice={refreshDevice}
                  />
                );
              }
              return (
                <DeviceCard key={device.id} device={device} sendCommand={sendCommand} refreshDevice={refreshDevice} />
              );
            })}
          </div>
        )}

        <div className="mt-6 mb-2.5 text-xs font-bold tracking-[0.5px] text-stone-400 uppercase dark:text-stone-500">
          {t('soonSectionLabel')}
        </div>
        <ComingSoonCard icon="⚡" title={t('soonQuickActions')} subtitle={t('soonQuickActionsDesc')} />
        <ComingSoonCard icon="☀️" title={t('soonSolar')} />
      </PageBody>
    </Screen>
  );
}
