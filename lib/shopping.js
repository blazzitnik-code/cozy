// ─── SHOPPING ANALYTICS ───
// Pure analysis over shopping_archived rows (mirrors lib/calendar.js's role for
// the calendar). No prices from the web — amounts are entered by the user at
// checkout. Columns used: name, completed_at, store_note, amount, purchase_group.

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
// back to a solo group so legacy archive data still renders.
export function analyzeShoppingHistory(archivedItems) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups = {};
  for (const item of archivedItems) {
    const gid = item.purchase_group || 'solo-' + item.id;
    if (!groups[gid]) groups[gid] = { id: gid, items: [], amount: null, store: '', date: null };
    groups[gid].items.push(item);
    if (item.amount != null) groups[gid].amount = Number(item.amount);
    if (item.store_note) groups[gid].store = item.store_note;
    const d = rowDate(item);
    if (!isNaN(d.getTime()) && (!groups[gid].date || d > groups[gid].date)) groups[gid].date = d;
  }

  const allGroups = Object.values(groups);
  const monthGroups = allGroups.filter((g) => g.date && g.date >= monthStart);

  const monthTotal = monthGroups.reduce((s, g) => s + (g.amount || 0), 0);
  const monthCount = monthGroups.length;
  const withAmount = monthGroups.filter((g) => g.amount != null);
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

  return {
    monthTotal,
    monthCount,
    avgBasket,
    avgItems: Math.round(avgItems),
    hasAmounts: withAmount.length > 0,
    storeList,
    topItems,
    groups: allGroups.sort((a, b) => (b.date || 0) - (a.date || 0)),
  };
}
