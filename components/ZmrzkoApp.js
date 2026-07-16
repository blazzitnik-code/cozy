'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useItems, useArchived, useFreezers, useCategories, useShoppingItems, useShoppingArchived, useShoppingFavourites, useShoppingStores, useCalendarConnections, useCalendarEvents, useTodoLists, useTodoItems, normalizujNiz } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { CATS, SUGG, SHOP_SUGG, FICONS, QO } from '@/lib/constants';
import { getSt, fmtD, wksUntil, wksShort, stCol, stBg, detectEventType, fmtTime } from '@/lib/utils';
import { getStyles, A, F1, F2, INP, LBL } from '@/lib/styles';
import TodoApp from './TodoApp';
import HomeModule from './HomeModule';

// ─── SMALL COMPONENTS ───
function Pill({ active, color, onClick, children, small }) {
  return <button onClick={onClick} style={{ padding: small ? "6px 10px" : "8px 14px", borderRadius: 20, border: "1px solid", borderColor: active ? (color ? color + "80" : "rgba(56,189,248,0.5)") : "rgba(71,85,105,0.3)", background: active ? (color ? color + "20" : "rgba(56,189,248,0.15)") : "rgba(30,41,59,0.5)", color: active ? (color || "#38BDF8") : "#94A3B8", fontSize: small ? 12 : 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{children}</button>;
}

function FC({ label, value }) {
  return <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(71,85,105,0.2)" }}><div style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0" }}>{value}</div></div>;
}

function Btn({ onClick, children, v = "primary", disabled = false, style: s = {} }) {
  const map = { primary: { bg: "linear-gradient(135deg,#0EA5E9,#6366F1)", c: "#fff", b: "none" }, success: { bg: "linear-gradient(135deg,#22C55E,#059669)", c: "#fff", b: "none" }, danger: { bg: "rgba(239,68,68,0.12)", c: "#EF4444", b: "1px solid rgba(239,68,68,0.3)" }, ghost: { bg: "transparent", c: "#64748B", b: "1px solid rgba(71,85,105,0.3)" } };
  const st = map[v] || map.primary;
  return <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "15px", borderRadius: 14, border: st.b, background: st.bg, color: st.c, fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, ...s }}>{children}</button>;
}

function Modal({ children, onClose, isDark = true }) {
  const modalBg = isDark ? "linear-gradient(180deg,#1E293B,#0F172A)" : "linear-gradient(180deg,#FFFFFF,#F8FAFF)";
  const handleBg = isDark ? "#334155" : "#CBD5E1";
  const border = isDark ? "1px solid rgba(71,85,105,0.3)" : "1px solid rgba(99,102,241,0.15)";
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}><div onClick={e => e.stopPropagation()} style={{ background: modalBg, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, padding: "24px 20px 36px", border, borderBottom: "none", maxHeight: "85vh", overflowY: "auto" }}><div style={{ width: 36, height: 4, background: handleBg, borderRadius: 2, margin: "0 auto 20px" }} />{children}</div></div>;
}

function ConfirmModal({ action, onClose, isDark = true }) {
  if (!action) return null;
  return (
    <Modal isDark={isDark} onClose={onClose}>
      <p style={{ fontSize: 16, fontWeight: 600, color: isDark ? "#E2E8F0" : "#1E293B", textAlign: "center", marginBottom: 24, marginTop: 4 }}>{action.message}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={async () => { await action.onConfirm(); onClose(); }} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#EF4444,#DC2626)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Potrdi</button>
        <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "1px solid rgba(71,85,105,0.3)", background: "transparent", color: "#94A3B8", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Prekliči</button>
      </div>
    </Modal>
  );
}

// ─── BOTTOM NAV ───
const NAV_TABS = [
  { id: "home",     icon: "🏠", label: "Dom" },
  { id: "freezer",  icon: "❄️", label: "Zmrzko" },
  { id: "shopping", icon: "🛒", label: "Nakupi" },
  { id: "calendar", icon: "📅", label: "Koledar" },
  { id: "todo",     icon: "✅", label: "Opravila" },
];

function BottomNav({ mode, onNavigate }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(11,17,32,0.97)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(71,85,105,0.2)", display: "flex", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 80 }}>
      {NAV_TABS.map(tab => (
        <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 4px", background: "none", border: "none", cursor: "pointer", color: mode === tab.id ? "#C4B5FD" : "#475569", transition: "color 0.15s" }}>
          <span style={{ fontSize: 24, lineHeight: 1, filter: mode === tab.id ? "none" : "grayscale(0.3)" }}>{tab.icon}</span>
        </button>
      ))}
    </div>
  );
}

// ─── SWIPEABLE CARD ───
function SwipeCard({ children, onSwipeLeft, onClick }) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);

  const onTouchStart = e => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    moved.current = false;
    setSwiping(true);
  };
  const onTouchMove = e => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (dy > 30 && !moved.current) { setSwiping(false); return; }
    if (dx < -10) moved.current = true;
    setOffsetX(Math.min(0, dx));
  };
  const onTouchEnd = () => {
    setSwiping(false);
    if (offsetX < -80 && onSwipeLeft) {
      setOffsetX(-200);
      setTimeout(() => { onSwipeLeft(); setOffsetX(0); }, 200);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 16 }}>
      {/* Green background revealed on swipe */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 120, background: "linear-gradient(90deg, transparent, #22C55E)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 20, borderRadius: "0 16px 16px 0", opacity: offsetX < -30 ? 1 : 0, transition: "opacity 0.15s" }}>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>✓ Porabljeno</span>
      </div>
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={() => { if (!moved.current && onClick) onClick(); }}
        style={{ transform: `translateX(${offsetX}px)`, transition: swiping ? "none" : "transform 0.25s ease", position: "relative", zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── FREEZER DROPDOWN ───
function FreezerDD({ freezers, selected, onChange, onAdd }) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("🏠");
  const ref = useRef(null);
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setShowAdd(false); } }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, []);
  const allSel = selected.length === 0;
  const lbl = allSel ? "Vse" : selected.length === 1 ? (freezers.find(f => f.id === selected[0])?.icon + " " + freezers.find(f => f.id === selected[0])?.name) : selected.length + " izbrani";
  const toggle = id => { if (id === "all") { onChange([]); return; } const next = selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]; onChange(next.length === freezers.length ? [] : next); };
  const doAdd = async () => { if (!newName.trim()) return; await onAdd({ name: newName.trim(), icon: newIcon }); setNewName(""); setNewIcon("🏠"); setShowAdd(false); setOpen(false); };
  return <div ref={ref} style={{ position: "relative" }}>
    <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 14, border: "1px solid " + (open ? "rgba(56,189,248,0.5)" : "rgba(71,85,105,0.3)"), background: open ? "rgba(56,189,248,0.12)" : "rgba(30,41,59,0.6)", color: "#E2E8F0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}><span>{lbl}</span><span style={{ fontSize: 10, color: "#64748B", transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }}>▼</span></button>
    {open && <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 220, background: "#1E293B", border: "1px solid rgba(71,85,105,0.4)", borderRadius: 16, padding: 6, zIndex: 60, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
      <button onClick={() => { toggle("all"); setOpen(false); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "none", background: allSel ? "rgba(56,189,248,0.12)" : "transparent", color: allSel ? "#38BDF8" : "#94A3B8", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" }}><span style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (allSel ? "#38BDF8" : "#475569"), background: allSel ? "#38BDF8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{allSel ? "✓" : ""}</span> Vse</button>
      {freezers.map(f => { const on = allSel || selected.includes(f.id); return <button key={f.id} onClick={() => toggle(f.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "none", background: (!allSel && on) ? "rgba(56,189,248,0.08)" : "transparent", color: on ? "#E2E8F0" : "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" }}><span style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + ((!allSel && on) ? "#38BDF8" : "#475569"), background: (!allSel && on) ? "#38BDF8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", flexShrink: 0 }}>{(!allSel && on) ? "✓" : ""}</span> {f.icon} {f.name}</button>; })}
      {/* ADD NEW FREEZER */}
      <div style={{ borderTop: "1px solid rgba(71,85,105,0.3)", marginTop: 6, paddingTop: 6 }}>
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, border: "none", background: "transparent", color: "#38BDF8", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" }}>+ Nov zamrzovalnik</button>
        ) : (
          <div style={{ padding: "8px 6px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>{FICONS.map(ic => <button key={ic} onClick={() => setNewIcon(ic)} style={{ fontSize: 20, background: newIcon === ic ? "rgba(56,189,248,0.2)" : "transparent", border: "1px solid " + (newIcon === ic ? "rgba(56,189,248,0.5)" : "transparent"), borderRadius: 8, padding: 4, cursor: "pointer" }}>{ic}</button>)}</div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ime zamrzovalnika..." autoFocus style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", background: "rgba(15,23,42,0.8)", border: "1px solid rgba(71,85,105,0.4)", borderRadius: 10, color: "#E2E8F0", fontSize: 13, outline: "none" }} onKeyDown={e => { if (e.key === "Enter") doAdd(); }} />
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={doAdd} disabled={!newName.trim()} style={{ flex: 1, padding: "8px", borderRadius: 10, border: "none", background: newName.trim() ? "linear-gradient(135deg,#0EA5E9,#6366F1)" : "rgba(30,41,59,0.6)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: newName.trim() ? "pointer" : "default", opacity: newName.trim() ? 1 : 0.5 }}>Dodaj</button>
              <button onClick={() => { setShowAdd(false); setNewName(""); }} style={{ flex: 1, padding: "8px", borderRadius: 10, border: "1px solid rgba(71,85,105,0.3)", background: "transparent", color: "#64748B", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Prekliči</button>
            </div>
          </div>
        )}
      </div>
    </div>}
  </div>;
}

function LabelInp({ value, onChange, labels, placeholder }) {
  const [focused, setFocused] = useState(false);
  const sug = useMemo(() => { if (!focused || !labels.length) return []; if (!value) return labels.slice(0, 5); return labels.filter(l => l.toLowerCase().includes(value.toLowerCase()) && l !== value).slice(0, 5); }, [value, focused, labels]);
  return <div style={{ position: "relative" }}><input value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} placeholder={placeholder} style={INP} />{sug.length > 0 && <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#1E293B", border: "1px solid rgba(71,85,105,0.4)", borderRadius: 12, padding: 4, zIndex: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>{sug.map((s, i) => <button key={i} onMouseDown={() => onChange(s)} style={{ width: "100%", padding: "10px 14px", border: "none", borderRadius: 8, background: "transparent", color: "#CBD5E1", fontSize: 14, cursor: "pointer", textAlign: "left", fontWeight: 500 }}>📎 {s}</button>)}</div>}</div>;
}

// ─── CALENDAR UTILS ───
const SL_DAYS = ['Ne', 'Po', 'To', 'Sr', 'Če', 'Pe', 'So'];
const SL_MONTHS = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];

// ─── TODO HOME CARD (used in Home screen preview) ───
function TodoListHomeCard({ list, householdId, st, isDark, onNavigate }) {
  const { items } = useTodoItems(householdId, list.id);
  const done = items.filter(i => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? new Date(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  const accent = isPast ? '#EF4444' : isUrgent ? '#F59E0B' : '#A855F7';
  return (
    <div onClick={onNavigate} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: st.cardBg, border: st.cardBorder, borderRadius: 14, marginBottom: 8, cursor: "pointer" }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{list.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: st.textPrimary, marginBottom: total > 0 ? 4 : 0 }}>{list.title}</div>
        {total > 0 && (
          <div style={{ height: 3, background: isDark ? 'rgba(71,85,105,0.3)' : 'rgba(99,102,241,0.1)', borderRadius: 2 }}>
            <div style={{ height: '100%', borderRadius: 2, width: pct + '%', background: accent, transition: 'width 0.3s' }} />
          </div>
        )}
      </div>
      {total > 0 && <span style={{ fontSize: 11, color: st.textSecondary, flexShrink: 0 }}>{done}/{total}</span>}
      {dueDate && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: accent + '20', color: accent, flexShrink: 0 }}>{isPast ? '🔴' : dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}</span>}
    </div>
  );
}

// ═══════════════════════════
// MAIN APP
// ═══════════════════════════
export default function ZmrzkoApp({ user, household, members, signOut }) {
  const householdId = household?.id;
  
  // ─── MODE: home | freezer | shopping | calendar | more ───
  const [mode, setMode] = useState("home");

  // ─── LANGUAGE ───
  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('zmrzko_lang') || 'sl';
    return 'sl';
  });
  const t = useT(lang);
  const switchLang = (l) => { setLang(l); localStorage.setItem('zmrzko_lang', l); };

  // ─── THEME ───
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('zmrzko_theme') || 'dark';
    return 'dark';
  });
  const switchTheme = (th) => { setTheme(th); localStorage.setItem('zmrzko_theme', th); };
  const isDark = theme === 'dark';
  const st = getStyles(isDark);

  // ─── SUPABASE HOOKS (household-scoped) ───
  const { items, loading: itemsLoading, addItem: dbAddItem, updateItem: dbUpdateItem, deleteItem: dbDeleteItem } = useItems(householdId);
  const { archived, loading: archLoading, archiveItem: dbArchiveItem, updateArchived: dbUpdateArchived, deleteArchived: dbDeleteArchived, unarchiveItem: dbUnarchiveItem } = useArchived(householdId);
  const { freezers, addFreezer: dbAddFreezer } = useFreezers(householdId);
  const { categories } = useCategories(householdId);
  const { items: shopItems, loading: shopLoading, addItem: dbShopAdd, updateItem: dbShopUpdate, deleteItem: dbShopDelete } = useShoppingItems(householdId);
  const { archived: shopArchive, archiveChecked: dbShopArchiveChecked } = useShoppingArchived(householdId);
  const { favourites: shopFavourites, toggleFavourite: dbShopToggleFav } = useShoppingFavourites(householdId);
  const { lists: todoLists } = useTodoLists(householdId);
  // ─── CALENDAR STATE ───
  const [calDate, setCalDate] = useState(new Date());
  const [calLoading, setCalLoading] = useState(false);

  const { stores: shopStores, addStore: dbAddStore, updateStore: dbUpdateStore, deleteStore: dbDeleteStore } = useShoppingStores(householdId);
  const { connections: calConnections, myConnection: calConnection, isConnected: calConnected, saveConnection: saveCalConnection, removeConnection: removeCalConnection, saveEvents: saveCalEvents } = useCalendarConnections(householdId, user.id);
  const calDateStr = calDate.toISOString().split('T')[0];
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { events: allCalEvents, refetch: refetchCalEvents } = useCalendarEvents(householdId, calDateStr);
  const { events: todayCalEvents, updateEvent: updateCalEvent } = useCalendarEvents(householdId, todayStr);

  const [myFetchedEvents, setMyFetchedEvents] = useState([]);
  const [calEventDetail, setCalEventDetail] = useState(null);

  // ─── SETTINGS ───
  const [showSettings, setShowSettings] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  // ─── FREEZER UI STATE ───
  const [screen, setScreen] = useState("home");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState([]);
  const [filterStatus, setFilterStatus] = useState(null);
  const [showCatFilter, setShowCatFilter] = useState(false);
  const [selFrzs, setSelFrzs] = useState([]);
  const [showDetail, setShowDetail] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archView, setArchView] = useState("monthly");
  const [archSearch, setArchSearch] = useState("");
  const [editArchived, setEditArchived] = useState(null);
  const [archCatF, setArchCatF] = useState([]);
  const [addStep, setAddStep] = useState(0);
  const [addData, setAddData] = useState({ name: "", cat: "", qty: "", packets: 1, label: "", frozen: new Date().toISOString().split("T")[0], expiry: "", freezer: "home" });
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);

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

  // All known shopping names for autocomplete
  const shopKnown = useMemo(() => {
    const favNames = shopFavourites.map(f => f.name);
    const all = [...new Set([...favNames, ...SHOP_SUGG, ...shopArchive.map(a => a.name)])];
    return all;
  }, [shopFavourites, shopArchive]);

  const existingLabels = useMemo(() => [...new Set([...items, ...archived].map(i => i.label).filter(Boolean))], [items, archived]);

  useEffect(() => { if (screen === "add" && inputRef.current) setTimeout(() => inputRef.current?.focus(), 120); }, [screen, addStep]);

  // ─── NAVIGATION ───
  const navigate = useCallback((tab) => {
    setMode(tab);
    setScreen("home");
    setShowArchive(false);
    setShowShopArchive(false);
  }, []);

  // ─── CALENDAR LOGIC ───
  const fetchCalEvents = useCallback(async (date, token) => {
    if (!token) return;
    setCalLoading(true);
    try {
      const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setMyFetchedEvents(items); // show immediately, no DB dependency
        await saveCalEvents(items, dateStr); // save for partner to see
        refetchCalEvents();
      }
    } catch (e) { console.error('Calendar fetch error:', e); }
    setCalLoading(false);
  }, [saveCalEvents]);

  useEffect(() => {
    setMyFetchedEvents([]);
    if (mode === 'calendar' && calConnected && calConnection?.access_token) {
      fetchCalEvents(calDate, calConnection.access_token);
    }
  }, [mode, calDate, calConnected, calConnection?.access_token, fetchCalEvents]);

  // Sync today's events once per session for home screen display
  const homeSyncDone = useRef(false);
  useEffect(() => {
    if (calConnected && calConnection?.access_token && !homeSyncDone.current) {
      homeSyncDone.current = true;
      fetchCalEvents(new Date(), calConnection.access_token);
    }
  }, [calConnected, calConnection?.access_token, fetchCalEvents]);

  const connectCalendar = useCallback((silent = false) => {
    const init = () => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: async (resp) => {
          if (resp.error || !resp.access_token) return;
          const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          }).then(r => r.json());
          await saveCalConnection({ accessToken: resp.access_token, expiresIn: resp.expires_in, email: info.email });
        },
      });
      // silent = no popup, uses existing Google browser session
      tokenClient.requestAccessToken(silent ? { prompt: '' } : {});
    };
    if (window.google?.accounts?.oauth2) { init(); }
    else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = init;
      document.head.appendChild(s);
    }
  }, [saveCalConnection]);

  // Auto-refresh token 5 min before expiry; silent so no popup appears
  // Only schedule if token is still valid (not already expired)
  useEffect(() => {
    if (!calConnection?.expires_at) return;
    const msLeft = new Date(calConnection.expires_at) - Date.now();
    if (msLeft <= 0) return; // already expired — user must reconnect manually
    const delay = Math.max(0, msLeft - 5 * 60 * 1000);
    const t = setTimeout(() => connectCalendar(true), delay);
    return () => clearTimeout(t);
  }, [calConnection?.expires_at, connectCalendar]);

  // ─── FREEZER LOGIC ───
  const allF = selFrzs.length === 0;
  const vis = allF ? items : items.filter(i => selFrzs.includes(i.freezer));
  const expC = vis.filter(i => getSt(i) === "expired").length;
  const warnC = vis.filter(i => getSt(i) === "warning").length;
  const filtered = vis.filter(i => {
    if (filterCat.length > 0 && !filterCat.includes(i.cat)) return false;
    if (filterStatus === "expired" && getSt(i) !== "expired") return false;
    if (filterStatus === "warning" && getSt(i) !== "warning") return false;
    if (search && !normalizujNiz(i.name).includes(normalizujNiz(search)) && !(i.label && normalizujNiz(i.label).includes(normalizujNiz(search)))) return false;
    return true;
  }).sort((a, b) => { if (a.sticky && !b.sticky) return -1; if (!a.sticky && b.sticky) return 1; return new Date(a.expiry) - new Date(b.expiry); });

  function recalc(f, c) { const cat = categories[c] || CATS[c]; const e = new Date(f); e.setMonth(e.getMonth() + (cat?.months || 6)); return e.toISOString().split("T")[0]; }

  async function doArchive(item, wasted = false) {
    await dbArchiveItem(item, wasted);
    setShowDetail(null);
  }

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

  // ═══════════════════════════
  // LOGO / MODE TOGGLE
  // ═══════════════════════════
  const hasCats = Object.keys(categories).length > 0;

  // Loading screen
  if (itemsLoading || !hasCats) {
    return (
      <div style={{ ...A, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            <span style={{ background: "linear-gradient(135deg,#E2E8F0,#C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cožy</span>
          </div>
          <div style={{ color: "#475569", marginTop: 8, fontSize: 14 }}>Nalagam...</div>
        </div>
      </div>
    );
  }

  function LogoToggle() {
    return (
      <button onClick={() => { setMode(mode === "freezer" ? "shopping" : "freezer"); setScreen("home"); setShowArchive(false); setShowShopArchive(false); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
        {mode === "freezer" ? (
          <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px" }}>
            <span style={{ background: "linear-gradient(135deg,#E2E8F0,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ZMRZK</span>
            <span style={{ color: "#38BDF8" }}>❄️</span>
          </span>
        ) : (
          <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px" }}>
            <span style={{ background: "linear-gradient(135deg,#E2E8F0,#F59E0B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>TRGOVK</span>
            <span>🛒</span>
          </span>
        )}
        <div style={{ fontSize: 10, color: "#475569", marginTop: 2, textAlign: "left" }}>
          Tapni za {mode === "freezer" ? "nakupovalni seznam" : "zamrzovalnik"}
        </div>
      </button>
    );
  }

  function SettingsBtn() {
    return <button onClick={() => setShowSettings(true)} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>⚙️</button>;
  }

  function SettingsModal() {
    if (!showSettings) return null;
    return (
      <Modal isDark={isDark} onClose={() => setShowSettings(false)}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏠</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>{household.name}</h2>
          <p style={{ color: "#64748B", fontSize: 13, margin: 0 }}>Prijavljen kot {user.user_metadata?.full_name || user.email}</p>
        </div>

        {/* LANGUAGE SWITCHER */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {['sl', 'en'].map(l => (
            <button key={l} onClick={() => switchLang(l)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1px solid " + (lang === l ? "rgba(56,189,248,0.5)" : isDark ? "rgba(71,85,105,0.3)" : "rgba(99,102,241,0.2)"), background: lang === l ? "rgba(56,189,248,0.12)" : isDark ? "rgba(30,41,59,0.6)" : "rgba(255,255,255,0.8)", color: lang === l ? "#38BDF8" : isDark ? "#94A3B8" : "#64748B", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {l === 'sl' ? '🇸🇮 Slovenščina' : '🇬🇧 English'}
            </button>
          ))}
        </div>

        {/* THEME SWITCHER */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[['dark', '🌙 Temna'], ['light', '☀️ Svetla']].map(([th, label]) => (
            <button key={th} onClick={() => switchTheme(th)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1px solid " + (theme === th ? "rgba(99,102,241,0.5)" : isDark ? "rgba(71,85,105,0.3)" : "rgba(99,102,241,0.2)"), background: theme === th ? "rgba(99,102,241,0.15)" : isDark ? "rgba(30,41,59,0.6)" : "rgba(255,255,255,0.8)", color: theme === th ? "#818CF8" : isDark ? "#94A3B8" : "#64748B", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Join code */}
        <div style={{ padding: "16px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 14, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#38BDF8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>{t('kodaZaPovabilo')}</div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 8, color: "#E2E8F0" }}>{household.join_code}</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Deli to kodo z družino ali partnerjem</div>
        </div>

        {/* Members */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 8 }}>{t('člani')} ({members.length})</div>
          {members.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(30,41,59,0.4)", borderRadius: 12, marginBottom: 4, border: "1px solid rgba(71,85,105,0.15)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0EA5E9,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {(m.display_name || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>{m.display_name || "Uporabnik"}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{m.role === "owner" ? t('lastnik') : t('član')}</div>
              </div>
              {m.user_id === user.id
                ? <span style={{ fontSize: 11, color: "#38BDF8", fontWeight: 600 }}>Ti</span>
                : members.find(x => x.user_id === user.id)?.role === "owner" && (
                  <button onClick={() => setConfirmAction({
                    message: `Odstrani ${m.display_name || "člana"} iz gospodinjstva?`,
                    onConfirm: async () => {
                      const { error } = await supabase.rpc('remove_household_member', { p_member_id: m.id });
                      if (error) alert('Napaka: ' + error.message);
                    },
                  })} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                )
              }
            </div>
          ))}
        </div>

        {/* Google Calendar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 10 }}>📅 Google Koledar</div>
          {calConnected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>✓ Povezan</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{calConnection?.google_email}</div>
              </div>
              <button onClick={() => setConfirmAction({ message: "Odklopi Google Koledar?", onConfirm: () => removeCalConnection(calConnection.id) })} style={{ fontSize: 12, color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontWeight: 600 }}>Odklopi</button>
            </div>
          ) : (
            <button onClick={() => { setShowSettings(false); connectCalendar(); }} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#818CF8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              📅 Poveži Google Koledar
            </button>
          )}
        </div>

        <button onClick={signOut} style={{
          width: "100%", padding: "14px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.05)", color: "#EF4444", fontSize: 15, fontWeight: 700,
          cursor: "pointer",
        }}>{t('odjava')}</button>
      </Modal>
    );
  }

  // ═══════════════════════════
  // HOME SCREEN
  // ═══════════════════════════
  if (mode === "home") {
    const expiredC = items.filter(i => getSt(i) === "expired").length;
    const warningC = items.filter(i => getSt(i) === "warning").length;
    const toBuyC = shopItems.filter(i => !i.checked).length;
    const today = new Date().toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long" });

    return (
      <div style={st.A}><div style={st.F1} /><div style={st.F2} />
        <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 12, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>
                <span style={{ background: "linear-gradient(135deg,#E2E8F0,#C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cožy</span>
              </div>
              <div style={{ fontSize: 12, color: st.textSecondary, marginTop: 2, textTransform: "capitalize" }}>{today}</div>
            </div>
            <SettingsBtn />
          </div>

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div onClick={() => navigate("freezer")} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 18, padding: "16px", cursor: "pointer" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>❄️</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: st.textPrimary }}>{items.length}</div>
              <div style={{ fontSize: 12, color: st.textSecondary, fontWeight: 600 }}>v zamrzovalniku</div>
              {(expiredC > 0 || warningC > 0) && (
                <div style={{ marginTop: 6, fontSize: 11, color: expiredC > 0 ? "#EF4444" : "#F59E0B", fontWeight: 700 }}>
                  {expiredC > 0 ? `${expiredC} poteklo` : `${warningC} kmalu poteče`}
                </div>
              )}
            </div>
            <div onClick={() => navigate("shopping")} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 18, padding: "16px", cursor: "pointer" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: st.textPrimary }}>{toBuyC}</div>
              <div style={{ fontSize: 12, color: st.textSecondary, fontWeight: 600 }}>za kupiti</div>
              {toBuyC === 0 && <div style={{ marginTop: 6, fontSize: 11, color: "#22C55E", fontWeight: 700 }}>Vse kupljeno ✓</div>}
            </div>
          </div>

          {/* Today's calendar events */}
          {calConnected && todayCalEvents.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: st.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Danes</div>
              {todayCalEvents.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(ev => {
                const isMe = ev.user_id === user.id;
                const color = isMe ? '#6366F1' : '#EC4899';
                return (
                  <div key={ev.id} onClick={() => navigate('calendar')} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: st.cardBg, border: `1px solid ${ev.is_important ? color + '60' : st.cardBorder.replace('1px solid ', '')}`, borderRadius: 14, marginBottom: 6, cursor: "pointer" }}>
                    <div style={{ width: 3, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: st.textPrimary, display: "flex", alignItems: "center", gap: 4 }}>
                        {ev.is_important && <span style={{ fontSize: 11 }}>⭐</span>}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                      </div>
                      {ev.label && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 1 }}>{ev.label}</div>}
                      {!ev.is_all_day && ev.start_time && <div style={{ fontSize: 11, color: st.textMuted }}>{fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}</div>}
                    </div>
                    {ev.is_all_day && <div style={{ fontSize: 10, color: st.textMuted }}>Ves dan</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Active todo lists preview */}
          {todoLists.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: st.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Opravila</div>
              {todoLists.slice(0, 3).map(list => (
                <TodoListHomeCard key={list.id} list={list} householdId={householdId} st={st} isDark={isDark} onNavigate={() => navigate("todo")} />
              ))}
            </div>
          )}

          {/* Home module: traffic, shortcuts, bus, bikes */}
          <HomeModule user={user} householdId={householdId} isDark={isDark} />

          {/* Coming soon modules */}
          <div style={{ fontSize: 11, fontWeight: 700, color: st.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Prihaja kmalu</div>
          {[
            { icon: "🍽️", title: "Jedilnik", desc: "Tedenski jedilnik & recepti", color: "#F59E0B" },
          ].map(m => (
            <div key={m.title} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: st.cardBg, border: st.cardBorder, borderRadius: 16, marginBottom: 8, opacity: 0.65 }}>
              <span style={{ fontSize: 26 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: st.textPrimary }}>{m.title}</div>
                <div style={{ fontSize: 12, color: st.textSecondary }}>{m.desc}</div>
              </div>
              <div style={{ fontSize: 11, color: m.color, fontWeight: 700, background: m.color + "18", padding: "4px 10px", borderRadius: 20, border: `1px solid ${m.color}35`, whiteSpace: "nowrap" }}>Kmalu</div>
            </div>
          ))}
        </div>
        <BottomNav mode={mode} onNavigate={navigate} />
        <SettingsModal />
        <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} isDark={isDark} />
      </div>
    );
  }

  // ═══════════════════════════
  // CALENDAR
  // ═══════════════════════════
  if (mode === "calendar") {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - 3 + i); return d;
    });
    const selDay = new Date(calDate); selDay.setHours(0, 0, 0, 0);
    const isToday = (d) => d.toDateString() === today.toDateString();
    const isSel = (d) => d.toDateString() === selDay.toDateString();

    // Person colors — current user = indigo, partner = pink
    const myColor = '#6366F1';
    const partnerColor = '#EC4899';

    // Own events: directly from API (instant); partner events: from shared DB
    const myEvents = myFetchedEvents.map(ev => ({
      id: ev.id, title: ev.summary || 'Brez naslova',
      start_time: ev.start?.dateTime || ev.start?.date || null,
      end_time: ev.end?.dateTime || ev.end?.date || null,
      is_all_day: !!ev.start?.date, location: ev.location,
    }));
    const partnerConn = calConnections.find(c => c.user_id !== user.id);
    const partnerEvents = allCalEvents.filter(e => e.user_id !== user.id);

    // Hours 7–22
    const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
    const eventsAtHour = (list, hour) =>
      list.filter(e => e.start_time && new Date(e.start_time).getHours() === hour);

    const EventBlock = ({ ev, color }) => (
      <div onClick={() => setCalEventDetail({ ...ev })} style={{ background: color + '18', border: `1px solid ${ev.is_important ? color + '80' : color + '40'}`, borderRadius: 10, padding: "6px 8px", marginBottom: 4, cursor: "pointer" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color, lineHeight: 1.3 }}>{ev.is_important ? '⭐ ' : ''}{detectEventType(ev.title)} {ev.title}</div>
        {ev.label && <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>{ev.label}</div>}
        {!ev.is_all_day && ev.start_time && (
          <div style={{ fontSize: 10, color: st.textMuted, marginTop: 2 }}>{fmtTime(ev.start_time)}{ev.end_time ? `–${fmtTime(ev.end_time)}` : ''}</div>
        )}
      </div>
    );

    return (
      <div style={st.A}><div style={st.F1} /><div style={st.F2} />
        <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📅 Koledar</h1>
              <div style={{ fontSize: 12, color: st.textSecondary, marginTop: 2, textTransform: "capitalize" }}>{SL_MONTHS[selDay.getMonth()]} {selDay.getFullYear()}</div>
            </div>
            <button onClick={() => setShowSettings(true)} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer" }}>⚙️</button>
          </div>

          {/* Week strip */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {days.map((d, i) => (
              <button key={i} onClick={() => setCalDate(new Date(d))} style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                padding: "8px 2px", borderRadius: 12, border: "1px solid",
                borderColor: isSel(d) ? "rgba(99,102,241,0.5)" : "rgba(71,85,105,0.15)",
                background: isSel(d) ? "rgba(99,102,241,0.15)" : "transparent", cursor: "pointer",
              }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: isToday(d) ? "#818CF8" : st.textMuted }}>{SL_DAYS[d.getDay()]}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: isSel(d) ? "#818CF8" : isToday(d) ? "#E2E8F0" : st.textSecondary }}>{d.getDate()}</span>
                {isToday(d) && <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#818CF8" }} />}
              </button>
            ))}
          </div>

          {/* Not connected CTA */}
          {!calConnected && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: st.textPrimary, marginBottom: 6 }}>Poveži Google Koledar</div>
              <div style={{ fontSize: 13, color: st.textSecondary, marginBottom: 20 }}>Poveži v nastavitvah</div>
              <button onClick={connectCalendar} style={{ padding: "13px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6366F1,#818CF8)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Poveži Google Koledar</button>
            </div>
          )}

          {/* Two-lane view */}
          {calConnected && (
            <div>
              {/* Lane headers */}
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: "0 6px", marginBottom: 8 }}>
                <div />
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: myColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {calConnection?.google_email?.split('@')[0] || 'Ti'}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: partnerColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {partnerConn?.google_email?.split('@')[0] || 'Partner'}
                  </span>
                </div>
              </div>

              {/* Loading — only block on Google API fetch, not DB */}
              {calLoading && <div style={{ textAlign: "center", padding: "24px 0", color: st.textSecondary, fontSize: 13 }}>Nalagam...</div>}

              {/* Hour grid */}
              {!calLoading && HOURS.map(hour => {
                const mine = eventsAtHour(myEvents, hour);
                const theirs = eventsAtHour(partnerEvents, hour);
                const bothFree = mine.length === 0 && theirs.length === 0;
                return (
                  <div key={hour} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: "0 6px", minHeight: 36, background: bothFree ? "rgba(34,197,94,0.04)" : "transparent", borderRadius: 8, marginBottom: 2 }}>
                    <div style={{ fontSize: 10, color: bothFree ? "#22C55E" : st.textMuted, textAlign: "right", paddingTop: 10, paddingRight: 4, fontWeight: 500 }}>{hour}:00</div>
                    <div style={{ borderLeft: `2px solid ${myColor}25`, paddingLeft: 6, paddingTop: 4, paddingBottom: 4 }}>
                      {mine.map((ev, i) => <EventBlock key={ev.id || i} ev={ev} color={myColor} />)}
                    </div>
                    <div style={{ borderLeft: `2px solid ${partnerColor}25`, paddingLeft: 6, paddingTop: 4, paddingBottom: 4 }}>
                      {theirs.map((ev, i) => <EventBlock key={ev.id || i} ev={ev} color={partnerColor} />)}
                    </div>
                  </div>
                );
              })}

              {/* Partner not connected note */}
              {calConnections.length > 1 && !partnerConn && (
                <div style={{ textAlign: "center", padding: "16px", fontSize: 12, color: st.textMuted, marginTop: 8 }}>
                  Partner še ni povezal svojega koledarja
                </div>
              )}
            </div>
          )}
        </div>

        {/* Event detail modal */}
        {calEventDetail && (
          <Modal isDark={isDark} onClose={() => setCalEventDetail(null)}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{detectEventType(calEventDetail.title)}</div>
            <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>{calEventDetail.title}</h3>
            {!calEventDetail.is_all_day && calEventDetail.start_time && (
              <div style={{ fontSize: 13, color: st.textSecondary, marginBottom: 16 }}>
                {fmtTime(calEventDetail.start_time)}{calEventDetail.end_time ? ` – ${fmtTime(calEventDetail.end_time)}` : ''}
              </div>
            )}
            <button onClick={() => setCalEventDetail(d => ({ ...d, is_important: !d.is_important }))} style={{ width: "100%", padding: "12px", borderRadius: 14, border: `1px solid ${calEventDetail.is_important ? "rgba(245,158,11,0.4)" : "rgba(71,85,105,0.25)"}`, background: calEventDetail.is_important ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.4)", color: calEventDetail.is_important ? "#F59E0B" : "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
              {calEventDetail.is_important ? "⭐ Pomemben" : "☆ Označi kot pomemben"}
            </button>
            <label style={st.LBL}>Oznaka</label>
            <input value={calEventDetail.label || ''} onChange={e => setCalEventDetail(d => ({ ...d, label: e.target.value }))} placeholder="Dodaj oznako..." style={{ ...INP, marginBottom: 16 }} />
            <Btn onClick={async () => { await updateCalEvent(calEventDetail.id, { label: calEventDetail.label || null, is_important: calEventDetail.is_important || false }); setCalEventDetail(null); }}>Shrani</Btn>
          </Modal>
        )}

        <BottomNav mode={mode} onNavigate={navigate} />
        <SettingsModal />
        <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} isDark={isDark} />
      </div>
    );
  }

  // ═══════════════════════════
  // MORE (placeholder)
  // ═══════════════════════════
  // TODO
  // ═══════════════════════════
  if (mode === "todo") {
    return (
      <div style={{ position: "relative" }}>
        <TodoApp user={user} householdId={householdId} members={members} lang={lang} isDark={isDark} />
        <BottomNav mode={mode} onNavigate={navigate} />
      </div>
    );
  }

  // ═══════════════════════════
  // SHOPPING LIST
  // ═══════════════════════════
  if (mode === "shopping") {
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
        <BottomNav mode={mode} onNavigate={navigate} />
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
            <LogoToggle />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setShowShopArchive(true)} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>🧾</button>
              <SettingsBtn />
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
        <BottomNav mode={mode} onNavigate={navigate} />
        <SettingsModal />
        <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} isDark={isDark} />
      </div>
    );
  }

  // ═══════════════════════════
  // FREEZER - ARCHIVE (full v4 + waste)
  // ═══════════════════════════
  if (showArchive) {
    const fa = archived.filter(a => {
      if (archSearch && !a.name.toLowerCase().includes(archSearch.toLowerCase()) && !(a.label && a.label.toLowerCase().includes(archSearch.toLowerCase()))) return false;
      if (archCatF.length > 0 && !archCatF.includes(a.cat)) return false;
      return true;
    });
    const byMonth = {};
    fa.forEach(a => { const d = new Date(a.archived_at); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); if (!byMonth[k]) byMonth[k] = { label: d.toLocaleDateString("sl-SI", { month: "long", year: "numeric" }), items: [] }; byMonth[k].items.push(a); });
    const byCat = {};
    fa.forEach(a => { if (!byCat[a.cat]) byCat[a.cat] = []; byCat[a.cat].push(a); });
    const byItem = {};
    fa.forEach(a => { if (!byItem[a.name]) byItem[a.name] = { cat: a.cat, items: [] }; byItem[a.name].items.push(a); });
    const tot = fa.length;
    const mc = Object.keys(byMonth).length;
    const wastedCount = fa.filter(a => a.wasted).length;
    const usedCount = fa.filter(a => !a.wasted).length;

    return (
      <div style={st.A}><div style={st.F1} /><div style={st.F2} />

        {/* MODAL — EDIT ARCHIVED ITEM */}
        {editArchived && (
          <div onClick={() => setEditArchived(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(180deg,#1E293B,#0F172A)", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, padding: "24px 20px 36px", border: "1px solid rgba(71,85,105,0.3)", borderBottom: "none" }}>
              <div style={{ width: 36, height: 4, background: "#334155", borderRadius: 2, margin: "0 auto 20px" }} />
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 16px" }}>{t('urediArhiv')}{editArchived.name}</h3>
              <div style={{ marginBottom: 12 }}>
                <label style={st.LBL}>{t('ime')}</label>
                <input value={editArchived.name} onChange={e => setEditArchived(p => ({ ...p, name: e.target.value }))} style={st.INP} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={st.LBL}>{t('količina')}</label>
                <input value={editArchived.qty} onChange={e => setEditArchived(p => ({ ...p, qty: e.target.value }))} style={st.INP} />
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={async () => {
                  await dbUpdateArchived(editArchived.id, { name: editArchived.name, qty: editArchived.qty });
                  setEditArchived(null);
                }} style={{ flex: 1, padding: "13px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#0EA5E9,#6366F1)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>{t('shrani')}</button>
                <button onClick={() => setEditArchived(null)} style={{ flex: 1, padding: "13px", borderRadius: 14, border: "1px solid rgba(71,85,105,0.3)", background: "transparent", color: "#64748B", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>{t('prekliči')}</button>
              </div>
              <button onClick={() => setConfirmAction({
                message: t('izbrišiVprašanje'),
                onConfirm: async () => {
                  await dbDeleteArchived(editArchived.id);
                  setEditArchived(null);
                },
              })} style={{ width: "100%", padding: "13px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>{t('izbrišiArhiv')}</button>
              <button onClick={() => setConfirmAction({
                message: t('vrniVprašanje'),
                onConfirm: async () => {
                  await dbUnarchiveItem(editArchived);
                  setEditArchived(null);
                },
              })} style={{ width: "100%", padding: "13px", marginTop: 8, borderRadius: 14, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#22C55E", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>{t('vrniVZamrzovalnik')}</button>
            </div>
          </div>
        )}

        <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12, marginBottom: 16 }}>
            <button onClick={() => setShowArchive(false)} style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.3)", borderRadius: 12, padding: "10px 16px", color: "#94A3B8", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>{t('nazaj')}</button>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{t('arhiv')}</h2>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 12 }}><span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#475569" }}>🔍</span><input value={archSearch} onChange={e => setArchSearch(e.target.value)} placeholder={t('išičVArhivu')} style={{ ...INP, paddingLeft: 38, border: "1px solid rgba(71,85,105,0.3)", fontSize: 14 }} />{archSearch && <button onClick={() => setArchSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748B", fontSize: 16, cursor: "pointer" }}>✕</button>}</div>

          {/* Category filter pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <Pill small active={archCatF.length === 0} onClick={() => setArchCatF([])}>{t('vse')}</Pill>
            {Object.entries(categories).map(([k, v]) => {
              const cnt = archived.filter(a => a.cat === k).length;
              return cnt ? <Pill key={k} small active={archCatF.includes(k)} color={v.color} onClick={() => setArchCatF(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k])}>{v.icon} {cnt}</Pill> : null;
            })}
          </div>

          {/* Stats row with waste tracking */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
            {[[t('zadetki'), tot, "#38BDF8"], [t('povprMes'), mc ? Math.round(tot / mc) : 0, "#818CF8"], [t('porabljeno2'), usedCount, "#22C55E"], [t('zavrženo'), wastedCount, "#EF4444"]].map(([l, v, c]) => (
              <div key={l} style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "10px 8px", border: "1px solid rgba(71,85,105,0.2)", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: c === "#EF4444" ? "#EF4444" : c === "#22C55E" ? "#22C55E" : "#64748B", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <Pill small active={archView === "monthly"} onClick={() => setArchView("monthly")}>{t('mesečno')}</Pill>
            <Pill small active={archView === "category"} onClick={() => setArchView("category")}>{t('kategorije')}</Pill>
            <Pill small active={archView === "item"} onClick={() => setArchView("item")}>{t('poIzdelku')}</Pill>
          </div>

          {tot === 0 && <div style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}><div style={{ fontSize: 48, marginBottom: 12 }}>📭</div><p>{t('niZadetkov')}</p></div>}

          {/* MONTHLY VIEW */}
          {archView === "monthly" && Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([k, { label, items: mi }]) => (
            <div key={k} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8", margin: 0, textTransform: "capitalize" }}>{label}</h3>
                <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{mi.length}</span>
              </div>
              {mi.map((it, i) => {
                const cat = categories[it.cat] || CATS.drugo;
                return (
                  <div key={it.id + "-" + i} onClick={() => setEditArchived(it)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: it.wasted ? "rgba(239,68,68,0.06)" : "rgba(30,41,59,0.4)", borderRadius: 12, marginBottom: 3, border: "1px solid " + (it.wasted ? "rgba(239,68,68,0.15)" : "rgba(71,85,105,0.12)"), cursor: "pointer" }}>
                    <span style={{ fontSize: 18 }}>{cat.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: it.wasted ? "#EF4444" : "#CBD5E1" }}>{it.name} {it.wasted && <span style={{ fontSize: 11, opacity: 0.7 }}>· zavrženo</span>}</div>
                      <div style={{ fontSize: 11, color: "#475569" }}>{it.qty}{it.packets > 1 ? " / " + it.packets + "p" : ""}{it.label ? " · " + it.label : ""}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", flexShrink: 0 }}>{fmtD(it.archived_at)}</div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* CATEGORY VIEW */}
          {archView === "category" && Object.entries(byCat).sort((a, b) => b[1].length - a[1].length).map(([ck, ci]) => {
            const cat = categories[ck] || CATS.drugo;
            return (
              <div key={ck} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: cat.color, margin: 0 }}>{cat.icon} {cat.label}</h3>
                  <span style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{ci.length}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "rgba(30,41,59,0.6)", marginBottom: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, background: cat.color, width: Math.min(100, (ci.length / tot) * 300) + "%", opacity: 0.7 }} />
                </div>
                {ci.slice(0, 5).map((it, i) => (
                  <div key={it.id + "-" + i} onClick={() => setEditArchived(it)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", background: it.wasted ? "rgba(239,68,68,0.06)" : "rgba(30,41,59,0.3)", borderRadius: 10, marginBottom: 3, cursor: "pointer" }}>
                    <div style={{ flex: 1, fontSize: 13, color: it.wasted ? "#EF4444" : "#CBD5E1", fontWeight: 500 }}>{it.name}{it.wasted ? " · zavrženo" : ""}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{it.qty}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{fmtD(it.archived_at)}</div>
                  </div>
                ))}
                {ci.length > 5 && <div style={{ fontSize: 12, color: "#475569", padding: "4px 12px" }}>+ še {ci.length - 5}</div>}
              </div>
            );
          })}

          {/* PER-ITEM VIEW with mini bar charts */}
          {archView === "item" && Object.entries(byItem).sort((a, b) => b[1].items.length - a[1].items.length).map(([name, { cat: ck, items: ie }]) => {
            const cat = categories[ck] || CATS.drugo;
            const wastedInItem = ie.filter(e => e.wasted).length;
            const mb = {};
            ie.forEach(e => {
              const d = new Date(e.archived_at);
              const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
              if (!mb[k]) mb[k] = { label: d.toLocaleDateString("sl-SI", { month: "short", year: "2-digit" }), count: 0 };
              mb[k].count++;
            });
            const mx = Math.max(...Object.values(mb).map(m => m.count));
            return (
              <div key={name} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{cat.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0" }}>{name}</div>
                    <div style={{ fontSize: 12, color: cat.color, fontWeight: 600 }}>
                      Skupaj: {ie.length}× | {cat.label}
                      {wastedInItem > 0 && <span style={{ color: "#EF4444" }}> · {wastedInItem}× zavrženo</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 50, padding: "0 4px", marginBottom: 4 }}>
                  {Object.entries(mb).sort((a, b) => a[0].localeCompare(b[0])).map(([k, { count }]) => (
                    <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      <div style={{ fontSize: 10, color: "#64748B", fontWeight: 700 }}>{count}</div>
                      <div style={{ width: "100%", maxWidth: 28, height: Math.max(8, (count / mx) * 36), background: cat.color, borderRadius: 4, opacity: 0.6 }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 3, padding: "0 4px" }}>
                  {Object.entries(mb).sort((a, b) => a[0].localeCompare(b[0])).map(([k, { label }]) => (
                    <div key={k} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "#475569", fontWeight: 600 }}>{label}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <BottomNav mode={mode} onNavigate={navigate} />
        <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} isDark={isDark} />
      </div>
    );
  }

  // ═══════════════════════════
  // FREEZER HOME
  // ═══════════════════════════
  if (screen === "home") {
    return (
      <div style={st.A}><div style={st.F1} /><div style={st.F2} />
        <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))" }}>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 12, marginBottom: 14 }}>
            <LogoToggle />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <FreezerDD freezers={freezers} selected={selFrzs} onChange={setSelFrzs} onAdd={dbAddFreezer} />
              <button onClick={() => { setShowArchive(true); setArchSearch(""); setArchCatF([]); }} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>📦</button>
              <SettingsBtn />
            </div>
          </div>

          {(expC > 0 || warnC > 0) && <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>{expC > 0 && <button onClick={() => setFilterStatus(filterStatus === "expired" ? null : "expired")} style={{ background: filterStatus === "expired" ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.12)", color: "#EF4444", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 20, border: "1px solid " + (filterStatus === "expired" ? "rgba(239,68,68,0.6)" : "rgba(239,68,68,0.25)"), cursor: "pointer" }}>🔴 {expC} poteklo</button>}{warnC > 0 && <button onClick={() => setFilterStatus(filterStatus === "warning" ? null : "warning")} style={{ background: filterStatus === "warning" ? "rgba(245,158,11,0.2)" : "rgba(245,158,11,0.1)", color: "#F59E0B", fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 20, border: "1px solid " + (filterStatus === "warning" ? "rgba(245,158,11,0.5)" : "rgba(245,158,11,0.2)"), cursor: "pointer" }}>🟠 {warnC} kmalu</button>}{filterStatus && <button onClick={() => setFilterStatus(null)} style={{ background: "transparent", border: "1px solid rgba(71,85,105,0.3)", borderRadius: 20, padding: "6px 12px", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>✕</button>}</div>}

          <div style={{ display: "flex", gap: 8, marginBottom: showCatFilter ? 8 : 12 }}><div style={{ position: "relative", flex: 1 }}><span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#475569" }}>🔍</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('išči')} style={{ ...INP, paddingLeft: 38, paddingRight: search ? 38 : 16, border: "1px solid rgba(71,85,105,0.3)", fontSize: 14 }} />{search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#64748B", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>}</div><button onClick={() => setShowCatFilter(!showCatFilter)} style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0, border: "1px solid " + (showCatFilter || filterCat.length > 0 ? "rgba(99,102,241,0.5)" : "rgba(71,85,105,0.3)"), background: showCatFilter || filterCat.length > 0 ? "rgba(99,102,241,0.12)" : "rgba(30,41,59,0.6)", color: showCatFilter || filterCat.length > 0 ? "#818CF8" : "#64748B", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>☰{filterCat.length > 0 && <span style={{ position: "absolute", top: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: "#818CF8" }} />}</button></div>

          {showCatFilter && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, padding: "10px 12px", background: "rgba(30,41,59,0.4)", borderRadius: 14, border: "1px solid rgba(71,85,105,0.15)" }}><Pill small active={filterCat.length === 0} onClick={() => setFilterCat([])}>Vse</Pill>{Object.entries(categories).map(([k, v]) => { const cnt = vis.filter(i => i.cat === k).length; return cnt ? <Pill key={k} small active={filterCat.includes(k)} color={v.color} onClick={() => setFilterCat(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k])}>{v.icon} {v.label} ({cnt})</Pill> : null; })}</div>}

          {/* Items with swipe */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {filtered.map(item => {
              const cat = categories[item.cat] || CATS.drugo;
              const status = getSt(item);
              const frz = freezers.find(f => f.id === item.freezer);
              return (
                <SwipeCard key={item.id} onSwipeLeft={() => doArchive(item, false)} onClick={() => { setShowDetail(item); setEditMode(false); }}>
                  <div style={{ background: stBg(status), border: "1px solid " + (status === "expired" ? "rgba(239,68,68,0.2)" : status === "warning" ? "rgba(245,158,11,0.15)" : "rgba(71,85,105,0.15)"), borderRadius: 16, padding: "12px 14px", cursor: "pointer", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: cat.color, borderRadius: "16px 0 0 16px" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 24, flexShrink: 0 }}>{cat.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.packets > 1 && <span style={{ color: "#818CF8" }}>{item.packets}x </span>}{item.name}</span>
                            {item.sticky && <span style={{ fontSize: 10 }}>📌</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748B", display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center" }}>
                            <span>{item.qty}{item.packets > 1 ? " · " + item.packets + "p" : ""}</span>
                            {allF && frz && <><span>·</span><span>{frz.icon}</span></>}
                            {item.label && <><span>·</span><span style={{ color: "#818CF8", fontWeight: 600 }}>{item.label}</span></>}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: stCol(status), background: stCol(status) + "15", padding: "3px 8px", borderRadius: 8, display: "inline-block", marginBottom: 2 }}>{wksShort(item.expiry)}</div>
                        <div style={{ fontSize: 10, color: "#475569" }}>{fmtD(item.expiry)}</div>
                      </div>
                    </div>
                  </div>
                </SwipeCard>
              );
            })}
          </div>

          {filtered.length === 0 && <div style={{ textAlign: "center", padding: "48px 0", color: "#475569" }}><div style={{ fontSize: 48, marginBottom: 12 }}>{items.length === 0 ? "❄️" : "🔍"}</div><p>{items.length === 0 ? "Zamrzovalnik je prazen!" : "Ni zadetkov"}</p></div>}
        </div>

        <button onClick={() => { const df = selFrzs.length === 1 ? selFrzs[0] : "home"; setAddData({ name: "", cat: "", qty: "", packets: 1, label: "", frozen: new Date().toISOString().split("T")[0], expiry: "", freezer: df }); setAddStep(0); setSuggestions([]); setScreen("add"); }} style={{ position: "fixed", bottom: "calc(74px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", width: 62, height: 62, borderRadius: "50%", border: "none", background: "linear-gradient(135deg,#0EA5E9,#6366F1)", color: "#fff", fontSize: 30, fontWeight: 300, cursor: "pointer", boxShadow: "0 8px 32px rgba(14,165,233,0.4),0 0 0 4px rgba(14,165,233,0.1)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>+</button>

        {/* DETAIL MODAL - REDESIGNED */}
        {showDetail && (() => {
          const item = showDetail;
          const cat = categories[item.cat] || CATS.drugo;
          const status = getSt(item);
          const frz = freezers.find(f => f.id === item.freezer);

          if (editMode && editData) {
            return (
              <Modal isDark={isDark} onClose={() => setEditMode(false)}>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 20px", textAlign: "center" }}>✏️ Uredi izdelek</h3>
                <label style={st.LBL}>Ime</label>
                <input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} style={{ ...INP, marginBottom: 14 }} />
                <label style={st.LBL}>Kategorija</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>{Object.entries(categories).map(([k, v]) => <button key={k} onClick={() => setEditData(d => ({ ...d, cat: k }))} style={{ padding: "7px 11px", borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid " + (editData.cat === k ? v.color + "80" : "rgba(71,85,105,0.3)"), background: editData.cat === k ? v.color + "20" : "rgba(30,41,59,0.5)", color: editData.cat === k ? v.color : "#94A3B8" }}>{v.icon} {v.label}</button>)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div><label style={st.LBL}>Količina</label><input value={editData.qty} onChange={e => setEditData(d => ({ ...d, qty: e.target.value }))} style={INP} /></div>
                  <div><label style={st.LBL}>Paketi</label><div style={{ display: "flex", alignItems: "center", gap: 8 }}><button onClick={() => setEditData(d => ({ ...d, packets: Math.max(1, d.packets - 1) }))} style={{ width: 40, height: 46, borderRadius: 10, border: "1px solid rgba(71,85,105,0.3)", background: "rgba(30,41,59,0.6)", color: "#94A3B8", fontSize: 20, cursor: "pointer" }}>−</button><span style={{ fontSize: 20, fontWeight: 800, minWidth: 24, textAlign: "center" }}>{editData.packets}</span><button onClick={() => setEditData(d => ({ ...d, packets: d.packets + 1 }))} style={{ width: 40, height: 46, borderRadius: 10, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818CF8", fontSize: 20, cursor: "pointer" }}>+</button></div></div>
                </div>
                <label style={st.LBL}>Labela</label>
                <LabelInp value={editData.label} onChange={v => setEditData(d => ({ ...d, label: v }))} labels={existingLabels} placeholder="opcijsko" />
                <div style={{ height: 14 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div><label style={st.LBL}>Zamrznjeno</label><input type="date" value={editData.frozen} onChange={e => setEditData(d => ({ ...d, frozen: e.target.value }))} style={{ ...INP, colorScheme: "dark" }} /></div>
                  <div><label style={st.LBL}>Rok uporabe</label><input type="date" value={editData.expiry} onChange={e => setEditData(d => ({ ...d, expiry: e.target.value }))} style={{ ...INP, colorScheme: "dark" }} /></div>
                </div>
                <label style={st.LBL}>Zamrzovalnik</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>{freezers.map(f => <button key={f.id} onClick={() => setEditData(d => ({ ...d, freezer: f.id }))} style={{ padding: "9px 14px", borderRadius: 12, border: "1px solid " + (editData.freezer === f.id ? "rgba(56,189,248,0.5)" : "rgba(71,85,105,0.3)"), background: editData.freezer === f.id ? "rgba(56,189,248,0.12)" : "rgba(30,41,59,0.5)", color: editData.freezer === f.id ? "#38BDF8" : "#94A3B8", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{f.icon} {f.name}</button>)}</div>
                <Btn v="success" onClick={async () => { await dbUpdateItem(editData.id, { name: editData.name, cat: editData.cat, qty: editData.qty, packets: editData.packets, label: editData.label, frozen: editData.frozen, expiry: editData.expiry, freezer: editData.freezer }); setShowDetail(editData); setEditMode(false); }}>💾 Shrani</Btn>
                <Btn v="ghost" onClick={() => setEditMode(false)} style={{ marginTop: 8 }}>Prekliči</Btn>
              </Modal>
            );
          }

          return (
            <Modal isDark={isDark} onClose={() => setShowDetail(null)}>
              {/* Redesigned detail layout */}
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 56 }}>{cat.icon}</span>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 4px" }}>{item.name}</h2>
                {/* Status with full text */}
                <div style={{ fontSize: 15, fontWeight: 700, color: stCol(status), marginBottom: 4 }}>{wksUntil(item.expiry)}</div>
              </div>

              {/* Key info: frozen date + expiry first */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <FC label="Zamrznjeno" value={fmtD(item.frozen)} />
                <FC label="Rok uporabe" value={fmtD(item.expiry)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <FC label="Količina" value={item.qty + (item.packets > 1 ? " / " + item.packets + " pak." : "")} />
                <FC label="Zamrzovalnik" value={frz ? frz.icon + " " + frz.name : "—"} />
              </div>
              {/* Category + label row */}
              <div style={{ display: "grid", gridTemplateColumns: item.label ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 16 }}>
                <FC label="Kategorija" value={cat.label} />
                {item.label && <FC label="Labela" value={item.label} />}
              </div>

              {/* Quick packet decrement */}
              {item.packets > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 14, marginBottom: 14 }}>
                  <div><div style={{ fontSize: 13, fontWeight: 700, color: "#818CF8" }}>Odštej paket</div><div style={{ fontSize: 12, color: "#64748B" }}>Trenutno: {item.packets}</div></div>
                  <button onClick={async () => { const newP = item.packets - 1; await dbUpdateItem(item.id, { packets: newP }); setShowDetail({ ...item, packets: newP }); }} style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.15)", color: "#818CF8", fontSize: 20, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−1</button>
                </div>
              )}

              {/* Action buttons - redesigned */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={() => doArchive(item, false)} style={{ flex: 3, padding: "15px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#22C55E,#059669)", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>✓ Uporabljeno</button>
                <button onClick={() => doArchive(item, true)} style={{ flex: 1, padding: "15px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#EF4444", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>🗑</button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={() => { setEditData({ ...item }); setEditMode(true); }} style={{ flex: 1, padding: "12px", borderRadius: 14, border: "1px solid rgba(56,189,248,0.3)", background: "rgba(56,189,248,0.08)", color: "#38BDF8", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>✏️ Uredi</button>
                <button onClick={async () => { await dbUpdateItem(item.id, { sticky: !item.sticky }); setShowDetail({ ...item, sticky: !item.sticky }); }} style={{ flex: 1, padding: "12px", borderRadius: 14, border: "1px solid rgba(71,85,105,0.3)", background: item.sticky ? "rgba(245,158,11,0.1)" : "rgba(30,41,59,0.6)", color: item.sticky ? "#F59E0B" : "#94A3B8", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{item.sticky ? "📌 Odpni" : "📌 Pripni"}</button>
                <button onClick={async () => { await dbDeleteItem(item.id); setShowDetail(null); }} style={{ flex: 1, padding: "12px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.15)", background: "transparent", color: "#64748B", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Zbriši</button>
              </div>
            </Modal>
          );
        })()}
        <BottomNav mode={mode} onNavigate={navigate} />
        <SettingsModal />
        <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} isDark={isDark} />
      </div>
    );
  }

  // ═══════════════════════════
  // FREEZER - ADD (SIMPLIFIED)
  // ═══════════════════════════
  const stepLabels = addStep < 2 ? [t('korak1'), t('korak2')] : [t('korak1'), t('korak2'), t('korak3')];

  return (
    <div style={st.A}><div style={st.F1} /><div style={st.F2} />
      <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))", minHeight: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <button onClick={() => { if (addStep === 0) setScreen("home"); else setAddStep(addStep - 1); }} style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.3)", borderRadius: 12, padding: "10px 16px", color: "#94A3B8", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>{t('nazaj')}</button>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{t('dodajVZamrzovalnik')}</h2>
          <button onClick={() => setScreen("home")} style={{ background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.3)", borderRadius: 12, width: 40, height: 40, color: "#94A3B8", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Progress - only show active steps */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
          {stepLabels.map((l, i) => <div key={i} style={{ flex: 1, textAlign: "center" }}><div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: i <= addStep ? "linear-gradient(90deg,#0EA5E9,#6366F1)" : "rgba(51,65,85,0.5)" }} /><span style={{ fontSize: 11, color: i <= addStep ? "#38BDF8" : "#475569", fontWeight: 600 }}>{l}</span></div>)}
        </div>

        {/* STEP 0: Name + Category */}
        {addStep === 0 && (
          <div>
            <label style={st.LBL}>{t('kajZamrzuješ')}</label>
            <input ref={inputRef} value={addData.name} onChange={e => { setAddData(d => ({ ...d, name: e.target.value })); setSuggestions(e.target.value.length >= 2 ? SUGG.filter(s => s.n.toLowerCase().includes(e.target.value.toLowerCase())).slice(0, 5) : []); }} placeholder={t('primerekIskanja')} style={{ ...INP, fontSize: 17 }} />
            {suggestions.length > 0 && <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>{suggestions.map((s, i) => { const cat = categories[s.c] || CATS[s.c]; return <button key={i} onClick={() => { const exp = new Date(addData.frozen); exp.setMonth(exp.getMonth() + (cat?.months || 6)); setAddData(d => ({ ...d, name: s.n, cat: s.c, expiry: exp.toISOString().split("T")[0] })); setSuggestions([]); setAddStep(1); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.3)", borderRadius: 14, color: "#E2E8F0", fontSize: 15, cursor: "pointer", textAlign: "left" }}><span style={{ fontSize: 22 }}>{cat?.icon}</span><div><div style={{ fontWeight: 600 }}>{s.n}</div><div style={{ fontSize: 12, color: cat?.color, fontWeight: 600 }}>{cat?.label} · rok {cat?.months} mes.</div></div></button>; })}</div>}
            {addData.name.length >= 2 && suggestions.length === 0 && <div style={{ marginTop: 16 }}><p style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>{t('izberiKategorijo')}</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{Object.entries(categories).map(([k, v]) => <button key={k} onClick={() => { const exp = new Date(addData.frozen); exp.setMonth(exp.getMonth() + (v.months || 6)); setAddData(d => ({ ...d, cat: k, expiry: exp.toISOString().split("T")[0] })); setAddStep(1); }} style={{ padding: "14px 6px", background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 14, color: "#E2E8F0", cursor: "pointer", textAlign: "center" }}><div style={{ fontSize: 24, marginBottom: 4 }}>{v.icon}</div><div style={{ fontSize: 11, fontWeight: 600, color: v.color }}>{v.label}</div></button>)}</div></div>}
          </div>
        )}

        {/* STEP 1: Quantity + Quick summary + ADD or MORE OPTIONS */}
        {addStep === 1 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 44 }}>{(categories[addData.cat] || CATS[addData.cat])?.icon}</span>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0 0" }}>{addData.name}</h3>
              <span style={{ fontSize: 13, color: (categories[addData.cat] || CATS[addData.cat])?.color, fontWeight: 600 }}>{(categories[addData.cat] || CATS[addData.cat])?.label}</span>
            </div>

            <label style={st.LBL}>{t('količina')}</label>
            <input ref={inputRef} value={addData.qty} onChange={e => setAddData(d => ({ ...d, qty: e.target.value }))} placeholder="npr. 500g, 2 kosa, 1L" style={{ ...INP, marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {QO.map(q => <button key={q} onClick={() => setAddData(d => ({ ...d, qty: q }))} style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid " + (addData.qty === q ? "rgba(99,102,241,0.5)" : "rgba(71,85,105,0.3)"), background: addData.qty === q ? "rgba(99,102,241,0.15)" : "rgba(30,41,59,0.5)", color: addData.qty === q ? "#818CF8" : "#94A3B8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{q}</button>)}
            </div>

            {/* Auto-summary */}
            <div style={{ padding: "14px 16px", background: "rgba(30,41,59,0.4)", borderRadius: 14, border: "1px solid rgba(71,85,105,0.15)", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94A3B8", marginBottom: 6 }}>
                <span>{t('rokUporabe')}:</span>
                <span style={{ color: "#22C55E", fontWeight: 700 }}>{addData.expiry ? fmtD(addData.expiry) : fmtD(recalc(addData.frozen, addData.cat))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#94A3B8" }}>
                <span>{t('zamrzovalnik')}:</span>
                <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{freezers.find(f => f.id === addData.freezer)?.icon} {freezers.find(f => f.id === addData.freezer)?.name}</span>
              </div>
            </div>

            <Btn v="success" disabled={!addData.qty} onClick={async () => {
              const exp = addData.expiry || recalc(addData.frozen, addData.cat);
              await dbAddItem({ name: addData.name, cat: addData.cat, qty: addData.qty, packets: 1, label: "", frozen: addData.frozen, expiry: exp, freezer: addData.freezer, sticky: false });
              setScreen("home");
            }}>{t('dodajVZamrzovalnik')}</Btn>
            <Btn v="ghost" disabled={!addData.qty} onClick={() => setAddStep(2)} style={{ marginTop: 8 }}>{t('večOpcij')}</Btn>
          </div>
        )}

        {/* STEP 2: More options - packets, label, edit dates, freezer */}
        {addStep === 2 && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span style={{ fontSize: 44 }}>{(categories[addData.cat] || CATS[addData.cat])?.icon}</span>
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0 0" }}>{addData.name}</h3>
              <span style={{ fontSize: 13, color: "#64748B" }}>{addData.qty} · {(categories[addData.cat] || CATS[addData.cat])?.label}</span>
            </div>

            <label style={st.LBL}>{t('paketi')}</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <button onClick={() => setAddData(d => ({ ...d, packets: Math.max(1, d.packets - 1) }))} style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid rgba(71,85,105,0.3)", background: "rgba(30,41,59,0.6)", color: "#94A3B8", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <span style={{ fontSize: 24, fontWeight: 800, minWidth: 32, textAlign: "center" }}>{addData.packets}</span>
              <button onClick={() => setAddData(d => ({ ...d, packets: d.packets + 1 }))} style={{ width: 44, height: 44, borderRadius: 12, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.1)", color: "#818CF8", fontSize: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              <span style={{ fontSize: 13, color: "#64748B" }}>{t('paketov')}</span>
            </div>

            <label style={st.LBL}>{t('labela')} <span style={{ fontWeight: 400, color: "#475569" }}>({t('opcijsko')})</span></label>
            <LabelInp value={addData.label} onChange={v => setAddData(d => ({ ...d, label: v }))} labels={existingLabels} placeholder={t('primerekLabele')} />
            <div style={{ height: 16 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div><label style={st.LBL}>{t('zamrznjeno')}</label><input type="date" value={addData.frozen} onChange={e => { const f = e.target.value; setAddData(d => ({ ...d, frozen: f, expiry: recalc(f, d.cat) })); }} style={{ ...INP, colorScheme: "dark" }} /></div>
              <div><label style={st.LBL}>{t('rokUporabe')}</label><input type="date" value={addData.expiry || recalc(addData.frozen, addData.cat)} onChange={e => setAddData(d => ({ ...d, expiry: e.target.value }))} style={{ ...INP, colorScheme: "dark" }} /></div>
            </div>

            <label style={st.LBL}>{t('zamrzovalnik')}</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {freezers.map(f => <button key={f.id} onClick={() => setAddData(d => ({ ...d, freezer: f.id }))} style={{ padding: "10px 16px", borderRadius: 14, border: "1px solid " + (addData.freezer === f.id ? "rgba(56,189,248,0.5)" : "rgba(71,85,105,0.3)"), background: addData.freezer === f.id ? "rgba(56,189,248,0.12)" : "rgba(30,41,59,0.5)", color: addData.freezer === f.id ? "#38BDF8" : "#94A3B8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>{f.icon} {f.name}</button>)}
            </div>

            <Btn v="success" onClick={async () => {
              const exp = addData.expiry || recalc(addData.frozen, addData.cat);
              await dbAddItem({ name: addData.name, cat: addData.cat, qty: addData.qty, packets: addData.packets, label: addData.label, frozen: addData.frozen, expiry: exp, freezer: addData.freezer, sticky: false });
              setScreen("home");
            }}>{t('dodajVZamrzovalnik')}</Btn>
          </div>
        )}
      </div>
      <BottomNav mode={mode} onNavigate={navigate} />
    </div>
  );
}
