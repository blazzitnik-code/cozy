'use client';
import { useState, useRef, useMemo } from 'react';
import { SHOP_SUGG } from '@/lib/constants';
import { cx } from '@/lib/utils';
import { Screen, Btn, Modal, ConfirmModal, LogoToggle, Input, Label, IconButton, EmptyState } from './ui';

const STORE_ICONS = ["🟢", "🟣", "🔵", "🟠", "🔴", "🟡", "⚫", "🏪"];

// Amber-accent selectable chips (store tabs, quantity/store pickers)
const CHIP_ON = "border-amber-500/40 bg-amber-500/12 text-amber-500";
const CHIP_OFF = "border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500";

export default function ShoppingModule({
  shopItems, dbShopAdd, dbShopUpdate, dbShopDelete,
  shopArchive, dbShopArchiveChecked,
  shopFavourites, dbShopToggleFav,
  shopStores, dbAddStore, dbUpdateStore, dbDeleteStore,
  onToggleMode, onOpenSettings,
}) {
  // ─── SHOPPING UI STATE ───
  const [activeStore, setActiveStore] = useState("all");
  const [lastStore, setLastStore] = useState("mercator");
  const [shopInput, setShopInput] = useState("");
  const [shopSugg, setShopSugg] = useState([]);
  const [showShopArchive, setShowShopArchive] = useState(false);
  const [shopDetail, setShopDetail] = useState(null);
  const [showManageStores, setShowManageStores] = useState(false);
  const [showAddStoreForm, setShowAddStoreForm] = useState(false);
  const [newStore, setNewStore] = useState({ name: "", icon: "🔵" });
  const [editingStore, setEditingStore] = useState(null); // { id, name, icon }
  const shopInputRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const dragItem = useRef(null);
  const dragOver = useRef(null);
  const touchDrag = useRef({ item: null, startY: 0 });
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  // All known shopping names for autocomplete
  const shopKnown = useMemo(() => {
    const favNames = shopFavourites.map(f => f.name);
    const all = [...new Set([...favNames, ...SHOP_SUGG, ...shopArchive.map(a => a.name)])];
    return all;
  }, [shopFavourites, shopArchive]);

  // ─── SHOPPING LOGIC ───
  const shopVisible = activeStore === "all" ? shopItems : shopItems.filter(i => i.store === activeStore);

  // ─── SMART CATEGORIZATION ───
  const detectCategory = (name) => {
    const n = name.toLowerCase();
    if (/zamrz|led|sladoled|ice/.test(n)) return { key: "zamrznjeno", label: "🧊 Zamrznjeno", order: 1 };
    if (/mleko|jogurt|sir|smetana|skuta|maslo|jajc/.test(n)) return { key: "mlecni", label: "🥛 Mlečni izdelki", order: 2 };
    if (/piščan|govej|svinjsk|mlet|šunka|salama|riba|losos|puran|meso/.test(n)) return { key: "meso", label: "🥩 Meso & ribe", order: 3 };
    if (/jabolko|hruška|banana|jagod|pomaranč|limona|grozdje|sadje|avokado|borovnic/.test(n)) return { key: "sadje", label: "🍎 Sadje", order: 4 };
    if (/zelenjav|solata|paradižnik|kumara|paprika|čebula|česen|krompir|brokoli|korenje|grah|špinač/.test(n)) return { key: "zelenjava", label: "🥬 Zelenjava", order: 5 };
    if (/kruh|žemlja|burek|pica|torta|kolač|pecivo|rogljič/.test(n)) return { key: "pekarna", label: "🍞 Pekarna", order: 6 };
    if (/riž|testenin|moka|sladkor|sol|olje|kis|začimb|poper|kava|čaj|konzerv/.test(n)) return { key: "suho", label: "🥫 Suho blago", order: 7 };
    if (/pivo|vino|sok|voda|pijač/.test(n)) return { key: "pijace", label: "🥤 Pijače", order: 8 };
    if (/pes|mačk|pasja|mačja|hrana za/.test(n)) return { key: "zivali", label: "🐾 Za živali", order: 9 };
    if (/pralni|detergent|gobic|toaletni|wc|šampon|gel|milo|zobna|krema|dezodor/.test(n)) return { key: "cistila", label: "🧴 Čistila & nega", order: 10 };
    return { key: "drugo", label: "🛒 Ostalo", order: 99 };
  };

  const sortedShop = useMemo(() => {
    const unchecked = shopVisible.filter(i => !i.checked);
    const checked = shopVisible.filter(i => i.checked);
    // Sort by sort_order when present, otherwise by created_at
    const sortFn = (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999);
    return [...unchecked.sort(sortFn), ...checked];
  }, [shopVisible]);

  // Group by category for the single-store view
  const shopByCategory = useMemo(() => {
    const unchecked = sortedShop.filter(i => !i.checked);
    const checked = sortedShop.filter(i => i.checked);
    const groups = {};
    unchecked.forEach(item => {
      const cat = detectCategory(item.name);
      if (!groups[cat.key]) groups[cat.key] = { label: cat.label, order: cat.order, items: [] };
      groups[cat.key].items.push(item);
    });
    return { groups: Object.values(groups).sort((a, b) => a.order - b.order), checked };
  }, [sortedShop]);

  async function shopAddItem(name) {
    if (!name.trim()) return;
    const targetStore = activeStore === "all" ? lastStore : activeStore;
    const existing = shopItems.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.checked && i.store === targetStore);
    if (existing) return;
    const maxOrder = shopItems.length > 0 ? Math.max(...shopItems.map(i => i.sort_order ?? 0)) : 0;
    await dbShopAdd({ name: name.trim(), qty: "", checked: false, store: targetStore, favourite: false, category: "", sort_order: maxOrder + 1 });
    setShopInput("");
    setShopSugg([]);
  }

  function shopToggle(id) {
    const item = shopItems.find(i => i.id === id);
    if (item) dbShopUpdate(id, { checked: !item.checked });
  }

  function shopToggleFav(id) {
    const item = shopItems.find(i => i.id === id);
    if (item) {
      dbShopUpdate(id, { favourite: !item.favourite });
      dbShopToggleFav(item.name);
    }
  }

  async function shopClearChecked() {
    const targetItems = activeStore === "all" ? shopItems : shopItems.filter(i => i.store === activeStore);
    const checked = targetItems.filter(i => i.checked);
    if (checked.length > 0) await dbShopArchiveChecked(checked);
  }

  function shopInputChange(val) {
    setShopInput(val);
    if (val.length >= 1) {
      const matches = shopKnown.filter(s => s.toLowerCase().includes(val.toLowerCase())).slice(0, 6);
      setShopSugg(matches);
    } else {
      setShopSugg([]);
    }
  }

  async function addNewStore() {
    if (!newStore.name) return;
    await dbAddStore(newStore);
    setNewStore({ name: "", icon: "🔵" });
  }

  const checkedCount = (activeStore === "all" ? shopItems : shopItems.filter(i => i.store === activeStore)).filter(i => i.checked).length;
  const uncheckedCount = (activeStore === "all" ? shopItems : shopItems.filter(i => i.store === activeStore)).filter(i => !i.checked).length;

  // ─── ARCHIVE VIEW ───
  if (showShopArchive) {
    const byDate = {};
    shopArchive.forEach(a => {
      const d = new Date(a.completed_at);
      const k = d.toLocaleDateString("sl-SI", { day: "numeric", month: "long", year: "numeric" });
      if (!byDate[k]) byDate[k] = [];
      byDate[k].push(a);
    });
    return (
      <Screen glow2="bg-radial from-amber-500/12 to-transparent to-70% dark:from-amber-500/6">
        <div className="relative z-1 pt-4 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 pt-3 mb-5">
            <button onClick={() => setShowShopArchive(false)} className="bg-white/90 dark:bg-slate-800/80 border border-indigo-500/20 dark:border-slate-600/30 rounded-xl py-2.5 px-4 text-slate-500 dark:text-slate-400 text-sm cursor-pointer font-semibold">← Nazaj</button>
            <h2 className="text-xl font-extrabold">🧾 Zgodovina nakupov</h2>
          </div>
          {shopArchive.length === 0 && <EmptyState icon="🧾">Še ni opravljenih nakupov</EmptyState>}
          {Object.entries(byDate).map(([date, ditems]) => (
            <div key={date} className="mb-4">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2">{date}</h3>
              {ditems.map((it, i) => {
                const store = shopStores.find(s => s.id === it.store);
                return (
                  <div key={it.id + "-" + i} className="py-2 px-3 bg-white/70 dark:bg-slate-800/50 rounded-lg mb-[3px] text-sm text-slate-800 dark:text-slate-200 flex justify-between items-center">
                    <span>{it.name}{it.qty ? " · " + it.qty : ""}</span>
                    {store && <span className="text-xs text-slate-300 dark:text-slate-600">{store.icon} {store.name}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Screen>
    );
  }

  // Render a single shop item row
  const handleDragStart = (e, item) => {
    dragItem.current = item;
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e, item) => {
    e.preventDefault();
    dragOver.current = item;
  };
  const handleDrop = async () => {
    if (!dragItem.current || !dragOver.current) return;
    if (dragItem.current.id === dragOver.current.id) return;
    const fromId = dragItem.current.id;
    const toId = dragOver.current.id;
    const fromOrder = dragItem.current.sort_order ?? 0;
    const toOrder = dragOver.current.sort_order ?? 0;
    dragItem.current = null;
    dragOver.current = null;
    await Promise.all([
      dbShopUpdate(fromId, { sort_order: toOrder }),
      dbShopUpdate(toId, { sort_order: fromOrder }),
    ]);
  };

  const handleTouchStart = (e, item) => {
    touchDrag.current.item = item;
    touchDrag.current.startY = e.touches[0].clientY;
  };
  const handleTouchEnd = async (e, allItems) => {
    const endY = e.changedTouches[0].clientY;
    const diffY = endY - touchDrag.current.startY;
    if (Math.abs(diffY) < 20) { touchDrag.current.item = null; return; }
    const from = touchDrag.current.item;
    if (!from) return;
    const sorted = [...allItems].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = sorted.findIndex(i => i.id === from.id);
    const newIdx = diffY < 0 ? Math.max(0, idx - 1) : Math.min(sorted.length - 1, idx + 1);
    if (newIdx === idx) { touchDrag.current.item = null; return; }
    const neighbor = sorted[newIdx];
    const fromOrder = from.sort_order ?? idx;
    const toOrder = neighbor.sort_order ?? newIdx;
    touchDrag.current.item = null;
    await Promise.all([
      dbShopUpdate(from.id, { sort_order: toOrder }),
      dbShopUpdate(neighbor.id, { sort_order: fromOrder }),
    ]);
  };

  const ShopItemRow = ({ item, allItems }) => {
    const store = shopStores.find(s => s.id === item.store);
    return (
      <div
        draggable={!item.checked}
        onDragStart={e => handleDragStart(e, item)}
        onDragOver={e => handleDragOver(e, item)}
        onDrop={handleDrop}
        onTouchStart={e => handleTouchStart(e, item)}
        onTouchEnd={e => handleTouchEnd(e, allItems || sortedShop)}
        className={cx("flex items-center gap-2.5 py-3 px-3.5 border rounded-xl transition-all duration-200 touch-pan-y",
          item.checked ? "bg-white/30 dark:bg-slate-800/20 border-indigo-500/6 dark:border-slate-600/8 opacity-50" : "bg-white/70 dark:bg-slate-800/50 border-indigo-500/15 dark:border-slate-600/20")}
      >
        {!item.checked && <span className="text-sm text-slate-300 dark:text-slate-600 cursor-grab shrink-0 select-none">⠿</span>}
        <button onClick={(e) => { e.stopPropagation(); shopToggle(item.id); }} className={cx("w-7 h-7 rounded-lg border-2 flex items-center justify-center cursor-pointer shrink-0 text-sm text-white transition-all duration-150", item.checked ? "border-green-500 bg-green-500" : "border-indigo-500/20 dark:border-slate-600/30 bg-transparent")}>
          {item.checked && "✓"}
        </button>
        <div onClick={() => setShopDetail(item)} className="flex-1 min-w-0 cursor-pointer">
          <span className={cx("text-base font-semibold", item.checked ? "text-slate-300 dark:text-slate-600 line-through" : "text-slate-800 dark:text-slate-200")}>{item.name}</span>
          {item.qty && <span className={cx("text-sm ml-2", item.checked ? "text-slate-300 dark:text-slate-600" : "text-slate-400 dark:text-slate-500")}>{item.qty}</span>}
        </div>
        {activeStore === "all" && store && <span className="text-xs shrink-0">{store.icon}</span>}
      </div>
    );
  };

  return (
    <Screen glow2="bg-radial from-amber-500/12 to-transparent to-70% dark:from-amber-500/6">
      <div className="relative z-1 pt-4 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">

        {/* Header */}
        <div className="flex justify-between items-start pt-3 mb-3.5">
          <LogoToggle mode="shopping" onToggle={onToggleMode} />
          <div className="flex gap-2 items-center">
            <IconButton onClick={() => setShowShopArchive(true)}>🧾</IconButton>
            <IconButton onClick={onOpenSettings}>⚙️</IconButton>
          </div>
        </div>

        {/* Store tabs — scrollable row + pinned ··· button */}
        <div className="relative mb-3.5">
          <div className="flex gap-1.5 overflow-x-auto pr-11 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-webkit-overflow-scrolling:touch]">
            <button onClick={() => setActiveStore("all")} className={cx("py-2 px-3.5 rounded-xl border shrink-0 text-sm font-bold cursor-pointer", activeStore === "all" ? CHIP_ON : CHIP_OFF)}>
              Vse ({shopItems.filter(i => !i.checked).length})
            </button>
            {shopStores.map(s => {
              const cnt = shopItems.filter(i => i.store === s.id && !i.checked).length;
              return (
                <button key={s.id} onClick={() => { setActiveStore(s.id); setLastStore(s.id); }} className={cx("py-2 px-3.5 rounded-xl border shrink-0 text-sm font-bold cursor-pointer", activeStore === s.id ? CHIP_ON : CHIP_OFF)}>
                  {s.icon} {s.name} ({cnt})
                </button>
              );
            })}
          </div>
          <button onClick={() => setShowManageStores(true)} className="absolute right-0 inset-y-0 w-9.5 rounded-xl border border-indigo-500/20 dark:border-slate-600/30 bg-linear-to-l from-indigo-50 from-60% to-transparent dark:from-slate-950 text-slate-400 dark:text-slate-500 text-base font-bold cursor-pointer flex items-center justify-end pr-1">···</button>
        </div>

        {/* Input - always visible */}
        <div className="relative mb-3.5">
          <input
            ref={shopInputRef}
            value={shopInput}
            onChange={e => shopInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") shopAddItem(shopInput); }}
            placeholder={"Dodaj" + (activeStore !== "all" ? " v " + shopStores.find(s => s.id === activeStore)?.name : "") + "..."}
            className="w-full box-border py-3.5 pl-4 pr-12.5 bg-white/90 dark:bg-slate-800/80 border border-amber-500/30 rounded-xl text-slate-800 dark:text-slate-200 outline-none font-medium text-lg"
          />
          {shopInput && (
            <button onClick={() => shopAddItem(shopInput)} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg border-none bg-linear-135 from-amber-500 to-amber-600 text-white text-lg cursor-pointer flex items-center justify-center">+</button>
          )}
          {shopSugg.length > 0 && shopInput && (
            <div className="absolute top-[calc(100%+4px)] inset-x-0 bg-white dark:bg-slate-800 border border-indigo-500/20 dark:border-slate-600/30 rounded-xl p-1 z-10 shadow-lg shadow-black/40">
              {shopSugg.map((s, i) => (
                <button key={i} onMouseDown={() => shopAddItem(s)} className="w-full py-3 px-3.5 border-none rounded-lg bg-transparent text-slate-800 dark:text-slate-200 text-base cursor-pointer text-left font-medium flex items-center gap-2">
                  <span className="text-amber-500">+</span> {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Count + "Bought" button */}
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm text-slate-400 dark:text-slate-500">{uncheckedCount} za kupiti{checkedCount > 0 ? ` · ${checkedCount} ✓` : ""}</span>
          {checkedCount > 0 && (
            <button onClick={shopClearChecked} className="text-sm text-green-500 font-bold bg-green-500/10 border border-green-500/20 rounded-lg py-1.5 px-3.5 cursor-pointer">🛒 Kupljeno</button>
          )}
        </div>

        {/* Items — always grouped by category */}
        <div className="flex flex-col gap-4">
          {shopByCategory.groups.map(group => (
            <div key={group.label}>
              <div className="text-xs font-bold text-slate-300 dark:text-slate-600 mb-1.5 pl-0.5 uppercase tracking-[1px]">{group.label}</div>
              <div className="flex flex-col gap-1">
                {group.items.map(item => <ShopItemRow key={item.id} item={item} allItems={group.items} />)}
              </div>
            </div>
          ))}
          {shopByCategory.checked.length > 0 && (
            <div>
              <div className="text-xs font-bold text-slate-300 dark:text-slate-600 mb-1.5 pl-0.5 uppercase tracking-[1px]">✓ Kupljeno</div>
              <div className="flex flex-col gap-1">
                {shopByCategory.checked.map(item => <ShopItemRow key={item.id} item={item} allItems={shopByCategory.checked} />)}
              </div>
            </div>
          )}
        </div>

        {shopItems.length === 0 && <EmptyState icon="🛒">Seznam je prazen — dodaj prvi izdelek!</EmptyState>}
      </div>

      {/* Shopping item detail modal */}
      {shopDetail && (
        <Modal onClose={() => { setShopDetail(null); setEditingId(null); }}>
          <div className="text-center mb-5">
            <div className="text-5xl mb-2">🛒</div>
            {editingId === shopDetail.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={async () => {
                  if (editingName.trim() && editingName !== shopDetail.name) {
                    await dbShopUpdate(shopDetail.id, { name: editingName.trim() });
                    setShopDetail(d => ({ ...d, name: editingName.trim() }));
                  }
                  setEditingId(null);
                }}
                onKeyDown={async e => {
                  if (e.key === "Enter") {
                    if (editingName.trim() && editingName !== shopDetail.name) {
                      await dbShopUpdate(shopDetail.id, { name: editingName.trim() });
                      setShopDetail(d => ({ ...d, name: editingName.trim() }));
                    }
                    setEditingId(null);
                  }
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="text-2xl font-extrabold text-slate-800 dark:text-slate-200 bg-transparent border-0 border-b-2 border-amber-500 outline-none text-center w-full py-1"
              />
            ) : (
              <h2 onClick={() => { setEditingId(shopDetail.id); setEditingName(shopDetail.name); }} className="text-2xl font-extrabold mb-1 cursor-pointer">
                {shopDetail.name} <span className="text-sm text-slate-300 dark:text-slate-600">✎</span>
              </h2>
            )}
            {shopDetail.favourite && <span className="text-sm text-amber-500 font-semibold">⭐ Priljubljen</span>}
          </div>

          <Label>Količina</Label>
          <Input
            value={shopDetail.qty}
            onChange={e => {
              const q = e.target.value;
              setShopDetail(d => ({ ...d, qty: q }));
              dbShopUpdate(shopDetail.id, { qty: q });
            }}
            placeholder="npr. 1kg, 3×, 500ml..."
            className="mb-2"
          />
          <div className="flex gap-1.5 flex-wrap mb-5">
            {["1×", "2×", "3×", "100g", "250g", "500g", "1kg", "1L"].map(q => (
              <button key={q} onClick={() => {
                setShopDetail(d => ({ ...d, qty: q }));
                dbShopUpdate(shopDetail.id, { qty: q });
              }} className={cx("py-2 px-3 rounded-xl border text-sm font-semibold cursor-pointer", shopDetail.qty === q ? "border-amber-500/50 bg-amber-500/15 text-amber-500" : "border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400")}>{q}</button>
            ))}
          </div>

          {/* Store picker */}
          <Label>Trgovina</Label>
          <div className="flex gap-1.5 flex-wrap mb-4">
            {shopStores.map(s => (
              <button key={s.id} onClick={() => {
                setShopDetail(d => ({ ...d, store: s.id }));
                dbShopUpdate(shopDetail.id, { store: s.id });
              }} className={cx("py-2.25 px-3.5 rounded-xl border text-sm font-bold cursor-pointer", shopDetail.store === s.id ? "border-amber-500/50 bg-amber-500/12 text-amber-500" : "border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400")}>
                {s.icon} {s.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2 mb-2">
            <button onClick={async () => {
              await shopToggleFav(shopDetail.id);
              setShopDetail(d => ({ ...d, favourite: !d.favourite }));
            }} className={cx("flex-1 p-3.25 rounded-xl border text-sm font-bold cursor-pointer", shopDetail.favourite ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-indigo-500/20 dark:border-slate-600/30 bg-white/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400")}>
              {shopDetail.favourite ? "⭐ Priljubljen" : "☆ Priljubljen"}
            </button>
          </div>

          <button onClick={async () => {
            await dbShopDelete(shopDetail.id);
            setShopDetail(null);
          }} className="w-full p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500 text-sm font-semibold cursor-pointer opacity-80">🗑 Odstrani s seznama</button>
        </Modal>
      )}

      {/* Manage stores modal */}
      {showManageStores && (
        <Modal onClose={() => { setShowManageStores(false); setShowAddStoreForm(false); setEditingStore(null); setNewStore({ name: "", icon: "🔵" }); }}>
          <h3 className="text-lg font-extrabold mb-4 text-center">Trgovine</h3>

          {/* All stores — select, edit or delete */}
          {shopStores.map(s => {
            const cnt = shopItems.filter(i => i.store === s.id && !i.checked).length;
            const isEditing = editingStore?.id === s.id;
            return (
              <div key={s.id} className="mb-2">
                {isEditing ? (
                  <div className="bg-white/70 dark:bg-slate-800/50 border border-indigo-500/20 dark:border-slate-600/30 rounded-xl py-3 px-3.5">
                    <div className="grid grid-cols-4 gap-2 mb-2.5">
                      {STORE_ICONS.map(ic => (
                        <button key={ic} onClick={() => setEditingStore(e => ({ ...e, icon: ic }))} className={cx("aspect-square rounded-lg text-2xl border-2 cursor-pointer flex items-center justify-center", editingStore.icon === ic ? "border-amber-500 bg-amber-500/12" : "border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50")}>{ic}</button>
                      ))}
                    </div>
                    <Input autoFocus value={editingStore.name} onChange={e => setEditingStore(es => ({ ...es, name: e.target.value }))} className="mb-2.5" />
                    <div className="flex gap-2">
                      <Btn onClick={async () => { await dbUpdateStore(editingStore.id, { name: editingStore.name, icon: editingStore.icon }); setEditingStore(null); }} disabled={!editingStore.name}>Shrani</Btn>
                      <Btn v="ghost" onClick={() => setEditingStore(null)}>Prekliči</Btn>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setActiveStore(s.id); setLastStore(s.id); setShowManageStores(false); setShowAddStoreForm(false); }} className={cx("flex-1 flex items-center gap-2.5 py-3 px-3.5 border rounded-xl cursor-pointer text-left", activeStore === s.id ? "bg-amber-500/12 border-amber-500/40" : "bg-white/70 dark:bg-slate-800/50 border-indigo-500/20 dark:border-slate-600/30")}>
                      <span className="text-xl">{s.icon}</span>
                      <span className={cx("text-sm font-bold", activeStore === s.id ? "text-amber-500" : "text-slate-800 dark:text-slate-200")}>{s.name}</span>
                      {cnt > 0 && <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{cnt}</span>}
                    </button>
                    <button onClick={() => { setEditingStore({ id: s.id, name: s.name, icon: s.icon }); setShowAddStoreForm(false); }} className="w-10 h-10 rounded-xl border border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-base cursor-pointer flex items-center justify-center shrink-0">✏️</button>
                    <button onClick={() => setConfirmAction({
                      message: `Izbriši trgovino ${s.name}?`,
                      onConfirm: async () => { await dbDeleteStore(s.id); if (activeStore === s.id) setActiveStore("all"); },
                    })} className="w-10 h-10 rounded-xl border border-red-500/20 bg-red-500/6 text-red-500 text-base cursor-pointer flex items-center justify-center shrink-0">🗑</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new store — collapsed by default */}
          <div className="border-t border-indigo-500/15 dark:border-slate-600/20 mt-3 pt-3">
            {!showAddStoreForm ? (
              <button onClick={() => setShowAddStoreForm(true)} className="w-full p-3 rounded-xl border border-dashed border-indigo-500/20 dark:border-slate-600/30 bg-transparent text-slate-400 dark:text-slate-500 text-sm font-semibold cursor-pointer">+ Nova trgovina</button>
            ) : (
              <div>
                <Label>Nova trgovina</Label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {STORE_ICONS.map(ic => (
                    <button key={ic} onClick={() => setNewStore(s => ({ ...s, icon: ic }))} className={cx("aspect-square rounded-lg text-2xl border-2 cursor-pointer flex items-center justify-center", newStore.icon === ic ? "border-amber-500 bg-amber-500/12" : "border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50")}>{ic}</button>
                  ))}
                </div>
                <Input autoFocus value={newStore.name} onChange={e => setNewStore(s => ({ ...s, name: e.target.value }))} onKeyDown={e => { if (e.key === "Enter" && newStore.name) addNewStore(); }} placeholder="npr. Hofer, Spar..." className="mb-2.5" />
                <div className="flex gap-2">
                  <Btn onClick={addNewStore} disabled={!newStore.name}>Dodaj</Btn>
                  <Btn v="ghost" onClick={() => { setShowAddStoreForm(false); setNewStore({ name: "", icon: "🔵" }); }}>Prekliči</Btn>
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
