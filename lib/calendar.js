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

// ─── FREEBUSY (Koledarko phase 2) ───
// A raw ICS export is fragmented — back-to-back meetings arrive as separate
// rows. Merge overlapping/touching blocks from the SAME source (per member,
// per calendar) into one continuous span, so "when does work end" reads as a
// single bar instead of five slivers. Blocks from different sources (e.g. a
// personal calendar overlapping a work one) are kept separate on purpose —
// merging across sources would blur "busy for work" into "busy generally".
export function mergeBusyBlocks(blocks) {
  const groups = new Map();
  for (const b of blocks) {
    const key = `${b.user_id}||${b.source_label || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  const merged = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, c) => new Date(a.starts_at) - new Date(c.starts_at));
    let cur = null;
    for (const b of sorted) {
      const s = new Date(b.starts_at).getTime();
      const e = new Date(b.ends_at).getTime();
      if (cur && s <= cur.endMs) {
        cur.endMs = Math.max(cur.endMs, e);
        cur.allDay = cur.allDay || !!b.all_day;
      } else {
        if (cur) merged.push(cur);
        cur = {
          id: b.id,
          user_id: b.user_id,
          source_label: b.source_label,
          allDay: !!b.all_day,
          startMs: s,
          endMs: e,
        };
      }
    }
    if (cur) merged.push(cur);
  }
  return merged
    .map((m) => ({
      id: m.id,
      user_id: m.user_id,
      source_label: m.source_label,
      all_day: m.allDay,
      starts_at: new Date(m.startMs).toISOString(),
      ends_at: new Date(m.endMs).toISOString(),
    }))
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
}

// Free time shared by every id in `userIds`, within [dayStart, dayEnd] (local
// Date instances — callers pass a waking-hours window, not the full 24 h, so
// a 2am gap between two late blocks never reads as a "shared free" slot).
// Needs at least 2 tracked members or there's nothing to intersect against.
export function commonFreeIntervals(mergedBlocks, userIds, dayStart, dayEnd) {
  if (userIds.length < 2) return [];
  const rangeStart = dayStart.getTime();
  const rangeEnd = dayEnd.getTime();

  const freePerUser = userIds.map((uid) => {
    const busy = mergedBlocks
      .filter((b) => b.user_id === uid && new Date(b.ends_at) > dayStart && new Date(b.starts_at) < dayEnd)
      .map((b) => ({
        s: Math.max(new Date(b.starts_at).getTime(), rangeStart),
        e: Math.min(new Date(b.ends_at).getTime(), rangeEnd),
      }))
      .sort((a, c) => a.s - c.s);

    const free = [];
    let cursor = rangeStart;
    for (const b of busy) {
      if (b.s > cursor) free.push({ s: cursor, e: Math.min(b.s, rangeEnd) });
      cursor = Math.max(cursor, b.e);
    }
    if (cursor < rangeEnd) free.push({ s: cursor, e: rangeEnd });
    return free.filter((f) => f.e > f.s);
  });

  return (
    freePerUser.reduce((acc, list) => {
      if (!acc) return list;
      const out = [];
      let i = 0;
      let j = 0;
      while (i < acc.length && j < list.length) {
        const s = Math.max(acc[i].s, list[j].s);
        const e = Math.min(acc[i].e, list[j].e);
        if (e > s) out.push({ s, e });
        if (acc[i].e < list[j].e) i++;
        else j++;
      }
      return out;
    }, null) || []
  );
}
