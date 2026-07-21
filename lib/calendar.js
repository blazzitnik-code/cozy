// Koledarko (manual calendar) — event types + recurrence expansion.
// Labels are translated via next-intl (Calendar.types.<key>); the emoji is the
// DATA icon. Kept as a plain object so both the picker and rendering share it.
import { localDateStr, localDateFromStr } from './utils';

export const EVENT_TYPES = {
  sluzba: { emoji: '💼' },
  sport: { emoji: '🏃' },
  dom: { emoji: '🏠' },
  socialno: { emoji: '🎉' },
  zdravje: { emoji: '🏥' },
  sola: { emoji: '🎓' },
  potovanje: { emoji: '✈️' },
  opravki: { emoji: '🗑️' },
  other: { emoji: '📌' },
};

export const EVENT_TYPE_KEYS = Object.keys(EVENT_TYPES);

export const RECURRENCE_KEYS = ['once', 'weekly', 'monthly', 'yearly', 'custom'];

const DAY_MS = 86400000;

// Expand raw events into concrete occurrences within [rangeStart, rangeEnd]
// (both local Date). Each occurrence is { ...event, _date: 'YYYY-MM-DD' }.
// All date math is LOCAL (localDateStr / localDateFromStr) — never toISOString,
// which returns the UTC day and drifts around midnight.
export function expandEvents(events, rangeStart, rangeEnd) {
  const out = [];
  const startDay = new Date(rangeStart);
  startDay.setHours(0, 0, 0, 0);
  const endDay = new Date(rangeEnd);
  endDay.setHours(23, 59, 59, 999);

  for (const ev of events) {
    if (!ev.event_date) continue;
    const base = localDateFromStr(ev.event_date); // local midnight of the series start
    const skips = new Set(ev.skip_dates || []);

    const pushIf = (d) => {
      if (d < startDay || d > endDay || d < base) return;
      const ds = localDateStr(d);
      if (skips.has(ds)) return;
      out.push({ ...ev, _date: ds });
    };

    if (ev.recurrence === 'weekly' || ev.recurrence === 'custom') {
      const step = ev.recurrence === 'custom' ? Math.max(1, ev.recurrence_interval || 1) : 1;
      const stepDays = 7 * step;
      const d = new Date(base);
      // Fast-forward near startDay so a long-running weekly series doesn't loop
      // once per week from its creation date.
      if (d < startDay) {
        const jumps = Math.floor((startDay - d) / DAY_MS / stepDays);
        if (jumps > 0) d.setDate(d.getDate() + jumps * stepDays);
      }
      while (d <= endDay) {
        pushIf(d);
        d.setDate(d.getDate() + stepDays);
      }
    } else if (ev.recurrence === 'monthly') {
      const d = new Date(base);
      while (d <= endDay) {
        pushIf(d);
        d.setMonth(d.getMonth() + 1);
      }
    } else if (ev.recurrence === 'yearly') {
      const d = new Date(base);
      while (d <= endDay) {
        pushIf(d);
        d.setFullYear(d.getFullYear() + 1);
      }
    } else {
      // 'once' (and any unknown value) → single occurrence on event_date.
      pushIf(new Date(base));
    }
  }

  out.sort((a, b) => {
    if (a._date !== b._date) return a._date < b._date ? -1 : 1;
    if (a.all_day && !b.all_day) return -1;
    if (!a.all_day && b.all_day) return 1;
    return (a.start_time || '') < (b.start_time || '') ? -1 : 1;
  });
  return out;
}
