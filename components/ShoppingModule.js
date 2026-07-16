'use client';
import { useState, useRef, useMemo } from 'react';
import { SHOP_SUGG } from '@/lib/constants';
import { F2, INP } from '@/lib/styles';
import { Btn, Modal, ConfirmModal, LogoToggle } from './ui';

export default function ShoppingModule({
  isDark, st,
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
      <div style={st.A}><div style={st.F1} /><div style={st.F2} />
        <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12, marginBottom: 20 }}>
            <button onClick={() => setShowShopArchive(false)} style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.3)", borderRadius: 12, padding: "10px 16px", color: "#94A3B8", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>← Nazaj</button>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>🧾 Zgodovina nakupov</h2>
          </div>
          {shopArchive.length === 0 && <div style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div><p>Še ni opravljenih nakupov</p></div>}
          {Object.entries(byDate).map(([date, ditems]) => (
            <div key={date} style={{ marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8", margin: "0 0 8px" }}>{date}</h3>
              {ditems.map((it, i) => {
                const store = shopStores.find(s => s.id === it.store);
                return (
                  <div key={it.id + "-" + i} style={{ padding: "8px 12px", background: "rgba(30,41,59,0.4)", borderRadius: 10, marginBottom: 3, fontSize: 14, color: "#CBD5E1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{it.name}{it.qty ? " · " + it.qty : ""}</span>
                    {store && <span style={{ fontSize: 11, color: "#475569" }}>{store.icon} {store.name}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
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
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: item.checked ? "rgba(30,41,59,0.2)" : "rgba(30,41,59,0.5)", border: "1px solid " + (item.checked ? "rgba(71,85,105,0.08)" : "rgba(71,85,105,0.2)"), borderRadius: 14, opacity: item.checked ? 0.5 : 1, transition: "all 0.2s", touchAction: "pan-y" }}
      >
        {!item.checked && <span style={{ fontSize: 14, color: "#334155", cursor: "grab", flexShrink: 0, userSelect: "none" }}>⠿</span>}
        <button onClick={(e) => { e.stopPropagation(); shopToggle(item.id); }} style={{ width: 28, height: 28, borderRadius: 8, border: "2px solid " + (item.checked ? "#22C55E" : "rgba(71,85,105,0.4)"), background: item.checked ? "#22C55E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, fontSize: 14, color: "#fff", transition: "all 0.15s" }}>
          {item.checked && "✓"}
        </button>
        <div onClick={() => setShopDetail(item)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: item.checked ? "#475569" : "#E2E8F0", textDecoration: item.checked ? "line-through" : "none" }}>{item.name}</span>
          {item.qty && <span style={{ fontSize: 13, color: item.checked ? "#374151" : "#64748B", marginLeft: 8 }}>{item.qty}</span>}
        </div>
        {activeStore === "all" && store && <span style={{ fontSize: 12, flexShrink: 0 }}>{store.icon}</span>}
      </div>
    );
  };

  return (
    <div style={st.A}><div style={st.F1} /><div style={{ ...F2, background: "radial-gradient(circle,rgba(245,158,11,0.06) 0%,transparent 70%)" }} />
      <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 12, marginBottom: 14 }}>
          <LogoToggle mode="shopping" onToggle={onToggleMode} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => setShowShopArchive(true)} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>🧾</button>
            <button onClick={onOpenSettings} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>⚙️</button>
          </div>
        </div>

        {/* Store tabs — scrollable row + pinned ··· button */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none", paddingRight: 44 }}>
            <button onClick={() => setActiveStore("all")} style={{
              padding: "8px 14px", borderRadius: 14, border: "1px solid", flexShrink: 0,
              borderColor: activeStore === "all" ? "rgba(245,158,11,0.4)" : "rgba(71,85,105,0.25)",
              background: activeStore === "all" ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.4)",
              color: activeStore === "all" ? "#F59E0B" : "#64748B", fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}>Vse ({shopItems.filter(i => !i.checked).length})</button>
            {shopStores.map(s => {
              const cnt = shopItems.filter(i => i.store === s.id && !i.checked).length;
              return (
                <button key={s.id} onClick={() => { setActiveStore(s.id); setLastStore(s.id); }} style={{
                  padding: "8px 14px", borderRadius: 14, border: "1px solid", flexShrink: 0,
                  borderColor: activeStore === s.id ? "rgba(245,158,11,0.4)" : "rgba(71,85,105,0.25)",
                  background: activeStore === s.id ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.4)",
                  color: activeStore === s.id ? "#F59E0B" : "#64748B", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>{s.icon} {s.name} ({cnt})</button>
              );
            })}
          </div>
          <button onClick={() => setShowManageStores(true)} style={{
            position: "absolute", right: 0, top: 0, bottom: 0,
            width: 38, borderRadius: 12, border: "1px solid rgba(71,85,105,0.3)",
            background: "linear-gradient(to left, rgba(11,17,32,1) 60%, rgba(11,17,32,0))",
            color: "#64748B", fontSize: 15, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 4,
          }}>···</button>
        </div>

        {/* Input - always visible */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <input
            ref={shopInputRef}
            value={shopInput}
            onChange={e => shopInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") shopAddItem(shopInput); }}
            placeholder={"Dodaj" + (activeStore !== "all" ? " v " + shopStores.find(s => s.id === activeStore)?.name : "") + "..."}
            style={{ ...INP, paddingRight: 50, border: "1px solid rgba(245,158,11,0.3)", fontSize: 17 }}
          />
          {shopInput && (
            <button onClick={() => shopAddItem(shopInput)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: 10, border: "none", background: "linear-gradient(135deg,#F59E0B,#D97706)", color: "#fff", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
          )}
          {shopSugg.length > 0 && shopInput && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#1E293B", border: "1px solid rgba(71,85,105,0.4)", borderRadius: 14, padding: 4, zIndex: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
              {shopSugg.map((s, i) => (
                <button key={i} onMouseDown={() => shopAddItem(s)} style={{ width: "100%", padding: "12px 14px", border: "none", borderRadius: 10, background: "transparent", color: "#E2E8F0", fontSize: 15, cursor: "pointer", textAlign: "left", fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#F59E0B" }}>+</span> {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Count + "Bought" button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#64748B" }}>{uncheckedCount} za kupiti{checkedCount > 0 ? ` · ${checkedCount} ✓` : ""}</span>
          {checkedCount > 0 && (
            <button onClick={shopClearChecked} style={{ fontSize: 13, color: "#22C55E", fontWeight: 700, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "6px 14px", cursor: "pointer" }}>🛒 Kupljeno</button>
          )}
        </div>

        {/* Items — always grouped by category */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {shopByCategory.groups.map(group => (
            <div key={group.label}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, paddingLeft: 2, textTransform: "uppercase", letterSpacing: 1 }}>{group.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {group.items.map(item => <ShopItemRow key={item.id} item={item} allItems={group.items} />)}
              </div>
            </div>
          ))}
          {shopByCategory.checked.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, paddingLeft: 2, textTransform: "uppercase", letterSpacing: 1 }}>✓ Kupljeno</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {shopByCategory.checked.map(item => <ShopItemRow key={item.id} item={item} allItems={shopByCategory.checked} />)}
              </div>
            </div>
          )}
        </div>

        {shopItems.length === 0 && <div style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}><div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div><p>Seznam je prazen — dodaj prvi izdelek!</p></div>}
      </div>

      {/* Shopping item detail modal */}
      {shopDetail && (
        <Modal isDark={isDark} onClose={() => { setShopDetail(null); setEditingId(null); }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🛒</div>
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
                style={{ fontSize: 22, fontWeight: 800, color: "#E2E8F0", background: "transparent", border: "none", borderBottom: "2px solid #F59E0B", outline: "none", textAlign: "center", width: "100%", padding: "4px 0" }}
              />
            ) : (
              <h2 onClick={() => { setEditingId(shopDetail.id); setEditingName(shopDetail.name); }} style={{ fontSize: 22, fontWeight: 800, margin: "0 0 4px", cursor: "pointer" }}>
                {shopDetail.name} <span style={{ fontSize: 14, color: "#475569" }}>✎</span>
              </h2>
            )}
            {shopDetail.favourite && <span style={{ fontSize: 13, color: "#F59E0B", fontWeight: 600 }}>⭐ Priljubljen</span>}
          </div>

          <label style={st.LBL}>Količina</label>
          <input
            value={shopDetail.qty}
            onChange={e => {
              const q = e.target.value;
              setShopDetail(d => ({ ...d, qty: q }));
              dbShopUpdate(shopDetail.id, { qty: q });
            }}
            placeholder="npr. 1kg, 3×, 500ml..."
            style={{ ...INP, marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {["1×", "2×", "3×", "100g", "250g", "500g", "1kg", "1L"].map(q => (
              <button key={q} onClick={() => {
                setShopDetail(d => ({ ...d, qty: q }));
                dbShopUpdate(shopDetail.id, { qty: q });
              }} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid " + (shopDetail.qty === q ? "rgba(245,158,11,0.5)" : "rgba(71,85,105,0.3)"), background: shopDetail.qty === q ? "rgba(245,158,11,0.15)" : "rgba(30,41,59,0.5)", color: shopDetail.qty === q ? "#F59E0B" : "#94A3B8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{q}</button>
            ))}
          </div>

          {/* Store picker */}
          <label style={st.LBL}>Trgovina</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {shopStores.map(s => (
              <button key={s.id} onClick={() => {
                setShopDetail(d => ({ ...d, store: s.id }));
                dbShopUpdate(shopDetail.id, { store: s.id });
              }} style={{
                padding: "9px 14px", borderRadius: 12, border: "1px solid " + (shopDetail.store === s.id ? "rgba(245,158,11,0.5)" : "rgba(71,85,105,0.3)"),
                background: shopDetail.store === s.id ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.5)",
                color: shopDetail.store === s.id ? "#F59E0B" : "#94A3B8", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>{s.icon} {s.name}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={async () => {
              await shopToggleFav(shopDetail.id);
              setShopDetail(d => ({ ...d, favourite: !d.favourite }));
            }} style={{ flex: 1, padding: "13px", borderRadius: 14, border: "1px solid " + (shopDetail.favourite ? "rgba(245,158,11,0.4)" : "rgba(71,85,105,0.3)"), background: shopDetail.favourite ? "rgba(245,158,11,0.1)" : "rgba(30,41,59,0.6)", color: shopDetail.favourite ? "#F59E0B" : "#94A3B8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              {shopDetail.favourite ? "⭐ Priljubljen" : "☆ Priljubljen"}
            </button>
          </div>

          <button onClick={async () => {
            await dbShopDelete(shopDetail.id);
            setShopDetail(null);
          }} style={{ width: "100%", padding: "12px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", color: "#EF4444", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: 0.8 }}>🗑 Odstrani s seznama</button>
        </Modal>
      )}

      {/* Manage stores modal */}
      {showManageStores && (
        <Modal isDark={isDark} onClose={() => { setShowManageStores(false); setShowAddStoreForm(false); setEditingStore(null); setNewStore({ name: "", icon: "🔵" }); }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 16px", textAlign: "center" }}>Trgovine</h3>

          {/* All stores — select, edit or delete */}
          {shopStores.map(s => {
            const cnt = shopItems.filter(i => i.store === s.id && !i.checked).length;
            const isEditing = editingStore?.id === s.id;
            return (
              <div key={s.id} style={{ marginBottom: 8 }}>
                {isEditing ? (
                  <div style={{ background: "rgba(30,41,59,0.5)", border: "1px solid rgba(71,85,105,0.25)", borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
                      {["🟢", "🟣", "🔵", "🟠", "🔴", "🟡", "⚫", "🏪"].map(ic => (
                        <button key={ic} onClick={() => setEditingStore(e => ({ ...e, icon: ic }))} style={{ aspectRatio: "1", borderRadius: 10, fontSize: 22, border: "2px solid " + (editingStore.icon === ic ? "#F59E0B" : "rgba(71,85,105,0.3)"), background: editingStore.icon === ic ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{ic}</button>
                      ))}
                    </div>
                    <input autoFocus value={editingStore.name} onChange={e => setEditingStore(es => ({ ...es, name: e.target.value }))} style={{ ...INP, marginBottom: 10 }} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn onClick={async () => { await dbUpdateStore(editingStore.id, { name: editingStore.name, icon: editingStore.icon }); setEditingStore(null); }} disabled={!editingStore.name}>Shrani</Btn>
                      <Btn v="ghost" onClick={() => setEditingStore(null)}>Prekliči</Btn>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => { setActiveStore(s.id); setLastStore(s.id); setShowManageStores(false); setShowAddStoreForm(false); }} style={{
                      flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                      background: activeStore === s.id ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.5)",
                      border: "1px solid " + (activeStore === s.id ? "rgba(245,158,11,0.4)" : "rgba(71,85,105,0.25)"),
                      borderRadius: 14, cursor: "pointer", textAlign: "left",
                    }}>
                      <span style={{ fontSize: 20 }}>{s.icon}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: activeStore === s.id ? "#F59E0B" : "#E2E8F0" }}>{s.name}</span>
                      {cnt > 0 && <span style={{ fontSize: 12, color: "#64748B", marginLeft: "auto" }}>{cnt}</span>}
                    </button>
                    <button onClick={() => { setEditingStore({ id: s.id, name: s.name, icon: s.icon }); setShowAddStoreForm(false); }} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(71,85,105,0.25)", background: "rgba(30,41,59,0.5)", color: "#94A3B8", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✏️</button>
                    <button onClick={() => setConfirmAction({
                      message: `Izbriši trgovino ${s.name}?`,
                      onConfirm: async () => { await dbDeleteStore(s.id); if (activeStore === s.id) setActiveStore("all"); },
                    })} style={{ width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#EF4444", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🗑</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new store — collapsed by default */}
          <div style={{ borderTop: "1px solid rgba(71,85,105,0.2)", marginTop: 12, paddingTop: 12 }}>
            {!showAddStoreForm ? (
              <button onClick={() => setShowAddStoreForm(true)} style={{ width: "100%", padding: "12px", borderRadius: 14, border: "1px dashed rgba(71,85,105,0.4)", background: "transparent", color: "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>+ Nova trgovina</button>
            ) : (
              <div>
                <label style={st.LBL}>Nova trgovina</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                  {["🟢", "🟣", "🔵", "🟠", "🔴", "🟡", "⚫", "🏪"].map(ic => (
                    <button key={ic} onClick={() => setNewStore(s => ({ ...s, icon: ic }))} style={{ aspectRatio: "1", borderRadius: 10, fontSize: 22, border: "2px solid " + (newStore.icon === ic ? "#F59E0B" : "rgba(71,85,105,0.3)"), background: newStore.icon === ic ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>{ic}</button>
                  ))}
                </div>
                <input autoFocus value={newStore.name} onChange={e => setNewStore(s => ({ ...s, name: e.target.value }))} onKeyDown={e => { if (e.key === "Enter" && newStore.name) addNewStore(); }} placeholder="npr. Hofer, Spar..." style={{ ...INP, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={addNewStore} disabled={!newStore.name}>Dodaj</Btn>
                  <Btn v="ghost" onClick={() => { setShowAddStoreForm(false); setNewStore({ name: "", icon: "🔵" }); }}>Prekliči</Btn>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} isDark={isDark} />
    </div>
  );
}
