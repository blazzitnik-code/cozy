// ─── SHOPPING ANALYTICS ───
// Pure analysis over shopping_archived rows (mirrors lib/calendar.js's role for
// the calendar). No prices from the web — amounts are entered by the user at
// checkout. Columns used: name, completed_at, store_note, amount, purchase_group.
import { localDateStr } from './utils';

const rowDate = (item) => new Date(item.completed_at || item.created_at);

// Smart suggestions from the purchase archive.
//   frequent — items bought >= 3 times (by normalized name).
//   due      — frequent items whose time since last buy has reached ~their
//              average interval (i.e. probably needed again).
export function analyzeShoppingSuggestions(archivedItems) {
  const byName = {};
  for (const item of archivedItems) {
    const key = (item.name || '').trim().toLowerCase();
    if (!key) continue;
    if (!byName[key]) byName[key] = { name: item.name.trim(), store: item.store, dates: [], count: 0 };
    byName[key].count++;
    const d = rowDate(item);
    if (!isNaN(d.getTime())) byName[key].dates.push(d);
  }

  const now = new Date();
  const frequent = [];
  const due = [];

  for (const key in byName) {
    const g = byName[key];
    if (g.count < 3) continue;
    frequent.push({ name: g.name, store: g.store, count: g.count });

    if (g.dates.length >= 2) {
      g.dates.sort((a, b) => a - b);
      let totalGap = 0;
      for (let i = 1; i < g.dates.length; i++) totalGap += (g.dates[i] - g.dates[i - 1]) / 864e5; // days
      const avgGap = totalGap / (g.dates.length - 1);
      const daysSince = (now - g.dates[g.dates.length - 1]) / 864e5;
      // Due once elapsed time reaches 85% of the average interval.
      if (avgGap > 0 && daysSince >= avgGap * 0.85) {
        due.push({ name: g.name, store: g.store, daysSince: Math.round(daysSince), avgGap: Math.round(avgGap) });
      }
    }
  }

  frequent.sort((a, b) => b.count - a.count);
  due.sort((a, b) => b.daysSince - a.daysSince);
  return { frequent: frequent.slice(0, 8), due: due.slice(0, 6) };
}

// Monthly spend analysis + a purchase-grouped list for the analysis screen.
// A "purchase" = one checkout (shared purchase_group); rows without one fall
// back to a solo group so legacy archive data still renders. `refMonth`
// selects which calendar month to analyze/list (defaults to the current
// one) — the caller paginates by passing a different month, so the
// purchase list below the summary shows one month at a time instead of
// the entire archive on a single unbounded page.
export function analyzeShoppingHistory(archivedItems, refMonth = new Date()) {
  const monthStart = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1);
  const monthEnd = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 1);

  const groups = {};
  for (const item of archivedItems) {
    // purchase_group links every item checked out together (see
    // archiveChecked in lib/hooks.js) — always set on new archives. Legacy
    // rows from before that column existed have none; falling back to
    // item.id would turn each individual item into its own "purchase",
    // wildly inflating both the purchase count and the missing-amount
    // count for old data. Group those by day (+ store, in case two
    // different stores were visited the same day) instead, since that's
    // the same real-world "one trip" a purchase_group represents.
    const gid = item.purchase_group || 'solo-' + localDateStr(rowDate(item)) + '|' + (item.store || '');
    if (!groups[gid]) groups[gid] = { id: gid, items: [], amount: null, store: '', date: null };
    groups[gid].items.push(item);
    if (item.amount != null) groups[gid].amount = Number(item.amount);
    if (item.store_note) groups[gid].store = item.store_note;
    const d = rowDate(item);
    if (!isNaN(d.getTime()) && (!groups[gid].date || d > groups[gid].date)) groups[gid].date = d;
  }

  const allGroups = Object.values(groups);
  const monthGroups = allGroups.filter((g) => g.date && g.date >= monthStart && g.date < monthEnd);

  // Sum ONLY purchases that actually have an amount — a purchase with no
  // amount entered is "unknown", not "€0". Summing g.amount||0 over every
  // purchase would silently understate real spend whenever even one basket
  // this month was archived without a price (the common case, since it's
  // opt-in at checkout). monthMissingCount lets the UI say so explicitly
  // instead of presenting a partial total as if it were the full picture.
  const withAmount = monthGroups.filter((g) => g.amount != null);
  const monthTotal = withAmount.reduce((s, g) => s + g.amount, 0);
  const monthCount = monthGroups.length;
  const monthMissingCount = monthGroups.length - withAmount.length;
  const avgBasket = withAmount.length ? monthTotal / withAmount.length : 0;
  const avgItems = monthGroups.length ? monthGroups.reduce((s, g) => s + g.items.length, 0) / monthGroups.length : 0;

  // Spend by store this month ('' = no store noted → "Other" in the UI).
  const byStore = {};
  for (const g of monthGroups) {
    const store = g.store || '';
    byStore[store] = (byStore[store] || 0) + (g.amount || 0);
  }
  const storeList = Object.entries(byStore)
    .map(([store, amount]) => ({ store, amount }))
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  // Most-bought items across the whole archive.
  const nameCounts = {};
  for (const item of archivedItems) {
    const key = (item.name || '').trim();
    if (!key) continue;
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  }
  const topItems = Object.entries(nameCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Compare this month's spend against the average of prior months that
  // actually have reliable amount data — a rolling baseline rather than a
  // fixed target, since real spend legitimately varies month to month.
  // Months before amount-tracking started (or any month with zero priced
  // purchases) contribute nothing here, so they can't drag a false
  // "average" down — only months that themselves have a real monthTotal do.
  const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();
  const refIndex = monthIndex(monthStart);
  const priorTotals = {};
  for (const g of allGroups) {
    if (!g.date || g.amount == null) continue;
    const idx = monthIndex(g.date);
    if (idx >= refIndex) continue; // only strictly earlier months feed the average
    priorTotals[idx] = (priorTotals[idx] || 0) + g.amount;
  }
  const priorMonthTotals = Object.values(priorTotals);
  const avgMonthsCount = priorMonthTotals.length;
  const avgMonthlySpend = avgMonthsCount ? priorMonthTotals.reduce((s, t) => s + t, 0) / avgMonthsCount : null;
  // Only meaningful once both sides are real: an average from history, and
  // an actual (not entirely amount-less) total for the month being viewed.
  const vsAveragePct =
    avgMonthlySpend && withAmount.length ? Math.round(((monthTotal - avgMonthlySpend) / avgMonthlySpend) * 100) : null;

  return {
    monthTotal,
    monthCount,
    monthMissingCount,
    avgBasket,
    avgItems: Math.round(avgItems),
    avgMonthlySpend,
    avgMonthsCount,
    vsAveragePct,
    hasAmounts: withAmount.length > 0,
    storeList,
    topItems,
    // Scoped to refMonth — this is what the day-grouped purchase list
    // renders while browsing normally, so one month shows at a time.
    groups: monthGroups.sort((a, b) => (b.date || 0) - (a.date || 0)),
    // Full, unbounded history — the search box searches across everything,
    // not just the currently open month (finding "when did I last buy X"
    // shouldn't require paging back through every month by hand).
    allGroups: allGroups.sort((a, b) => (b.date || 0) - (a.date || 0)),
  };
}
