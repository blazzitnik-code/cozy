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

// ─── EXPIRY STATUS ───
export function getSt(item) {
  const d = (new Date(item.expiry) - new Date()) / 864e5;
  return d < 0 ? 'expired' : d < 30 ? 'warning' : 'ok';
}
export function fmtD(d) {
  return new Date(d).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function wksUntil(d) {
  const days = Math.ceil((new Date(d) - new Date()) / 864e5);
  if (days < 0) {
    const w = Math.floor(Math.abs(days) / 7);
    return w === 0 ? Math.abs(days) + ' dni čez rok' : w + ' tednov čez rok';
  }
  if (days < 7) return 'še ' + days + ' dni';
  return 'še ' + Math.floor(days / 7) + ' tednov';
}
export function wksShort(d) {
  const days = Math.ceil((new Date(d) - new Date()) / 864e5);
  if (days < 0) {
    const w = Math.floor(Math.abs(days) / 7);
    return w === 0 ? Math.abs(days) + 'd čez' : w + 't čez';
  }
  return days < 7 ? days + 'd' : Math.floor(days / 7) + 't';
}
// Expiry-status class maps. Full literal class strings only — Tailwind's
// scanner can't see concatenated fragments.
export const STATUS_TEXT = { expired: 'text-red-500', warning: 'text-amber-500', ok: 'text-green-500' };
export const STATUS_CARD = {
  expired: 'bg-red-500/8 border-red-500/20',
  warning: 'bg-amber-500/8 border-amber-500/15',
  ok: 'bg-green-500/4 border-indigo-500/15 dark:border-slate-600/20',
};
export const STATUS_BADGE = {
  expired: 'text-red-500 bg-red-500/8',
  warning: 'text-amber-500 bg-amber-500/8',
  ok: 'text-green-500 bg-green-500/8',
};

// Todo due-date urgency: tone key + class maps (progress bar / badge)
export const dueTone = (daysLeft) =>
  daysLeft === null ? 'normal' : daysLeft < 0 ? 'past' : daysLeft <= 7 ? 'urgent' : 'normal';
export const DUE_TEXT = { past: 'text-red-500', urgent: 'text-amber-500', normal: 'text-purple-500' };
export const DUE_BAR = { past: 'bg-red-500', urgent: 'bg-amber-500', normal: 'bg-purple-500' };
export const DUE_BADGE = {
  past: 'bg-red-500/13 text-red-500',
  urgent: 'bg-amber-500/13 text-amber-500',
  normal: 'bg-purple-500/13 text-purple-500',
};

// ─── CALENDAR ───
export function detectEventType(title) {
  const t = (title || '').toLowerCase();
  if (/sestanek|meeting|standup|konferenc|seja|intervju|sync|review|call/.test(t)) return '💼';
  if (/zdravnik|doktor|zobozdravnik|bolnica|fizioter|psiholog|pregled/.test(t)) return '🏥';
  if (/tek|gym|trening|fitnes|plavanje|kolesarjenje|yoga|pilates|šport/.test(t)) return '🏃';
  if (/letalo|vlak|avtobus|potovanje|dopust|hotel|airport|flight/.test(t)) return '✈️';
  if (/večerja|kosilo|zajtrk|zabava|rojstni|poroka|party|piknik|kino/.test(t)) return '🎉';
  if (/dom|čiščenje|servis|popravilo|dostava/.test(t)) return '🏠';
  return '📅';
}

export function fmtTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
}
