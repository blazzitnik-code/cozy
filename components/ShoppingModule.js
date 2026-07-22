'use client';
import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import {
  Check,
  ChevronDown,
  Clock,
  GripVertical,
  History,
  Pencil,
  Plus,
  Repeat,
  Search,
  Settings,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { SHOP_SUGG } from '@/lib/constants';
import { cx, localDateStr } from '@/lib/utils';
import { analyzeShoppingSuggestions, analyzeShoppingHistory } from '@/lib/shopping';
import {
  Screen,
  PageBody,
  Btn,
  Card,
  Modal,
  ConfirmModal,
  ModuleHeader,
  Input,
  Label,
  IconButton,
  EmptyState,
  SectionHeader,
  BackBtn,
  CHIP_ON,
  CHIP_OFF,
  POPOVER,
  POPOVER_POP,
  POP,
  LIST_ROW,
  CHIP_IN,
  COLLAPSE,
  PRESS,
  PRESS_SM,
  ROW_PRESS,
  ScrollChips,
} from './ui';

const STORE_ICONS = ['🟢', '🟣', '🔵', '🟠', '🔴', '🟡', '⚫', '🏪'];

const SEARCH_INP =
  'w-full box-border h-12 pr-9.5 pl-9.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-none font-medium text-base transition-colors focus:border-orange-500';

// Store selector dropdown (single-select) — mirrors the freezer's FreezerDD so
// both modules pick their "category" the same way. Footer opens the manage
// modal (add / edit / delete). `count(id)` returns the unchecked-item count.
function StoreDD({ stores, activeStore, allCount, count, onSelect, onManage }) {
  const t = useTranslations('Shopping');
  const tc = useTranslations('Common');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const active = activeStore === 'all' ? null : stores.find((s) => s.id === activeStore);
  const lbl = active ? `${active.icon} ${active.name}` : tc('all');
  const row = (on) =>
    cx(
      'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left text-sm font-semibold',
      ROW_PRESS,
      on
        ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
        : 'bg-transparent text-stone-500 dark:text-stone-400',
    );
  const badge = (n) => <span className="ml-auto text-xs font-normal text-stone-400 dark:text-stone-500">{n}</span>;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cx(
          'flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold text-stone-900 dark:text-stone-100',
          PRESS_SM,
          open
            ? 'border-stone-900 bg-white dark:border-stone-100 dark:bg-stone-900'
            : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900',
        )}
      >
        <span>{lbl}</span>
        <ChevronDown
          className={cx(
            'size-3.5 text-stone-400 transition-transform duration-200 dark:text-stone-500',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <motion.div
          {...POPOVER_POP}
          className={cx(
            POPOVER,
            'absolute top-[calc(100%+6px)] right-0 z-60 min-w-55 origin-top-right rounded-2xl p-1.5',
          )}
        >
          <button
            onClick={() => {
              onSelect('all');
              setOpen(false);
            }}
            className={row(activeStore === 'all')}
          >
            {tc('all')} {badge(allCount)}
          </button>
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onSelect(s.id);
                setOpen(false);
              }}
              className={row(activeStore === s.id)}
            >
              <span className="text-base">{s.icon}</span> {s.name} {badge(count(s.id))}
            </button>
          ))}
          <div className="mt-1.5 border-t border-stone-200 pt-1.5 dark:border-white/10">
            <button
              onClick={() => {
                onManage();
                setOpen(false);
              }}
              className={cx(
                'flex w-full items-center gap-2 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-stone-500 dark:text-stone-400',
                ROW_PRESS,
              )}
            >
              <Pencil className="size-4" /> {t('manageBtn')}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Store selector for the add-input: picks which store new items go to,
// independent of the store the list is filtered to. The pill shows just the
// store icon to stay compact; the dropdown lists icon + name.
function AddStoreDD({ stores, value, onSelect }) {
  const ta = useTranslations('A11y');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const active = stores.find((s) => s.id === value);
  const row = (on) =>
    cx(
      'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left text-sm font-semibold',
      ROW_PRESS,
      on
        ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
        : 'bg-transparent text-stone-500 dark:text-stone-400',
    );
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        aria-label={ta('store')}
        className={cx(
          'flex h-12 cursor-pointer items-center gap-1 rounded-xl border px-3 text-base',
          PRESS_SM,
          open
            ? 'border-stone-900 bg-white dark:border-stone-100 dark:bg-stone-900'
            : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900',
        )}
      >
        <span>{active?.icon ?? '🛒'}</span>
        <ChevronDown
          className={cx(
            'size-3.5 text-stone-400 transition-transform duration-200 dark:text-stone-500',
            open && 'rotate-180',
          )}
        />
      </button>
      {open && (
        <motion.div
          {...POPOVER_POP}
          className={cx(
            POPOVER,
            'absolute top-[calc(100%+6px)] left-0 z-60 max-h-80 min-w-52 origin-top-left overflow-y-auto rounded-2xl p-1.5',
          )}
        >
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onSelect(s.id);
                setOpen(false);
              }}
              className={row(value === s.id)}
            >
              <span className="text-base">{s.icon}</span> {s.name}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// Module scope on purpose: defined inside ShoppingModule its identity would
// change every render, remounting all rows (and killing their transitions).
// `ref` reaches the DOM node — required by AnimatePresence mode="popLayout".
// Reorderable rows render as Reorder.Item (inside a group's Reorder.Group,
// dragged by the ⠿ handle only); bought-section rows stay plain motion.div.
// memo'd: parent passes stable handlers so untouched rows skip re-render on toggle.
const ShopItemRow = memo(function ShopItemRow({
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
  // Flat list row: opaque page-colored bg (rows overlap while drag-reordering)
  // + dotted hairline divider.
  const rowClass = cx(
    // transition-colors ONLY — a transition covering transform/opacity would
    // re-ease Motion's per-frame drag/layout writes and make dragging lag.
    // The checked dim animates through Motion's `animate` below for the same
    // reason (a CSS opacity class would fight LIST_ROW's inline opacity).
    'relative flex touch-pan-y items-center gap-2.5 border-b border-dotted border-stone-300 bg-stone-100 px-0.5 py-3 transition-colors duration-200 last:border-b-0 dark:border-stone-700 dark:bg-stone-950',
  );
  const rowAnimate = { ...LIST_ROW.animate, opacity: item.checked ? 0.5 : 1 };
  const inner = (
    <>
      {reorderable && (
        <span
          onPointerDown={(e) => {
            e.preventDefault();
            dragControls.start(e);
          }}
          className="-m-2 shrink-0 cursor-grab touch-none p-2 text-stone-400 select-none active:cursor-grabbing dark:text-stone-600"
        >
          <GripVertical className="size-4" />
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(item);
        }}
        className={cx(
          'flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 text-sm text-white transition-colors duration-150',
          PRESS_SM,
          item.checked ? 'border-green-600 bg-green-600' : 'border-stone-300 bg-transparent dark:border-stone-700',
        )}
      >
        {item.checked && <motion.span {...POP}>✓</motion.span>}
      </button>
      <div onClick={() => onOpenDetail(item)} className="min-w-0 flex-1 cursor-pointer">
        <span
          className={cx(
            'text-base font-semibold',
            item.checked ? 'text-stone-400 line-through dark:text-stone-600' : 'text-stone-900 dark:text-stone-100',
          )}
        >
          {item.name}
        </span>
        {item.favourite && (
          <Star aria-hidden="true" className="ml-1 inline size-3 fill-current text-orange-600 dark:text-orange-400" />
        )}
        {item.qty && (
          <span
            className={cx(
              'ml-2 text-sm',
              item.checked ? 'text-stone-400 dark:text-stone-600' : 'text-stone-400 dark:text-stone-500',
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
      <motion.div ref={ref} {...LIST_ROW} animate={rowAnimate} className={rowClass}>
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
      animate={rowAnimate}
      exit={LIST_ROW.exit}
      transition={LIST_ROW.transition}
      className={rowClass}
    >
      {inner}
    </Reorder.Item>
  );
});

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
  // Stable so memo'd ShopItemRows skip re-render when a sibling toggles.
  const onRowDragStart = useCallback(() => (dragging.current = true), []);
  const onRowDragEnd = useCallback(() => {
    dragging.current = false;
    pending.current = true;
    onPersist(orderRef.current);
  }, [onPersist]);
  return (
    <Reorder.Group as="div" axis="y" values={order} onReorder={adopt} className="relative flex flex-col">
      <AnimatePresence initial={false} mode="popLayout">
        {order.map((item) => (
          <ShopItemRow
            key={item.id}
            item={item}
            reorderable
            store={shopStores.find((s) => s.id === item.store)}
            onRowDragStart={onRowDragStart}
            onRowDragEnd={onRowDragEnd}
            {...rowProps}
          />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}

export default function ShoppingModule({
  shopItems,
  shopLoading,
  shopArchiveLoading,
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
  onGoHome,
  onOpenSettings,
}) {
  const t = useTranslations('Shopping');
  const tc = useTranslations('Common');
  const ta = useTranslations('A11y');
  const tMod = useTranslations('Modules');
  const format = useFormatter();
  const locale = useLocale();
  const shopSuggList = SHOP_SUGG[locale] ?? SHOP_SUGG.sl;

  // ─── SHOPPING UI STATE ───
  const [activeStore, setActiveStore] = useState('all');
  const [addStore, setAddStore] = useState('mercator'); // which store new items go to (set by the add-input pill)
  const [shopInput, setShopInput] = useState('');
  const [shopSugg, setShopSugg] = useState([]);
  const [showShopArchive, setShowShopArchive] = useState(false);
  const [archSearch, setArchSearch] = useState('');
  const [reAddItem, setReAddItem] = useState(null); // archived row to re-add to the list
  const [shopDetail, setShopDetail] = useState(null);
  const [showManageStores, setShowManageStores] = useState(false);
  const [showAddStoreForm, setShowAddStoreForm] = useState(false);
  const [newStore, setNewStore] = useState({ name: '', icon: '🔵' });
  const [addingStore, setAddingStore] = useState(false);
  const [editingStore, setEditingStore] = useState(null); // { id, name, icon }
  const shopInputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }
  const [suggOpen, setSuggOpen] = useState(true); // smart-suggestions section (persisted)
  const [addedSugg, setAddedSugg] = useState(() => new Set()); // suggestion chips tapped this session
  const [checkout, setCheckout] = useState(null); // { items } — open checkout modal on "bought"
  const [checkoutStore, setCheckoutStore] = useState('');
  const [checkoutAmount, setCheckoutAmount] = useState('');
  useEffect(() => {
    const v = localStorage.getItem('cozy_shop_sugg_open');
    if (v != null) setSuggOpen(v === '1');
  }, []);
  const toggleSugg = () =>
    setSuggOpen((o) => {
      localStorage.setItem('cozy_shop_sugg_open', o ? '0' : '1');
      return !o;
    });

  // Smart suggestions derived from the purchase archive (frequent + likely-due).
  const suggestions = useMemo(() => analyzeShoppingSuggestions(shopArchive), [shopArchive]);
  const hasSugg = suggestions.due.length > 0 || suggestions.frequent.length > 0;

  // Quick-quantity chip (item detail modal) — rendered per group (counts | measures).
  const QTY_COUNTS = ['1×', '2×', '3×'];
  const QTY_MEASURES = ['100g', '250g', '500g', '1kg', '1L'];
  const qtyChip = (q) => (
    <button
      key={q}
      onClick={() => {
        setShopDetail((d) => ({ ...d, qty: q }));
        dbShopUpdate(shopDetail.id, { qty: q });
      }}
      className={cx(
        'shrink-0 cursor-pointer rounded-full border px-3 py-2 text-sm font-semibold whitespace-nowrap',
        PRESS_SM,
        shopDetail?.qty === q ? CHIP_ON : CHIP_OFF,
      )}
    >
      {q}
    </button>
  );

  // Suggestion chip — tap adds to the list (via shopAddItem) and marks itself
  // done for this session (the source archive doesn't change, so track locally).
  const suggChip = (name, sub, key) => {
    const added = addedSugg.has(name);
    return (
      <button
        key={key}
        disabled={added}
        onClick={() => {
          shopAddItem(name);
          setAddedSugg((p) => new Set(p).add(name));
        }}
        className={cx(
          'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold',
          PRESS_SM,
          added ? 'border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400' : CHIP_OFF,
        )}
      >
        {added ? <Check className="size-3.5" /> : <Plus className="size-3.5 text-orange-600 dark:text-orange-400" />}
        <span>{name}</span>
        {sub && !added && <span className="text-xs font-normal text-stone-400 dark:text-stone-500">{sub}</span>}
      </button>
    );
  };

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
    const targetStore = addStore;
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

  // "Buy again" from history — re-add an archived item to the active list.
  async function reAddToList(a) {
    const maxOrder = shopItems.length > 0 ? Math.max(...shopItems.map((i) => i.sort_order ?? 0)) : 0;
    await dbShopAdd({
      name: a.name,
      qty: a.qty || '',
      checked: false,
      store: a.store,
      favourite: false,
      category: '',
      sort_order: maxOrder + 1,
    });
  }

  // Receives the row's item (not just id) so it stays stable across shopItems
  // changes — otherwise every toggle would re-render all memo'd rows.
  const shopToggle = useCallback((item) => dbShopUpdate(item.id, { checked: !item.checked }), [dbShopUpdate]);

  function shopToggleFav(id) {
    const item = shopItems.find((i) => i.id === id);
    if (item) {
      dbShopUpdate(id, { favourite: !item.favourite });
      dbShopToggleFav(item.name);
    }
  }

  function closeShopDetail() {
    // Flush a qty still pending from typing (persisted on blur, but closing
    // the sheet via backdrop/drag can skip the blur).
    if (shopDetail) {
      const orig = shopItems.find((i) => i.id === shopDetail.id);
      if (orig && (orig.qty ?? '') !== (shopDetail.qty ?? '')) dbShopUpdate(shopDetail.id, { qty: shopDetail.qty });
    }
    setShopDetail(null);
    setEditingId(null);
  }

  // "Bought" opens the checkout modal instead of archiving straight away, so the
  // user can optionally note the store + amount for this purchase.
  function shopClearChecked() {
    const targetItems = activeStore === 'all' ? shopItems : shopItems.filter((i) => i.store === activeStore);
    const checked = targetItems.filter((i) => i.checked);
    if (checked.length === 0) return;
    setCheckoutStore('');
    setCheckoutAmount('');
    setCheckout({ items: checked });
  }

  // Accepts "17,60" or "17.60"; empty/invalid → null.
  const parseAmount = (s) => {
    const n = parseFloat(String(s).replace(',', '.'));
    return isNaN(n) ? null : n;
  };

  // Optimistic: close the sheet immediately, archive in the background.
  // save=true carries the store/amount; save=false (Skip) archives without them.
  function finalizeCheckout(save) {
    const items = checkout?.items || [];
    const meta = save ? { storeNote: checkoutStore, amount: parseAmount(checkoutAmount) } : {};
    setCheckout(null);
    if (items.length > 0) dbShopArchiveChecked(items, meta);
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
    if (!newStore.name || addingStore) return; // guard rapid double-submit
    setAddingStore(true);
    try {
      await dbAddStore(newStore);
      setNewStore({ name: '', icon: '🔵' });
    } finally {
      setAddingStore(false);
    }
  }

  const checkedCount = (activeStore === 'all' ? shopItems : shopItems.filter((i) => i.store === activeStore)).filter(
    (i) => i.checked,
  ).length;
  const uncheckedCount = (activeStore === 'all' ? shopItems : shopItems.filter((i) => i.store === activeStore)).filter(
    (i) => !i.checked,
  ).length;

  // Persist a group's new order after a drag: reassign the group's own
  // sort_order values (sorted asc) to the new sequence — global cross-group
  // ordering and other groups stay untouched. Must stay ABOVE the archive
  // early return — as a hook it has to run on every render (React error 300).
  const persistGroupOrder = useCallback(
    async (ordered) => {
      let slots = ordered.map((i) => i.sort_order ?? 0).sort((a, b) => a - b);
      // Duplicate/null sort_orders make the reassignment ambiguous and the
      // global sort unstable — reindex the segment sequentially from its
      // lowest slot instead (stays in the same range vs. other groups).
      if (new Set(slots).size !== slots.length) {
        slots = ordered.map((_, idx) => slots[0] + idx);
      }
      await Promise.all(
        ordered
          .map((item, idx) =>
            (item.sort_order ?? 0) !== slots[idx] ? dbShopUpdate(item.id, { sort_order: slots[idx] }) : null,
          )
          .filter(Boolean),
      );
    },
    [dbShopUpdate],
  );

  // ─── ANALYSIS VIEW (replaces the old purchase history) ───
  if (showShopArchive) {
    const q = archSearch.trim().toLowerCase();
    const analysis = analyzeShoppingHistory(shopArchive);
    const storeName = (id) => shopStores.find((s) => s.id === id);
    const eur = (v) => format.number(v, 'eur');
    // Group purchases by calendar day — each day is a separator that lists all
    // its items inline. Same-day checkouts merge (stores joined, amounts summed).
    const byDate = {};
    for (const g of analysis.groups) {
      if (!g.date || isNaN(g.date.getTime())) continue;
      const key = localDateStr(g.date);
      if (!byDate[key]) byDate[key] = { key, date: g.date, items: [], amount: 0, hasAmount: false, stores: [] };
      const b = byDate[key];
      for (const it of g.items) b.items.push(it);
      if (g.amount != null) {
        b.amount += g.amount;
        b.hasAmount = true;
      }
      if (g.store && !b.stores.includes(g.store)) b.stores.push(g.store);
    }
    let dateGroups = Object.values(byDate).sort((a, b) => b.date - a.date);
    if (q) {
      dateGroups = dateGroups
        .map((d) => ({ ...d, items: d.items.filter((it) => it.name.toLowerCase().includes(q)) }))
        .filter((d) => d.items.length > 0);
    }
    const maxStore = analysis.storeList.length ? analysis.storeList[0].amount : 0;

    return (
      <Screen>
        {/* RE-ADD (buy again) modal */}
        <Modal open={!!reAddItem} onClose={() => setReAddItem(null)}>
          {reAddItem && (
            <>
              <h3 className="mb-1 font-serif text-xl font-semibold tracking-tight">{reAddItem.name}</h3>
              <p className="mb-5 text-sm text-stone-500 dark:text-stone-400">
                {reAddItem.qty ? reAddItem.qty + ' · ' : ''}
                {storeName(reAddItem.store)?.icon} {storeName(reAddItem.store)?.name}
              </p>
              <Btn
                onClick={async () => {
                  await reAddToList(reAddItem);
                  setReAddItem(null);
                }}
              >
                {t('reAdd')}
              </Btn>
            </>
          )}
        </Modal>

        <PageBody key="shop-archive">
          <div className="mb-4 flex items-center gap-3 pt-3">
            <BackBtn onClick={() => setShowShopArchive(false)} />
            <h2 className="font-serif text-2xl font-semibold tracking-tight">{t('analysisTitle')}</h2>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400 dark:text-stone-600" />
            <input
              value={archSearch}
              onChange={(e) => setArchSearch(e.target.value)}
              placeholder={t('searchHistory')}
              className={SEARCH_INP}
            />
            {archSearch && (
              <motion.button
                {...POP}
                aria-label={ta('clearSearch')}
                onClick={() => setArchSearch('')}
                className={cx(
                  'absolute top-1/2 right-3 -translate-y-1/2 border-none bg-transparent text-stone-400 dark:text-stone-500',
                  PRESS_SM,
                )}
              >
                <X className="size-4" />
              </motion.button>
            )}
          </div>

          {analysis.groups.length === 0 && (
            <EmptyState icon="🧾">{shopArchiveLoading ? '' : t('historyEmpty')}</EmptyState>
          )}

          {/* Summary — hidden while searching to focus results */}
          {!q && analysis.groups.length > 0 && (
            <>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <Card className="rounded-xl px-3.5 py-3">
                  <div className="text-[10px] font-semibold tracking-[1px] text-stone-400 uppercase dark:text-stone-500">
                    {t('thisMonth')}
                  </div>
                  <div className="mt-0.5 text-2xl font-extrabold text-stone-900 dark:text-stone-100">
                    {analysis.hasAmounts ? format.number(analysis.monthTotal, 'eurWhole') : '—'}
                  </div>
                </Card>
                <Card className="rounded-xl px-3.5 py-3">
                  <div className="text-[10px] font-semibold tracking-[1px] text-stone-400 uppercase dark:text-stone-500">
                    {t('purchases')}
                  </div>
                  <div className="mt-0.5 text-2xl font-extrabold text-stone-900 dark:text-stone-100">
                    {analysis.monthCount}
                  </div>
                </Card>
              </div>
              {analysis.monthCount > 0 && (
                <p className="mb-4 px-0.5 text-xs text-stone-400 dark:text-stone-500">
                  {t('avgLine', {
                    amount: analysis.hasAmounts ? eur(analysis.avgBasket) : '—',
                    n: analysis.avgItems,
                  })}
                </p>
              )}

              {analysis.storeList.length > 0 && (
                <div className="mb-4">
                  <SectionHeader>{t('byStore')}</SectionHeader>
                  {analysis.storeList.map(({ store, amount }) => (
                    <div key={store || 'other'} className="mb-2">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                          {store || t('other')}
                        </span>
                        <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{eur(amount)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-xs bg-stone-200 dark:bg-stone-800">
                        <div
                          className="h-full rounded-xs bg-stone-400 dark:bg-stone-500"
                          style={{ width: (maxStore ? (amount / maxStore) * 100 : 0) + '%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {analysis.topItems.length > 0 && (
                <div className="mb-4">
                  <SectionHeader>{t('mostBought')}</SectionHeader>
                  {analysis.topItems.map(({ name, count }) => (
                    <div
                      key={name}
                      className="flex items-center justify-between border-b border-dotted border-stone-200 py-1.75 last:border-b-0 dark:border-stone-800"
                    >
                      <span className="min-w-0 truncate text-sm text-stone-900 dark:text-stone-100">{name}</span>
                      <span className="shrink-0 pl-2 text-xs font-semibold text-stone-400 dark:text-stone-500">
                        {t('timesBought', { count })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Purchases grouped by date — each day is a separator, items inline */}
          {dateGroups.length > 0 && (
            <div>
              <SectionHeader>{t('purchaseList')}</SectionHeader>
              {dateGroups.map((d) => (
                <div key={d.key} className="mb-4">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 rounded-lg bg-stone-200/70 px-3 py-1.5 dark:bg-stone-800/50">
                    <h3 className="min-w-0 truncate text-sm font-bold text-stone-700 capitalize dark:text-stone-200">
                      {format.dateTime(d.date, 'fullDate')}
                    </h3>
                    <div className="flex shrink-0 items-baseline gap-2">
                      {d.stores.length > 0 && (
                        <span className="text-xs text-stone-500 dark:text-stone-400">{d.stores.join(', ')}</span>
                      )}
                      {d.hasAmount && (
                        <span className="text-sm font-bold text-stone-900 dark:text-stone-100">{eur(d.amount)}</span>
                      )}
                    </div>
                  </div>
                  {d.items.map((it, i) => {
                    const store = storeName(it.store);
                    return (
                      <div
                        key={it.id + '-' + i}
                        onClick={() => setReAddItem(it)}
                        className={cx(
                          'flex items-center gap-2.5 border-b border-dotted border-stone-300 px-0.5 py-2.25 last:border-b-0 dark:border-stone-700',
                          ROW_PRESS,
                        )}
                      >
                        <div className="min-w-0 flex-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {it.name}
                          {it.qty && <span className="ml-2 text-xs text-stone-400 dark:text-stone-500">{it.qty}</span>}
                        </div>
                        {store && (
                          <span className="shrink-0 text-xs text-stone-400 dark:text-stone-600">{store.icon}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </PageBody>
      </Screen>
    );
  }

  // Shared props for the module-scope ShopItemRow.
  const rowProps = {
    activeStore,
    onToggle: shopToggle,
    onOpenDetail: setShopDetail,
  };

  return (
    <Screen>
      <PageBody key="shop-home">
        {/* Header */}
        <ModuleHeader title={tMod('shopping')} emoji="🛒" onHome={onGoHome}>
          <StoreDD
            stores={shopStores}
            activeStore={activeStore}
            allCount={shopItems.filter((i) => !i.checked).length}
            count={(id) => shopItems.filter((i) => i.store === id && !i.checked).length}
            onSelect={(id) => {
              setActiveStore(id);
              if (id !== 'all') setAddStore(id);
            }}
            onManage={() => setShowManageStores(true)}
          />
          <IconButton onClick={() => setShowShopArchive(true)} aria-label={ta('history')}>
            <History className="size-4.5" />
          </IconButton>
          <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
            <Settings className="size-4.5" />
          </IconButton>
        </ModuleHeader>

        {/* Input - always visible */}
        <div className="mb-3.5 flex items-start gap-2">
          <AddStoreDD stores={shopStores} value={addStore} onSelect={setAddStore} />
          <div className="relative flex-1">
            <Input
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
              className="pr-12.5"
            />
            {shopInput && (
              <motion.button
                {...POP}
                aria-label={ta('add')}
                onClick={() => shopAddItem(shopInput)}
                className={cx(
                  'absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border-none bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900',
                  PRESS_SM,
                )}
              >
                <Plus className="size-5" />
              </motion.button>
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
                    className={cx(
                      'flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-3.5 py-3 text-left text-base font-medium text-stone-900 dark:text-stone-100',
                      ROW_PRESS,
                    )}
                  >
                    <span className="font-semibold text-orange-600 dark:text-orange-400">+</span> {s}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* Smart suggestions — collapsible, derived from purchase archive */}
        {hasSugg && (
          <div className="mb-3">
            <button
              onClick={toggleSugg}
              className={cx('mb-2 flex items-center gap-1.5 border-none bg-transparent px-0.5', PRESS_SM)}
            >
              <span className="text-xs font-bold tracking-[1px] text-stone-400 uppercase dark:text-stone-600">
                {t('suggestions')}
              </span>
              <ChevronDown
                className={cx(
                  'size-3.5 text-stone-400 transition-transform duration-200 dark:text-stone-500',
                  suggOpen && 'rotate-180',
                )}
              />
            </button>
            <AnimatePresence initial={false}>
              {suggOpen && (
                <motion.div {...COLLAPSE} className="overflow-hidden">
                  {suggestions.due.length > 0 && (
                    <div className="mb-2">
                      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                        <Clock className="size-3" /> {t('mightNeed')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.due.map((s) =>
                          suggChip(s.name, t('daysAgoShort', { n: s.daysSince }), 'due-' + s.name),
                        )}
                      </div>
                    </div>
                  )}
                  {suggestions.frequent.length > 0 && (
                    <div className="mb-1">
                      <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                        <Repeat className="size-3" /> {t('buyOften')}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.frequent.map((s) => suggChip(s.name, null, 'freq-' + s.name))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Count + "Bought" button */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-stone-400 dark:text-stone-500">
            {t('toBuy', { count: uncheckedCount })}
            {checkedCount > 0 ? ` · ${checkedCount} ✓` : ''}
          </span>
          {checkedCount > 0 && (
            <motion.button
              {...CHIP_IN}
              onClick={shopClearChecked}
              className={cx(
                'rounded-full border-none bg-green-600 px-3.5 py-1.5 text-sm font-bold text-white',
                PRESS_SM,
              )}
            >
              {t('boughtBtn')}
            </motion.button>
          )}
        </div>

        {/* Items — always grouped by category */}
        <div className="flex flex-col gap-4">
          {shopByCategory.groups.map((group) => (
            <div key={group.key}>
              <div className="mb-1.5 pl-0.5 text-xs font-bold tracking-[1px] text-stone-400 uppercase dark:text-stone-600">
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
              <div className="mb-1.5 pl-0.5 text-xs font-bold tracking-[1px] text-stone-400 uppercase dark:text-stone-600">
                {t('boughtSection')}
              </div>
              <div className="relative flex flex-col">
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

        {!shopLoading && shopItems.length === 0 && <EmptyState icon="🛒">{t('empty')}</EmptyState>}
      </PageBody>

      {/* Shopping item detail modal */}
      <Modal open={!!shopDetail} onClose={closeShopDetail}>
        {shopDetail && (
          <>
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
                  className="w-full border-0 border-b-2 border-orange-500 bg-transparent py-1 text-center font-serif text-2xl font-semibold text-stone-900 outline-none dark:text-stone-100"
                />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <h2
                    onClick={() => {
                      setEditingId(shopDetail.id);
                      setEditingName(shopDetail.name);
                    }}
                    className="min-w-0 cursor-pointer font-serif text-3xl font-semibold tracking-tight"
                  >
                    {shopDetail.name}{' '}
                    <Pencil className="inline size-4 align-baseline text-stone-400 dark:text-stone-600" />
                  </h2>
                  <button
                    aria-pressed={shopDetail.favourite}
                    aria-label={ta('favourite')}
                    onClick={() => {
                      shopToggleFav(shopDetail.id);
                      setShopDetail((d) => ({ ...d, favourite: !d.favourite }));
                    }}
                    className={cx(
                      '-m-2 shrink-0 cursor-pointer rounded-full p-2',
                      PRESS_SM,
                      shopDetail.favourite
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-stone-400 dark:text-stone-500',
                    )}
                  >
                    <Star className={cx('size-5', shopDetail.favourite && 'fill-current')} />
                  </button>
                </div>
              )}
            </div>

            <Label>{tc('quantity')}</Label>
            <Input
              value={shopDetail.qty}
              onChange={(e) => setShopDetail((d) => ({ ...d, qty: e.target.value }))}
              onBlur={() => {
                const orig = shopItems.find((i) => i.id === shopDetail.id);
                if (orig && (orig.qty ?? '') !== (shopDetail.qty ?? '')) {
                  dbShopUpdate(shopDetail.id, { qty: shopDetail.qty });
                }
              }}
              placeholder={t('qtyPlaceholder')}
              className="mb-2"
            />
            {/* Quick quantities: counts | divider | measures in one scrollable row */}
            <ScrollChips className="mb-5">
              {QTY_COUNTS.map(qtyChip)}
              <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-stone-300 dark:bg-stone-700" />
              {QTY_MEASURES.map(qtyChip)}
            </ScrollChips>

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
                    'cursor-pointer rounded-full border px-3.5 py-2.25 text-sm font-bold',
                    PRESS_SM,
                    shopDetail.store === s.id ? CHIP_ON : CHIP_OFF,
                  )}
                >
                  {s.icon} {s.name}
                </button>
              ))}
            </div>

            <Btn
              v="danger"
              onClick={async () => {
                await dbShopDelete(shopDetail.id);
                closeShopDetail();
              }}
              className="mb-2 flex items-center justify-center gap-1.5 font-semibold"
            >
              <Trash2 className="size-4.5" />
              {t('removeFromList')}
            </Btn>

            <Btn onClick={closeShopDetail}>{tc('done')}</Btn>
          </>
        )}
      </Modal>

      {/* Manage stores modal */}
      <Modal
        open={showManageStores}
        onClose={() => {
          setShowManageStores(false);
          setShowAddStoreForm(false);
          setEditingStore(null);
          setNewStore({ name: '', icon: '🔵' });
        }}
      >
        <h3 className="mb-4 text-center font-serif text-xl font-semibold tracking-tight">{t('stores')}</h3>

        {/* All stores — select, edit or delete */}
        {shopStores.map((s) => {
          const cnt = shopItems.filter((i) => i.store === s.id && !i.checked).length;
          const isEditing = editingStore?.id === s.id;
          return (
            <div key={s.id} className="mb-2">
              {isEditing ? (
                <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 dark:border-white/10 dark:bg-stone-950/60">
                  <div className="mb-2.5 grid grid-cols-4 gap-2">
                    {STORE_ICONS.map((ic) => (
                      <button
                        key={ic}
                        onClick={() => setEditingStore((e) => ({ ...e, icon: ic }))}
                        className={cx(
                          'flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 text-2xl',
                          PRESS_SM,
                          editingStore.icon === ic
                            ? 'border-stone-900 bg-stone-100 dark:border-stone-100 dark:bg-stone-800'
                            : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900',
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
                      setAddStore(s.id);
                      setShowManageStores(false);
                      setShowAddStoreForm(false);
                    }}
                    className={cx(
                      'flex h-12 flex-1 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 text-left',
                      PRESS_SM,
                      activeStore === s.id
                        ? 'border-stone-900 bg-stone-50 dark:border-stone-100 dark:bg-stone-800'
                        : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900',
                    )}
                  >
                    <span className="text-xl">{s.icon}</span>
                    <span
                      className={cx(
                        'text-sm font-bold',
                        activeStore === s.id
                          ? 'text-stone-900 dark:text-stone-100'
                          : 'text-stone-700 dark:text-stone-300',
                      )}
                    >
                      {s.name}
                    </span>
                    {cnt > 0 && <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">{cnt}</span>}
                  </button>
                  <button
                    aria-label={ta('edit')}
                    onClick={() => {
                      setEditingStore({ id: s.id, name: s.name, icon: s.icon });
                      setShowAddStoreForm(false);
                    }}
                    className={cx(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
                      PRESS_SM,
                    )}
                  >
                    <Pencil className="size-4" />
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
                    className={cx(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-none bg-red-500/10 text-red-600 dark:text-red-400',
                      PRESS_SM,
                    )}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add new store — collapsed by default */}
        <div className="mt-3 border-t border-stone-200 pt-3 dark:border-white/10">
          {!showAddStoreForm ? (
            <button
              onClick={() => setShowAddStoreForm(true)}
              className={cx(
                'w-full rounded-xl border border-dashed border-stone-300 bg-transparent p-3 text-sm font-semibold text-stone-500 dark:border-stone-700 dark:text-stone-400',
                PRESS,
              )}
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
                      PRESS_SM,
                      newStore.icon === ic
                        ? 'border-stone-900 bg-stone-100 dark:border-stone-100 dark:bg-stone-800'
                        : 'border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900',
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
                <Btn onClick={addNewStore} disabled={!newStore.name || addingStore}>
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

      {/* Checkout modal — optional store + amount for this purchase */}
      <Modal open={!!checkout} onClose={() => setCheckout(null)}>
        {checkout && (
          <>
            <div className="mb-5 text-center">
              <div className="mb-2 text-5xl">🛒</div>
              <h3 className="mb-1 font-serif text-xl font-semibold tracking-tight">{t('purchaseDone')}</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {t('itemsBought', { n: checkout.items.length })}
              </p>
            </div>

            <Label>{t('storeOptional')}</Label>
            <Input
              autoFocus
              value={checkoutStore}
              onChange={(e) => setCheckoutStore(e.target.value)}
              placeholder={t('storeNotePlaceholder')}
              className="mb-4"
            />

            <Label>{t('amountOptional')}</Label>
            <div className="relative mb-5">
              <Input
                inputMode="decimal"
                value={checkoutAmount}
                onChange={(e) => setCheckoutAmount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finalizeCheckout(true);
                }}
                placeholder="0,00"
                className="pr-9"
              />
              <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-base font-semibold text-stone-400 dark:text-stone-500">
                €
              </span>
            </div>

            <Btn v="success" onClick={() => finalizeCheckout(true)} className="mb-2">
              {tc('save')}
            </Btn>
            <Btn v="ghost" onClick={() => finalizeCheckout(false)}>
              {t('skip')}
            </Btn>
          </>
        )}
      </Modal>

      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
    </Screen>
  );
}
