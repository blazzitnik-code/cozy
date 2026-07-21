// ─── CLASSNAMES ───
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Conditional-class joiner with Tailwind conflict resolution: later classes
// win over earlier ones for the same CSS property, so component className
// overrides (e.g. <Card className="rounded-xl">) are safe.
export const cx = (...a) => twMerge(clsx(a));

// ─── DATES ───
// YYYY-MM-DD in *local* time. Never use toISOString().split('T')[0] for
// calendar dates — it returns the UTC date, which is yesterday between
// midnight and ~2am in Slovenia.
export function localDateStr(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The inverse: parse 'YYYY-MM-DD' as *local* midnight. `new Date(str)` parses
// date-only strings as UTC midnight, which is off by a day in negative-offset
// timezones when the result is fed back through local date math.
export function localDateFromStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ─── EXPIRY STATUS ───
// Math.ceil'd whole days, same as expiryInfo below — the raw fractional diff
// would flag an item 'expired' for the whole of its expiry day while the
// expiry text still says "today".
export function getSt(item) {
  const days = Math.ceil((new Date(item.expiry) - new Date()) / 864e5);
  return days < 0 ? 'expired' : days < 30 ? 'warning' : 'ok';
}
// Distance to the expiry date as structured data; the user-facing text is
// built from this in lib/intl.js (useExpiryText) with ICU plurals.
export function expiryInfo(d) {
  const days = Math.ceil((new Date(d) - new Date()) / 864e5);
  const overdue = days < 0;
  const abs = Math.abs(days);
  return { overdue, days: abs, weeks: Math.floor(abs / 7) };
}
// Expiry-status class maps. Full literal class strings only — Tailwind's
// scanner can't see concatenated fragments. Text tones use the -600 step in
// light (the -500 amber/orange fail AA on white/cream) and -400 in dark.
export const STATUS_TEXT = {
  expired: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  ok: 'text-green-600 dark:text-green-400',
};
// Freezer rows are flat (dotted dividers on the page background). The bg must
// stay opaque and page-colored so SwipeCard's reveal layer is hidden at rest;
// status is carried by the badge + text, not a row tint.
export const STATUS_ROW = {
  expired: 'bg-stone-100 dark:bg-stone-950',
  warning: 'bg-stone-100 dark:bg-stone-950',
  ok: 'bg-stone-100 dark:bg-stone-950',
};
export const STATUS_BADGE = {
  expired: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  ok: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
};

// Todo due-date urgency: tone key + class maps (progress bar / badge).
// "normal" is neutral ink — urgency is the only thing that earns color.
export const dueTone = (daysLeft) =>
  daysLeft === null ? 'normal' : daysLeft < 0 ? 'past' : daysLeft <= 7 ? 'urgent' : 'normal';
export const DUE_TEXT = {
  past: 'text-red-600 dark:text-red-400',
  urgent: 'text-amber-600 dark:text-amber-400',
  normal: 'text-stone-500 dark:text-stone-400',
};
export const DUE_BAR = { past: 'bg-red-500', urgent: 'bg-amber-500', normal: 'bg-stone-900 dark:bg-stone-100' };
export const DUE_BADGE = {
  past: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  urgent: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  normal: 'bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
};

// ─── PERSON TONES (calendar lanes, home event rows) ───
// Single source for the me/partner color pair (softened indigo/pink) — used by
// CalendarModule's two-lane grid and HomeScreen's today-events list.
export const PERSON = {
  me: {
    dot: 'bg-indigo-500',
    lane: 'border-indigo-200 dark:border-indigo-500/20',
    block: 'bg-indigo-50 dark:bg-indigo-500/10',
    border: 'border-indigo-100 dark:border-indigo-500/25',
    borderHi: 'border-indigo-400 dark:border-indigo-500/60',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  partner: {
    dot: 'bg-pink-500',
    lane: 'border-pink-200 dark:border-pink-500/20',
    block: 'bg-pink-50 dark:bg-pink-500/10',
    border: 'border-pink-100 dark:border-pink-500/25',
    borderHi: 'border-pink-400 dark:border-pink-500/60',
    text: 'text-pink-600 dark:text-pink-400',
  },
};

// Member accent colours — stored as a token string in household_members.color
// (class names, not hex, to stay clear of the no-raw-hex audit). Shared by the
// member editor (AppShell) and Koledarko (per-person bars/dots).
export const MEMBER_COLORS = [
  { t: 'indigo', c: 'bg-indigo-500' },
  { t: 'pink', c: 'bg-pink-500' },
  { t: 'emerald', c: 'bg-emerald-500' },
  { t: 'amber', c: 'bg-amber-500' },
  { t: 'sky', c: 'bg-sky-500' },
  { t: 'violet', c: 'bg-violet-500' },
  { t: 'rose', c: 'bg-rose-500' },
  { t: 'teal', c: 'bg-teal-500' },
];
export const memberColorClass = (token) => MEMBER_COLORS.find((x) => x.t === token)?.c;

// ─── CALENDAR ───
// Keywords cover Slovenian AND English — event titles come from Google
// Calendar in whatever language they were written in.
export function detectEventType(title) {
  const t = (title || '').toLowerCase();
  if (/sestanek|meeting|standup|konferenc|seja|intervju|sync|review|call/.test(t)) return '💼';
  if (
    /zdravnik|doktor|zobozdravnik|bolnica|fizioter|psiholog|pregled|doctor|dentist|hospital|physio|therap|clinic|checkup/.test(
      t,
    )
  )
    return '🏥';
  if (/tek|gym|trening|fitnes|plavanje|kolesarjenje|yoga|pilates|šport|workout|swimm|cycling|running/.test(t))
    return '🏃';
  if (/letalo|vlak|avtobus|potovanje|dopust|hotel|airport|flight|trip|vacation|travel/.test(t)) return '✈️';
  if (
    /večerja|kosilo|zajtrk|zabava|rojstni|poroka|party|piknik|kino|dinner|lunch|birthday|wedding|picnic|movie/.test(t)
  )
    return '🎉';
  if (/dom|čiščenje|servis|popravilo|dostava|cleaning|repair|delivery|plumb|maintenance/.test(t)) return '🏠';
  return '📅';
}

// Open-Meteo WMO weather_code → { emoji, key } where key is a Weather.* i18n
// key (rendered per-locale by the caller). Cascade order matters — WMO codes
// are sparse (0-3, 45/48, 51-67, 71-77, 80-82, 85-86, 95-99).
export function weatherInfo(code) {
  if (code == null) return { emoji: '🌡️', key: 'clear' };
  if (code === 0) return { emoji: '☀️', key: 'clear' };
  if (code <= 3) return { emoji: '⛅', key: 'partlyCloudy' };
  if (code <= 48) return { emoji: '🌫️', key: 'fog' };
  if (code <= 67) return { emoji: '🌧️', key: 'rain' };
  if (code <= 77) return { emoji: '❄️', key: 'snow' };
  if (code <= 82) return { emoji: '🌦️', key: 'showers' };
  if (code <= 86) return { emoji: '❄️', key: 'snow' };
  return { emoji: '⛈️', key: 'storm' };
}

// Relative day label for board notes: returns a Board.* i18n key + params.
// Caller renders via useTranslations('Board'): t(key, params).
export function relativeDay(iso) {
  const startDiff = Math.round((new Date(localDateStr()) - new Date(localDateStr(new Date(iso)))) / 864e5);
  if (startDiff <= 0) return { key: 'today', params: {} };
  if (startDiff === 1) return { key: 'yesterday', params: {} };
  return { key: 'daysAgo', params: { n: startDiff } };
}
