'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useT } from '@/lib/i18n';
import { normalizujNiz } from '@/lib/hooks';
import { CATS, SUGG, FICONS, QO } from '@/lib/constants';
import { getSt, fmtD, wksUntil, wksShort, stCol, stBg, localDateStr } from '@/lib/utils';
import { INP } from '@/lib/styles';
import { Pill, FC, Btn, Modal, ConfirmModal, SwipeCard, LogoToggle } from './ui';

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

export default function FreezerModule({
  isDark, st, lang,
  items, dbAddItem, dbUpdateItem, dbDeleteItem,
  archived, dbArchiveItem, dbUpdateArchived, dbDeleteArchived, dbUnarchiveItem,
  freezers, dbAddFreezer, categories,
  onToggleMode, onOpenSettings,
}) {
  const t = useT(lang);

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
  const [addData, setAddData] = useState({ name: "", cat: "", qty: "", packets: 1, label: "", frozen: localDateStr(), expiry: "", freezer: "home" });
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  const existingLabels = useMemo(() => [...new Set([...items, ...archived].map(i => i.label).filter(Boolean))], [items, archived]);

  useEffect(() => { if (screen === "add" && inputRef.current) setTimeout(() => inputRef.current?.focus(), 120); }, [screen, addStep]);

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

  function recalc(f, c) { const cat = categories[c] || CATS[c]; const e = new Date(f); e.setMonth(e.getMonth() + (cat?.months || 6)); return localDateStr(e); }

  async function doArchive(item, wasted = false) {
    await dbArchiveItem(item, wasted);
    setShowDetail(null);
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
            <LogoToggle mode="freezer" onToggle={onToggleMode} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <FreezerDD freezers={freezers} selected={selFrzs} onChange={setSelFrzs} onAdd={dbAddFreezer} />
              <button onClick={() => { setShowArchive(true); setArchSearch(""); setArchCatF([]); }} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>📦</button>
              <button onClick={onOpenSettings} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>⚙️</button>
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

        <button onClick={() => { const df = selFrzs.length === 1 ? selFrzs[0] : "home"; setAddData({ name: "", cat: "", qty: "", packets: 1, label: "", frozen: localDateStr(), expiry: "", freezer: df }); setAddStep(0); setSuggestions([]); setScreen("add"); }} style={{ position: "fixed", bottom: "calc(74px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)", width: 62, height: 62, borderRadius: "50%", border: "none", background: "linear-gradient(135deg,#0EA5E9,#6366F1)", color: "#fff", fontSize: 30, fontWeight: 300, cursor: "pointer", boxShadow: "0 8px 32px rgba(14,165,233,0.4),0 0 0 4px rgba(14,165,233,0.1)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>+</button>

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
            {suggestions.length > 0 && <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>{suggestions.map((s, i) => { const cat = categories[s.c] || CATS[s.c]; return <button key={i} onClick={() => { const exp = new Date(addData.frozen); exp.setMonth(exp.getMonth() + (cat?.months || 6)); setAddData(d => ({ ...d, name: s.n, cat: s.c, expiry: localDateStr(exp) })); setSuggestions([]); setAddStep(1); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(71,85,105,0.3)", borderRadius: 14, color: "#E2E8F0", fontSize: 15, cursor: "pointer", textAlign: "left" }}><span style={{ fontSize: 22 }}>{cat?.icon}</span><div><div style={{ fontWeight: 600 }}>{s.n}</div><div style={{ fontSize: 12, color: cat?.color, fontWeight: 600 }}>{cat?.label} · rok {cat?.months} mes.</div></div></button>; })}</div>}
            {addData.name.length >= 2 && suggestions.length === 0 && <div style={{ marginTop: 16 }}><p style={{ fontSize: 13, color: "#64748B", marginBottom: 10 }}>{t('izberiKategorijo')}</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>{Object.entries(categories).map(([k, v]) => <button key={k} onClick={() => { const exp = new Date(addData.frozen); exp.setMonth(exp.getMonth() + (v.months || 6)); setAddData(d => ({ ...d, cat: k, expiry: localDateStr(exp) })); setAddStep(1); }} style={{ padding: "14px 6px", background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 14, color: "#E2E8F0", cursor: "pointer", textAlign: "center" }}><div style={{ fontSize: 24, marginBottom: 4 }}>{v.icon}</div><div style={{ fontSize: 11, fontWeight: 600, color: v.color }}>{v.label}</div></button>)}</div></div>}
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
    </div>
  );
}
