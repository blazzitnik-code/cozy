'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import { SHOP_SUGG } from '@/lib/constants';
import { cx } from '@/lib/utils';
import {
  Screen,
  PageBody,
  Btn,
  Modal,
  ConfirmModal,
  LogoToggle,
  Input,
  Label,
  IconButton,
  EmptyState,
  BackBtn,
  CHIP_AMBER_ON,
  CHIP_OFF,
  POPOVER,
  POPOVER_POP,
  POP,
  LIST_ROW,
} from './ui';

const STORE_ICONS = ['🟢', '🟣', '🔵', '🟠', '🔴', '🟡', '⚫', '🏪'];

// Module scope on purpose: defined inside ShoppingModule its identity would
// change every render, remounting all rows (and killing their transitions).
// `ref` reaches the DOM node — required by AnimatePresence mode="popLayout".
// Reorderable rows render as Reorder.Item (inside a group's Reorder.Group,
// dragged by the ⠿ handle only); bought-section rows stay plain motion.div.
function ShopItemRow({
  item,
  store,
  activeStore,
  reorderable = false,
  onRowDragStart,
  onRowDragEnd,
  onToggle,
  onOpenDetail,
  ref,
}) {
  const dragControls = useDragControls();
  const rowClass = cx(
    // transition-colors ONLY — a transition covering transform/opacity would
    // re-ease Motion's per-frame drag/layout writes and make dragging lag.
    'relative flex touch-pan-y items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-colors duration-200',
    item.checked
      ? 'border-indigo-500/6 bg-white/30 opacity-50 dark:border-slate-600/8 dark:bg-slate-800/20'
      : 'border-indigo-500/15 bg-white/70 dark:border-slate-600/20 dark:bg-slate-800/50',
  );
  const inner = (
    <>
      {reorderable && (
        <span
          onPointerDown={(e) => {
            e.preventDefault();
            dragControls.start(e);
          }}
          className="-m-2 shrink-0 cursor-grab touch-none p-2 text-sm text-slate-300 select-none active:cursor-grabbing dark:text-slate-600"
        >
          ⠿
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item.id);
        }}
        className={cx(
          'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 text-sm text-white transition-colors duration-150',
          item.checked
            ? 'border-green-500 bg-green-500'
            : 'border-indigo-500/20 bg-transparent dark:border-slate-600/30',
        )}
      >
        {item.checked && <motion.span {...POP}>✓</motion.span>}
      </button>
      <div onClick={() => onOpenDetail(item)} className="min-w-0 flex-1 cursor-pointer">
        <span
          className={cx(
            'text-base font-semibold',
            item.checked ? 'text-slate-300 line-through dark:text-slate-600' : 'text-slate-800 dark:text-slate-200',
          )}
        >
          {item.name}
        </span>
        {item.qty && (
          <span
            className={cx(
              'ml-2 text-sm',
              item.checked ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500',
            )}
          >
            {item.qty}
          </span>
        )}
      </div>
      {activeStore === 'all' && store && <span className="shrink-0 text-xs">{store.icon}</span>}
    </>
  );
  if (!reorderable)
    return (
      <motion.div ref={ref} {...LIST_ROW} className={rowClass}>
        {inner}
      </motion.div>
    );
  return (
    // No `layout` prop here — Reorder.Item is already a layout component.
    <Reorder.Item
      as="div"
      ref={ref}
      value={item}
      dragListener={false}
      dragControls={dragControls}
      whileDrag={{ scale: 1.02 }}
      onDragStart={onRowDragStart}
      onDragEnd={onRowDragEnd}
      initial={LIST_ROW.initial}
      animate={LIST_ROW.animate}
      exit={LIST_ROW.exit}
      transition={LIST_ROW.transition}
      className={rowClass}
    >
      {inner}
    </Reorder.Item>
  );
}

// One Reorder.Group per category group. Items can never move between groups
// (the group is derived from the item name via detectCategory), so per-group
// reordering is the complete model. Order lives in local state during the
// drag; sort_order is persisted once on drag end via onPersist.
function ShopGroup({ items, shopStores, onPersist, rowProps }) {
  const [order, setOrder] = useState(items);
  const orderRef = useRef(items);
  const dragging = useRef(false);
  // True between "our drag ended" and "the persisted order came back via
  // realtime" — while set, stale props (pre-persist order, same id set) must
  // not snap the rows back.
  const pending = useRef(false);
  const adopt = (next) => {
    orderRef.current = next;
    setOrder(next);
  };
  useEffect(() => {
    if (dragging.current) return;
    const propSeq = items.map((i) => i.id).join(',');
    const localSeq = orderRef.current.map((i) => i.id).join(',');
    if (propSeq === localSeq) {
      pending.current = false;
      // Same sequence AND same object refs — parent re-render with identical
      // data (new array identity only); skip the redundant setState cascade.
      if (items.length === orderRef.current.length && items.every((it, i) => it === orderRef.current[i])) return;
    } else if (pending.current && propSeq.split(',').sort().join() === localSeq.split(',').sort().join()) return;
    adopt(items);
  }, [items]);
  return (
    <Reorder.Group as="div" axis="y" values={order} onReorder={adopt} className="relative flex flex-col gap-1">
      <AnimatePresence initial={false} mode="popLayout">
        {order.map((item) => (
          <ShopItemRow
            key={item.id}
            item={item}
            reorderable
            store={shopStores.find((s) => s.id === item.store)}
            onRowDragStart={() => (dragging.current = true)}
            onRowDragEnd={() => {
              dragging.current = false;
              pending.current = true;
              onPersist(orderRef.current);
            }}
            {...rowProps}
          />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}

export default function ShoppingModule({
  shopItems,
  dbShopAdd,
  dbShopUpdate,
  dbShopDelete,
  shopArchive,
  dbShopArchiveChecked,
  shopFavourites,
  dbShopToggleFav,
  shopStores,
  dbAddStore,
  dbUpdateStore,
  dbDeleteStore,
  onToggleMode,
  onOpenSettings,
}) {
  const t = useTranslations('Shopping');
  const tc = useTranslations('Common');
  const ta = useTranslations('A11y');
  const format = useFormatter();
  const locale = useLocale();
  const shopSuggList = SHOP_SUGG[locale] ?? SHOP_SUGG.sl;

  // ─── SHOPPING UI STATE ───
  const [activeStore, setActiveStore] = useState('all');
  const [lastStore, setLastStore] = useState('mercator');
  const [shopInput, setShopInput] = useState('');
  const [shopSugg, setShopSugg] = useState([]);
  const [showShopArchive, setShowShopArchive] = useState(false);
  const [shopDetail, setShopDetail] = useState(null);
  const [showManageStores, setShowManageStores] = useState(false);
  const [showAddStoreForm, setShowAddStoreForm] = useState(false);
  const [newStore, setNewStore] = useState({ name: '', icon: '🔵' });
  const [editingStore, setEditingStore] = useState(null); // { id, name, icon }
  const shopInputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  // All known shopping names for autocomplete
  const shopKnown = useMemo(() => {
    const favNames = shopFavourites.map((f) => f.name);
    const all = [...new Set([...favNames, ...shopSuggList, ...shopArchive.map((a) => a.name)])];
    return all;
  }, [shopFavourites, shopArchive, shopSuggList]);

  // ─── SHOPPING LOGIC ───
  const shopVisible = activeStore === 'all' ? shopItems : shopItems.filter((i) => i.store === activeStore);

  // ─── SMART CATEGORIZATION ───
  // Regexes match Slovenian AND English item names (shared lists can contain
  // both); the section label is rendered from Shopping.sections.<key>.
  // Word-boundary escapes (\bice\b, \boil\b, …) avoid false hits inside
  // longer words ("juice", "toilet", "shampoo", "steak").
  const detectCategory = (name) => {
    const n = name.toLowerCase();
    if (/zamrz|led|sladoled|frozen|ice cream|\bice\b/.test(n)) return { key: 'zamrznjeno', order: 1 };
    if (/mleko|jogurt|sir|smetana|skuta|maslo|jajc|milk|yogurt|yoghurt|cheese|butter|cream|\begg/.test(n))
      return { key: 'mlecni', order: 2 };
    if (
      /piščan|govej|svinjsk|mlet|šunka|salama|riba|losos|puran|meso|chicken|beef|pork|\bham\b|salami|fish|salmon|turkey|meat|shrimp|sausage|bass/.test(
        n,
      )
    )
      return { key: 'meso', order: 3 };
    if (
      /jabolko|hruška|banana|jagod|pomaranč|limona|grozdje|sadje|avokado|borovnic|apple|pear|strawberr|orange|lemon|grape|fruit|avocado|blueberr|peach|melon/.test(
        n,
      )
    )
      return { key: 'sadje', order: 4 };
    if (
      /zelenjav|solata|paradižnik|kumara|paprika|čebula|česen|krompir|brokoli|korenje|grah|špinač|vegetable|lettuce|tomato|cucumber|bell pepper|onion|garlic|potato|broccoli|carrot|peas|spinach|salad/.test(
        n,
      )
    )
      return { key: 'zelenjava', order: 5 };
    if (/kruh|žemlja|burek|pica|torta|kolač|pecivo|rogljič|bread|pizza|cake|pastry|croissant|\bbun\b|bagel/.test(n))
      return { key: 'pekarna', order: 6 };
    if (
      /riž|testenin|moka|sladkor|sol|olje|kis|začimb|poper|kava|čaj|konzerv|rice|pasta|flour|sugar|salt|\bpepper\b|spice|\boil\b|vinegar|coffee|\btea\b|canned|cereal/.test(
        n,
      )
    )
      return { key: 'suho', order: 7 };
    if (/pivo|vino|sok|voda|pijač|beer|wine|juice|water|soda|drink|cola|lemonade/.test(n))
      return { key: 'pijace', order: 8 };
    if (/pes|mačk|pasja|mačja|hrana za|\bdog\b|\bcat\b|pet food/.test(n)) return { key: 'zivali', order: 9 };
    if (
      /pralni|detergent|gobic|toaletni|wc|šampon|gel|milo|zobna|krema|dezodor|laundry|toilet|shampoo|soap|toothpaste|deodorant|sponge|cleaner|\bdish\b/.test(
        n,
      )
    )
      return { key: 'cistila', order: 10 };
    return { key: 'drugo', order: 99 };
  };

  const sortedShop = useMemo(() => {
    const unchecked = shopVisible.filter((i) => !i.checked);
    const checked = shopVisible.filter((i) => i.checked);
    // Sort by sort_order when present, otherwise by created_at
    const sortFn = (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999);
    return [...unchecked.sort(sortFn), ...checked];
  }, [shopVisible]);

  // Group by category for the single-store view
  const shopByCategory = useMemo(() => {
    const unchecked = sortedShop.filter((i) => !i.checked);
    const checked = sortedShop.filter((i) => i.checked);
    const groups = {};
    unchecked.forEach((item) => {
      const cat = detectCategory(item.name);
      if (!groups[cat.key]) groups[cat.key] = { key: cat.key, order: cat.order, items: [] };
      groups[cat.key].items.push(item);
    });
    return { groups: Object.values(groups).sort((a, b) => a.order - b.order), checked };
  }, [sortedShop]);

  async function shopAddItem(name) {
    if (!name.trim()) return;
    const targetStore = activeStore === 'all' ? lastStore : activeStore;
    const existing = shopItems.find(
      (i) => i.name.toLowerCase() === name.toLowerCase() && !i.checked && i.store === targetStore,
    );
    if (existing) return;
    const maxOrder = shopItems.length > 0 ? Math.max(...shopItems.map((i) => i.sort_order ?? 0)) : 0;
    await dbShopAdd({
      name: name.trim(),
      qty: '',
      checked: false,
      store: targetStore,
      favourite: false,
      category: '',
      sort_order: maxOrder + 1,
    });
    setShopInput('');
    setShopSugg([]);
  }

  function shopToggle(id) {
    const item = shopItems.find((i) => i.id === id);
    if (item) dbShopUpdate(id, { checked: !item.checked });
  }

  function shopToggleFav(id) {
    const item = shopItems.find((i) => i.id === id);
    if (item) {
      dbShopUpdate(id, { favourite: !item.favourite });
      dbShopToggleFav(item.name);
    }
  }

  async function shopClearChecked() {
    const targetItems = activeStore === 'all' ? shopItems : shopItems.filter((i) => i.store === activeStore);
    const checked = targetItems.filter((i) => i.checked);
    if (checked.length > 0) await dbShopArchiveChecked(checked);
  }

  function shopInputChange(val) {
    setShopInput(val);
    if (val.length >= 1) {
      const matches = shopKnown.filter((s) => s.toLowerCase().includes(val.toLowerCase())).slice(0, 6);
      setShopSugg(matches);
    } else {
      setShopSugg([]);
    }
  }

  async function addNewStore() {
    if (!newStore.name) return;
    await dbAddStore(newStore);
    setNewStore({ name: '', icon: '🔵' });
  }

  const checkedCount = (activeStore === 'all' ? shopItems : shopItems.filter((i) => i.store === activeStore)).filter(
    (i) => i.checked,
  ).length;
  const uncheckedCount = (activeStore === 'all' ? shopItems : shopItems.filter((i) => i.store === activeStore)).filter(
    (i) => !i.checked,
  ).length;

  // ─── ARCHIVE VIEW ───
  if (showShopArchive) {
    const byDate = {};
    shopArchive.forEach((a) => {
      const d = new Date(a.completed_at);
      const k = format.dateTime(d, 'fullDate');
      if (!byDate[k]) byDate[k] = [];
      byDate[k].push(a);
    });
    return (
      <Screen glow2="bg-radial from-amber-500/12 to-transparent to-70% dark:from-amber-500/6">
        <PageBody>
          <div className="mb-5 flex items-center gap-3 pt-3">
            <BackBtn onClick={() => setShowShopArchive(false)} />
            <h2 className="text-xl font-extrabold">{t('historyTitle')}</h2>
          </div>
          {shopArchive.length === 0 && <EmptyState icon="🧾">{t('historyEmpty')}</EmptyState>}
          {Object.entries(byDate).map(([date, ditems]) => (
            <div key={date} className="mb-4">
              <h3 className="mb-2 text-sm font-bold text-slate-500 dark:text-slate-400">{date}</h3>
              {ditems.map((it, i) => {
                const store = shopStores.find((s) => s.id === it.store);
                return (
                  <div
                    key={it.id + '-' + i}
                    className="mb-[3px] flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 text-sm text-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                  >
                    <span>
                      {it.name}
                      {it.qty ? ' · ' + it.qty : ''}
                    </span>
                    {store && (
                      <span className="text-xs text-slate-300 dark:text-slate-600">
                        {store.icon} {store.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </PageBody>
      </Screen>
    );
  }

  // Persist a group's new order after a drag: reassign the group's own
  // sort_order values (sorted asc) to the new sequence — global cross-group
  // ordering and other groups stay untouched.
  async function persistGroupOrder(ordered) {
    const slots = ordered.map((i) => i.sort_order ?? 0).sort((a, b) => a - b);
    await Promise.all(
      ordered
        .map((item, idx) =>
          (item.sort_order ?? 0) !== slots[idx] ? dbShopUpdate(item.id, { sort_order: slots[idx] }) : null,
        )
        .filter(Boolean),
    );
  }

  // Shared props for the module-scope ShopItemRow.
  const rowProps = {
    activeStore,
    onToggle: shopToggle,
    onOpenDetail: setShopDetail,
  };

  return (
    <Screen glow2="bg-radial from-amber-500/12 to-transparent to-70% dark:from-amber-500/6">
      <PageBody>
        {/* Header */}
        <div className="mb-3.5 flex items-start justify-between pt-3">
          <LogoToggle mode="shopping" onToggle={onToggleMode} />
          <div className="flex items-center gap-2">
            <IconButton onClick={() => setShowShopArchive(true)} aria-label={ta('history')}>
              🧾
            </IconButton>
            <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
              ⚙️
            </IconButton>
          </div>
        </div>

        {/* Store tabs — scrollable row + pinned ··· button */}
        <div className="relative mb-3.5">
          <div className="flex [scrollbar-width:none] gap-1.5 overflow-x-auto pr-11 [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveStore('all')}
              className={cx(
                'shrink-0 cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-bold',
                activeStore === 'all' ? CHIP_AMBER_ON : CHIP_OFF,
              )}
            >
              {t('allCount', { count: shopItems.filter((i) => !i.checked).length })}
            </button>
            {shopStores.map((s) => {
              const cnt = shopItems.filter((i) => i.store === s.id && !i.checked).length;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveStore(s.id);
                    setLastStore(s.id);
                  }}
                  className={cx(
                    'shrink-0 cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-bold',
                    activeStore === s.id ? CHIP_AMBER_ON : CHIP_OFF,
                  )}
                >
                  {s.icon} {s.name} ({cnt})
                </button>
              );
            })}
          </div>
          <button
            aria-label={ta('manageStores')}
            onClick={() => setShowManageStores(true)}
            className="absolute inset-y-0 right-0 flex w-9.5 cursor-pointer items-center justify-end rounded-xl border border-indigo-500/20 bg-linear-to-l from-indigo-50 from-60% to-transparent pr-1 text-base font-bold text-slate-400 dark:border-slate-600/30 dark:from-slate-950 dark:text-slate-500"
          >
            ···
          </button>
        </div>

        {/* Input - always visible */}
        <div className="relative mb-3.5">
          <input
            ref={shopInputRef}
            value={shopInput}
            onChange={(e) => shopInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') shopAddItem(shopInput);
            }}
            placeholder={
              activeStore === 'all'
                ? t('addPlaceholder')
                : t('addToPlaceholder', { store: shopStores.find((s) => s.id === activeStore)?.name })
            }
            className="box-border w-full rounded-xl border border-amber-500/30 bg-white/90 py-3.5 pr-12.5 pl-4 text-lg font-medium text-slate-800 outline-none dark:bg-slate-800/80 dark:text-slate-200"
          />
          {shopInput && (
            <button
              aria-label={ta('add')}
              onClick={() => shopAddItem(shopInput)}
              className="absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border-none bg-linear-135 from-amber-500 to-amber-600 text-lg text-white"
            >
              +
            </button>
          )}
          {shopSugg.length > 0 && shopInput && (
            <motion.div
              {...POPOVER_POP}
              className={cx(POPOVER, 'absolute inset-x-0 top-[calc(100%+4px)] z-10 origin-top')}
            >
              {shopSugg.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={() => shopAddItem(s)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-none bg-transparent px-3.5 py-3 text-left text-base font-medium text-slate-800 dark:text-slate-200"
                >
                  <span className="text-amber-500">+</span> {s}
                </button>
              ))}
            </motion.div>
          )}
        </div>

        {/* Count + "Bought" button */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-400 dark:text-slate-500">
            {t('toBuy', { count: uncheckedCount })}
            {checkedCount > 0 ? ` · ${checkedCount} ✓` : ''}
          </span>
          {checkedCount > 0 && (
            <button
              onClick={shopClearChecked}
              className="cursor-pointer rounded-lg border border-green-500/20 bg-green-500/10 px-3.5 py-1.5 text-sm font-bold text-green-500"
            >
              {t('boughtBtn')}
            </button>
          )}
        </div>

        {/* Items — always grouped by category */}
        <div className="flex flex-col gap-4">
          {shopByCategory.groups.map((group) => (
            <div key={group.key}>
              <div className="mb-1.5 pl-0.5 text-xs font-bold tracking-[1px] text-slate-300 uppercase dark:text-slate-600">
                {t('sections.' + group.key)}
              </div>
              <ShopGroup
                items={group.items}
                shopStores={shopStores}
                onPersist={persistGroupOrder}
                rowProps={rowProps}
              />
            </div>
          ))}
          {shopByCategory.checked.length > 0 && (
            <div>
              <div className="mb-1.5 pl-0.5 text-xs font-bold tracking-[1px] text-slate-300 uppercase dark:text-slate-600">
                {t('boughtSection')}
              </div>
              <div className="relative flex flex-col gap-1">
                <AnimatePresence initial={false} mode="popLayout">
                  {shopByCategory.checked.map((item) => (
                    <ShopItemRow
                      key={item.id}
                      item={item}
                      store={shopStores.find((s) => s.id === item.store)}
                      {...rowProps}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {shopItems.length === 0 && <EmptyState icon="🛒">{t('empty')}</EmptyState>}
      </PageBody>

      {/* Shopping item detail modal */}
      {shopDetail && (
        <Modal
          onClose={() => {
            setShopDetail(null);
            setEditingId(null);
          }}
        >
          <div className="mb-5 text-center">
            <div className="mb-2 text-5xl">🛒</div>
            {editingId === shopDetail.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={async () => {
                  if (editingName.trim() && editingName !== shopDetail.name) {
                    await dbShopUpdate(shopDetail.id, { name: editingName.trim() });
                    setShopDetail((d) => ({ ...d, name: editingName.trim() }));
                  }
                  setEditingId(null);
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    if (editingName.trim() && editingName !== shopDetail.name) {
                      await dbShopUpdate(shopDetail.id, { name: editingName.trim() });
                      setShopDetail((d) => ({ ...d, name: editingName.trim() }));
                    }
                    setEditingId(null);
                  }
                  if (e.key === 'Escape') setEditingId(null);
                }}
                className="w-full border-0 border-b-2 border-amber-500 bg-transparent py-1 text-center text-2xl font-extrabold text-slate-800 outline-none dark:text-slate-200"
              />
            ) : (
              <h2
                onClick={() => {
                  setEditingId(shopDetail.id);
                  setEditingName(shopDetail.name);
                }}
                className="mb-1 cursor-pointer text-2xl font-extrabold"
              >
                {shopDetail.name} <span className="text-sm text-slate-300 dark:text-slate-600">✎</span>
              </h2>
            )}
            {shopDetail.favourite && <span className="text-sm font-semibold text-amber-500">{t('favourite')}</span>}
          </div>

          <Label>{tc('quantity')}</Label>
          <Input
            value={shopDetail.qty}
            onChange={(e) => {
              const q = e.target.value;
              setShopDetail((d) => ({ ...d, qty: q }));
              dbShopUpdate(shopDetail.id, { qty: q });
            }}
            placeholder={t('qtyPlaceholder')}
            className="mb-2"
          />
          <div className="mb-5 flex flex-wrap gap-1.5">
            {['1×', '2×', '3×', '100g', '250g', '500g', '1kg', '1L'].map((q) => (
              <button
                key={q}
                onClick={() => {
                  setShopDetail((d) => ({ ...d, qty: q }));
                  dbShopUpdate(shopDetail.id, { qty: q });
                }}
                className={cx(
                  'cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold',
                  shopDetail.qty === q
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-500'
                    : 'border-indigo-500/20 bg-white/70 text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/50 dark:text-slate-400',
                )}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Store picker */}
          <Label>{t('store')}</Label>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {shopStores.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setShopDetail((d) => ({ ...d, store: s.id }));
                  dbShopUpdate(shopDetail.id, { store: s.id });
                }}
                className={cx(
                  'cursor-pointer rounded-xl border px-3.5 py-2.25 text-sm font-bold',
                  shopDetail.store === s.id
                    ? 'border-amber-500/50 bg-amber-500/12 text-amber-500'
                    : 'border-indigo-500/20 bg-white/70 text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/50 dark:text-slate-400',
                )}
              >
                {s.icon} {s.name}
              </button>
            ))}
          </div>

          <div className="mb-2 flex gap-2">
            <button
              onClick={async () => {
                await shopToggleFav(shopDetail.id);
                setShopDetail((d) => ({ ...d, favourite: !d.favourite }));
              }}
              className={cx(
                'flex-1 cursor-pointer rounded-xl border p-3.25 text-sm font-bold',
                shopDetail.favourite
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
                  : 'border-indigo-500/20 bg-white/80 text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/60 dark:text-slate-400',
              )}
            >
              {shopDetail.favourite ? t('favourite') : t('favouriteOff')}
            </button>
          </div>

          <button
            onClick={async () => {
              await dbShopDelete(shopDetail.id);
              setShopDetail(null);
            }}
            className="w-full cursor-pointer rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm font-semibold text-red-500 opacity-80"
          >
            {t('removeFromList')}
          </button>
        </Modal>
      )}

      {/* Manage stores modal */}
      {showManageStores && (
        <Modal
          onClose={() => {
            setShowManageStores(false);
            setShowAddStoreForm(false);
            setEditingStore(null);
            setNewStore({ name: '', icon: '🔵' });
          }}
        >
          <h3 className="mb-4 text-center text-lg font-extrabold">{t('stores')}</h3>

          {/* All stores — select, edit or delete */}
          {shopStores.map((s) => {
            const cnt = shopItems.filter((i) => i.store === s.id && !i.checked).length;
            const isEditing = editingStore?.id === s.id;
            return (
              <div key={s.id} className="mb-2">
                {isEditing ? (
                  <div className="rounded-xl border border-indigo-500/20 bg-white/70 px-3.5 py-3 dark:border-slate-600/30 dark:bg-slate-800/50">
                    <div className="mb-2.5 grid grid-cols-4 gap-2">
                      {STORE_ICONS.map((ic) => (
                        <button
                          key={ic}
                          onClick={() => setEditingStore((e) => ({ ...e, icon: ic }))}
                          className={cx(
                            'flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 text-2xl',
                            editingStore.icon === ic
                              ? 'border-amber-500 bg-amber-500/12'
                              : 'border-indigo-500/20 bg-white/70 dark:border-slate-600/30 dark:bg-slate-800/50',
                          )}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                    <Input
                      autoFocus
                      value={editingStore.name}
                      onChange={(e) => setEditingStore((es) => ({ ...es, name: e.target.value }))}
                      className="mb-2.5"
                    />
                    <div className="flex gap-2">
                      <Btn
                        onClick={async () => {
                          await dbUpdateStore(editingStore.id, { name: editingStore.name, icon: editingStore.icon });
                          setEditingStore(null);
                        }}
                        disabled={!editingStore.name}
                      >
                        {tc('save')}
                      </Btn>
                      <Btn v="ghost" onClick={() => setEditingStore(null)}>
                        {tc('cancel')}
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setActiveStore(s.id);
                        setLastStore(s.id);
                        setShowManageStores(false);
                        setShowAddStoreForm(false);
                      }}
                      className={cx(
                        'flex flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left',
                        activeStore === s.id
                          ? 'border-amber-500/40 bg-amber-500/12'
                          : 'border-indigo-500/20 bg-white/70 dark:border-slate-600/30 dark:bg-slate-800/50',
                      )}
                    >
                      <span className="text-xl">{s.icon}</span>
                      <span
                        className={cx(
                          'text-sm font-bold',
                          activeStore === s.id ? 'text-amber-500' : 'text-slate-800 dark:text-slate-200',
                        )}
                      >
                        {s.name}
                      </span>
                      {cnt > 0 && <span className="ml-auto text-xs text-slate-400 dark:text-slate-500">{cnt}</span>}
                    </button>
                    <button
                      aria-label={ta('edit')}
                      onClick={() => {
                        setEditingStore({ id: s.id, name: s.name, icon: s.icon });
                        setShowAddStoreForm(false);
                      }}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-indigo-500/20 bg-white/70 text-base text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/50 dark:text-slate-400"
                    >
                      ✏️
                    </button>
                    <button
                      aria-label={ta('delete')}
                      onClick={() =>
                        setConfirmAction({
                          message: t('deleteStoreConfirm', { name: s.name }),
                          onConfirm: async () => {
                            await dbDeleteStore(s.id);
                            if (activeStore === s.id) setActiveStore('all');
                          },
                        })
                      }
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-red-500/20 bg-red-500/6 text-base text-red-500"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new store — collapsed by default */}
          <div className="mt-3 border-t border-indigo-500/15 pt-3 dark:border-slate-600/20">
            {!showAddStoreForm ? (
              <button
                onClick={() => setShowAddStoreForm(true)}
                className="w-full cursor-pointer rounded-xl border border-dashed border-indigo-500/20 bg-transparent p-3 text-sm font-semibold text-slate-400 dark:border-slate-600/30 dark:text-slate-500"
              >
                {t('newStoreBtn')}
              </button>
            ) : (
              <div>
                <Label>{t('newStore')}</Label>
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {STORE_ICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setNewStore((s) => ({ ...s, icon: ic }))}
                      className={cx(
                        'flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 text-2xl',
                        newStore.icon === ic
                          ? 'border-amber-500 bg-amber-500/12'
                          : 'border-indigo-500/20 bg-white/70 dark:border-slate-600/30 dark:bg-slate-800/50',
                      )}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
                <Input
                  autoFocus
                  value={newStore.name}
                  onChange={(e) => setNewStore((s) => ({ ...s, name: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newStore.name) addNewStore();
                  }}
                  placeholder={t('storePlaceholder')}
                  className="mb-2.5"
                />
                <div className="flex gap-2">
                  <Btn onClick={addNewStore} disabled={!newStore.name}>
                    {tc('add')}
                  </Btn>
                  <Btn
                    v="ghost"
                    onClick={() => {
                      setShowAddStoreForm(false);
                      setNewStore({ name: '', icon: '🔵' });
                    }}
                  >
                    {tc('cancel')}
                  </Btn>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </Screen>
  );
}
