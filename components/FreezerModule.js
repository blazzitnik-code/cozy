'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useT } from '@/lib/i18n';
import { normalizujNiz } from '@/lib/hooks';
import { CATS, SUGG, FICONS, QO } from '@/lib/constants';
import { getSt, fmtD, wksUntil, wksShort, localDateStr, cx, STATUS_TEXT, STATUS_CARD, STATUS_BADGE } from '@/lib/utils';
import { Screen, Pill, FC, Btn, Modal, ConfirmModal, SwipeCard, LogoToggle, Input, Label, IconButton, EmptyState, Fab } from './ui';

// Repeated class recipes local to this module
const BACK_BTN = "bg-field border border-line-strong rounded-12 py-2.5 px-4 text-ink-2 text-14 cursor-pointer font-semibold";
const SEARCH_INP = "w-full box-border py-3.5 pr-4 pl-[38px] bg-field border border-line-strong rounded-14 text-ink outline-none font-medium text-14";
const STEPPER_MINUS = "w-11 h-11 rounded-12 border border-line-strong bg-surface text-ink-2 text-22 cursor-pointer flex items-center justify-center";
const STEPPER_PLUS = "w-11 h-11 rounded-12 border border-accent-2/30 bg-accent-2/10 text-accent-3 text-22 cursor-pointer flex items-center justify-center";
// Sky-accent selectable chips (freezer pickers)
const CHIP_ON = "border-accent/50 bg-accent/12 text-accent";
const CHIP_OFF = "border-line-strong bg-surface-2 text-ink-2";
// Indigo-accent selectable chips (quantity picker)
const CHIP2_ON = "border-accent-2/50 bg-accent-2/15 text-accent-3";

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
  const check = on => cx("w-[18px] h-[18px] rounded-4 border-2 flex items-center justify-center text-11 text-white shrink-0", on ? "border-accent bg-accent" : "border-ink-dim bg-transparent");
  return <div ref={ref} className="relative">
    <button onClick={() => setOpen(!open)} className={cx("flex items-center gap-1.5 py-2 px-3.5 rounded-14 border text-ink text-13 font-bold cursor-pointer", open ? "border-accent/50 bg-accent/12" : "border-line-strong bg-surface")}><span>{lbl}</span><span className={cx("text-10 text-ink-3 transition-transform duration-200", open && "rotate-180")}>▼</span></button>
    {open && <div className="absolute top-[calc(100%+6px)] right-0 min-w-[220px] bg-surface-solid border border-line-strong rounded-16 p-1.5 z-60 shadow-pop">
      <button onClick={() => { toggle("all"); setOpen(false); }} className={cx("w-full flex items-center gap-2.5 py-2.5 px-3 rounded-12 border-none text-14 font-semibold cursor-pointer text-left", allSel ? "bg-accent/12 text-accent" : "bg-transparent text-ink-2")}><span className={check(allSel)}>{allSel ? "✓" : ""}</span> Vse</button>
      {freezers.map(f => { const on = allSel || selected.includes(f.id); return <button key={f.id} onClick={() => toggle(f.id)} className={cx("w-full flex items-center gap-2.5 py-2.5 px-3 rounded-12 border-none text-14 font-semibold cursor-pointer text-left", (!allSel && on) ? "bg-accent/8" : "bg-transparent", on ? "text-ink" : "text-ink-3")}><span className={check(!allSel && on)}>{(!allSel && on) ? "✓" : ""}</span> {f.icon} {f.name}</button>; })}
      {/* ADD NEW FREEZER */}
      <div className="border-t border-line-strong mt-1.5 pt-1.5">
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)} className="w-full flex items-center gap-2 py-2.5 px-3 rounded-12 border-none bg-transparent text-accent text-13 font-semibold cursor-pointer text-left">+ Nov zamrzovalnik</button>
        ) : (
          <div className="py-2 px-1.5 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1">{FICONS.map(ic => <button key={ic} onClick={() => setNewIcon(ic)} className={cx("text-20 rounded-8 p-1 border cursor-pointer", newIcon === ic ? "bg-accent/13 border-accent/50" : "bg-transparent border-transparent")}>{ic}</button>)}</div>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ime zamrzovalnika..." autoFocus className="w-full box-border py-2 px-2.5 bg-field border border-line-strong rounded-10 text-ink text-13 outline-none" onKeyDown={e => { if (e.key === "Enter") doAdd(); }} />
            <div className="flex gap-1.5">
              <button onClick={doAdd} disabled={!newName.trim()} className={cx("flex-1 p-2 rounded-10 border-none text-white text-13 font-bold", newName.trim() ? "bg-grad-primary cursor-pointer" : "bg-surface opacity-50 cursor-default")}>Dodaj</button>
              <button onClick={() => { setShowAdd(false); setNewName(""); }} className="flex-1 p-2 rounded-10 border border-line-strong bg-transparent text-ink-3 text-13 font-semibold cursor-pointer">Prekliči</button>
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
  return <div className="relative"><Input value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)} placeholder={placeholder} />{sug.length > 0 && <div className="absolute top-[calc(100%+4px)] inset-x-0 bg-surface-solid border border-line-strong rounded-12 p-1 z-10 shadow-pop">{sug.map((s, i) => <button key={i} onMouseDown={() => onChange(s)} className="w-full py-2.5 px-3.5 border-none rounded-8 bg-transparent text-ink text-14 cursor-pointer text-left font-medium">📎 {s}</button>)}</div>}</div>;
}

export default function FreezerModule({
  lang,
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
      <Screen>

        {/* MODAL — EDIT ARCHIVED ITEM */}
        {editArchived && (
          <Modal onClose={() => setEditArchived(null)}>
            <h3 className="text-18 font-bold mb-4">{t('urediArhiv')}{editArchived.name}</h3>
            <div className="mb-3">
              <Label>{t('ime')}</Label>
              <Input value={editArchived.name} onChange={e => setEditArchived(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="mb-5">
              <Label>{t('količina')}</Label>
              <Input value={editArchived.qty} onChange={e => setEditArchived(p => ({ ...p, qty: e.target.value }))} />
            </div>
            <div className="flex gap-2 mb-2.5">
              <button onClick={async () => {
                await dbUpdateArchived(editArchived.id, { name: editArchived.name, qty: editArchived.qty });
                setEditArchived(null);
              }} className="flex-1 p-3.25 rounded-14 border-none bg-grad-primary text-white text-15 font-bold cursor-pointer">{t('shrani')}</button>
              <button onClick={() => setEditArchived(null)} className="flex-1 p-3.25 rounded-14 border border-line-strong bg-transparent text-ink-3 text-15 font-semibold cursor-pointer">{t('prekliči')}</button>
            </div>
            <button onClick={() => setConfirmAction({
              message: t('izbrišiVprašanje'),
              onConfirm: async () => {
                await dbDeleteArchived(editArchived.id);
                setEditArchived(null);
              },
            })} className="w-full p-3.25 rounded-14 border border-danger/30 bg-danger/10 text-danger text-15 font-semibold cursor-pointer">{t('izbrišiArhiv')}</button>
            <button onClick={() => setConfirmAction({
              message: t('vrniVprašanje'),
              onConfirm: async () => {
                await dbUnarchiveItem(editArchived);
                setEditArchived(null);
              },
            })} className="w-full p-3.25 mt-2 rounded-14 border border-success/30 bg-success/10 text-success text-15 font-semibold cursor-pointer">{t('vrniVZamrzovalnik')}</button>
          </Modal>
        )}

        <div className="relative z-1 pt-4 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 pt-3 mb-4">
            <button onClick={() => setShowArchive(false)} className={BACK_BTN}>{t('nazaj')}</button>
            <h2 className="text-20 font-extrabold">{t('arhiv')}</h2>
          </div>

          {/* Search */}
          <div className="relative mb-3"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-14 text-ink-dim">🔍</span><input value={archSearch} onChange={e => setArchSearch(e.target.value)} placeholder={t('išičVArhivu')} className={SEARCH_INP} />{archSearch && <button onClick={() => setArchSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-ink-3 text-16 cursor-pointer">✕</button>}</div>

          {/* Category filter pills */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            <Pill small active={archCatF.length === 0} onClick={() => setArchCatF([])}>{t('vse')}</Pill>
            {Object.entries(categories).map(([k, v]) => {
              const cnt = archived.filter(a => a.cat === k).length;
              return cnt ? <Pill key={k} small active={archCatF.includes(k)} color={v.color} onClick={() => setArchCatF(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k])}>{v.icon} {cnt}</Pill> : null;
            })}
          </div>

          {/* Stats row with waste tracking */}
          <div className="grid grid-cols-4 gap-1.5 mb-3.5">
            {[
              [t('zadetki'), tot, "text-accent", "text-ink-3"],
              [t('povprMes'), mc ? Math.round(tot / mc) : 0, "text-accent-3", "text-ink-3"],
              [t('porabljeno2'), usedCount, "text-success", "text-success"],
              [t('zavrženo'), wastedCount, "text-danger", "text-danger"],
            ].map(([l, v, valCls, lblCls]) => (
              <div key={l} className="bg-surface rounded-14 py-2.5 px-2 border border-line text-center">
                <div className={cx("text-9 uppercase tracking-[1px] font-semibold", lblCls)}>{l}</div>
                <div className={cx("text-22 font-extrabold mt-0.5", valCls)}>{v}</div>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-1.5 mb-3.5">
            <Pill small active={archView === "monthly"} onClick={() => setArchView("monthly")}>{t('mesečno')}</Pill>
            <Pill small active={archView === "category"} onClick={() => setArchView("category")}>{t('kategorije')}</Pill>
            <Pill small active={archView === "item"} onClick={() => setArchView("item")}>{t('poIzdelku')}</Pill>
          </div>

          {tot === 0 && <EmptyState icon="📭">{t('niZadetkov')}</EmptyState>}

          {/* MONTHLY VIEW */}
          {archView === "monthly" && Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([k, { label, items: mi }]) => (
            <div key={k} className="mb-4">
              <div className="flex justify-between mb-1.5">
                <h3 className="text-14 font-bold text-ink-2 capitalize">{label}</h3>
                <span className="text-12 text-ink-dim font-semibold">{mi.length}</span>
              </div>
              {mi.map((it, i) => {
                const cat = categories[it.cat] || CATS.drugo;
                return (
                  <div key={it.id + "-" + i} onClick={() => setEditArchived(it)} className={cx("flex items-center gap-2.5 py-2.25 px-3 rounded-12 mb-[3px] border cursor-pointer", it.wasted ? "bg-danger/6 border-danger/15" : "bg-surface-2 border-line")}>
                    <span className="text-18">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={cx("text-13 font-semibold", it.wasted ? "text-danger" : "text-ink")}>{it.name} {it.wasted && <span className="text-11 opacity-70">· zavrženo</span>}</div>
                      <div className="text-11 text-ink-dim">{it.qty}{it.packets > 1 ? " / " + it.packets + "p" : ""}{it.label ? " · " + it.label : ""}</div>
                    </div>
                    <div className="text-11 text-ink-dim shrink-0">{fmtD(it.archived_at)}</div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* CATEGORY VIEW */}
          {archView === "category" && Object.entries(byCat).sort((a, b) => b[1].length - a[1].length).map(([ck, ci]) => {
            const cat = categories[ck] || CATS.drugo;
            return (
              <div key={ck} className="mb-4" style={{ "--cat": cat.color }}>
                <div className="flex justify-between mb-1.5">
                  <h3 className="text-14 font-bold text-(--cat)">{cat.icon} {cat.label}</h3>
                  <span className="text-12 text-ink-dim font-semibold">{ci.length}</span>
                </div>
                <div className="h-1.5 rounded-[3px] bg-surface mb-2 overflow-hidden">
                  <div className="h-full rounded-[3px] bg-(--cat) opacity-70" style={{ width: Math.min(100, (ci.length / tot) * 300) + "%" }} />
                </div>
                {ci.slice(0, 5).map((it, i) => (
                  <div key={it.id + "-" + i} onClick={() => setEditArchived(it)} className={cx("flex items-center gap-2.5 py-[7px] px-3 rounded-10 mb-[3px] cursor-pointer", it.wasted ? "bg-danger/6" : "bg-surface-2/60")}>
                    <div className={cx("flex-1 text-13 font-medium", it.wasted ? "text-danger" : "text-ink")}>{it.name}{it.wasted ? " · zavrženo" : ""}</div>
                    <div className="text-11 text-ink-dim">{it.qty}</div>
                    <div className="text-11 text-ink-dim">{fmtD(it.archived_at)}</div>
                  </div>
                ))}
                {ci.length > 5 && <div className="text-12 text-ink-dim py-1 px-3">+ še {ci.length - 5}</div>}
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
              <div key={name} className="mb-4" style={{ "--cat": cat.color }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-20">{cat.icon}</span>
                  <div>
                    <div className="text-14 font-bold text-ink">{name}</div>
                    <div className="text-12 font-semibold text-(--cat)">
                      Skupaj: {ie.length}× | {cat.label}
                      {wastedInItem > 0 && <span className="text-danger"> · {wastedInItem}× zavrženo</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-[3px] items-end h-[50px] px-1 mb-1">
                  {Object.entries(mb).sort((a, b) => a[0].localeCompare(b[0])).map(([k, { count }]) => (
                    <div key={k} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className="text-10 text-ink-3 font-bold">{count}</div>
                      <div className="w-full max-w-7 bg-(--cat) rounded-4 opacity-60" style={{ height: Math.max(8, (count / mx) * 36) }} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-[3px] px-1">
                  {Object.entries(mb).sort((a, b) => a[0].localeCompare(b[0])).map(([k, { label }]) => (
                    <div key={k} className="flex-1 text-center text-9 text-ink-dim font-semibold">{label}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
      </Screen>
    );
  }

  // ═══════════════════════════
  // FREEZER HOME
  // ═══════════════════════════
  if (screen === "home") {
    return (
      <Screen>
        <div className="relative z-1 pt-4 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">

          <div className="flex justify-between items-start pt-3 mb-3.5">
            <LogoToggle mode="freezer" onToggle={onToggleMode} />
            <div className="flex gap-2 items-center">
              <FreezerDD freezers={freezers} selected={selFrzs} onChange={setSelFrzs} onAdd={dbAddFreezer} />
              <IconButton onClick={() => { setShowArchive(true); setArchSearch(""); setArchCatF([]); }}>📦</IconButton>
              <IconButton onClick={onOpenSettings}>⚙️</IconButton>
            </div>
          </div>

          {(expC > 0 || warnC > 0) && <div className="flex gap-1.5 mb-3 flex-wrap">
            {expC > 0 && <button onClick={() => setFilterStatus(filterStatus === "expired" ? null : "expired")} className={cx("text-danger text-12 font-bold py-1.5 px-3 rounded-20 border cursor-pointer", filterStatus === "expired" ? "bg-danger/25 border-danger/60" : "bg-danger/12 border-danger/25")}>🔴 {expC} poteklo</button>}
            {warnC > 0 && <button onClick={() => setFilterStatus(filterStatus === "warning" ? null : "warning")} className={cx("text-amber text-12 font-bold py-1.5 px-3 rounded-20 border cursor-pointer", filterStatus === "warning" ? "bg-amber/20 border-amber/50" : "bg-amber/10 border-amber/20")}>🟠 {warnC} kmalu</button>}
            {filterStatus && <button onClick={() => setFilterStatus(null)} className="bg-transparent border border-line-strong rounded-20 py-1.5 px-3 text-ink-3 text-12 font-semibold cursor-pointer">✕</button>}
          </div>}

          <div className={cx("flex gap-2", showCatFilter ? "mb-2" : "mb-3")}>
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-14 text-ink-dim">🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('išči')} className={cx(SEARCH_INP, search && "pr-[38px]")} />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-ink-3 text-16 cursor-pointer leading-none">✕</button>}
            </div>
            <button onClick={() => setShowCatFilter(!showCatFilter)} className={cx("w-[46px] h-[46px] rounded-14 shrink-0 border text-18 cursor-pointer flex items-center justify-center relative", (showCatFilter || filterCat.length > 0) ? "border-accent-2/50 bg-accent-2/12 text-accent-3" : "border-line-strong bg-surface text-ink-3")}>☰{filterCat.length > 0 && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-3" />}</button>
          </div>

          {showCatFilter && <div className="flex flex-wrap gap-1.5 mb-3 py-2.5 px-3 bg-surface-2 rounded-14 border border-line"><Pill small active={filterCat.length === 0} onClick={() => setFilterCat([])}>Vse</Pill>{Object.entries(categories).map(([k, v]) => { const cnt = vis.filter(i => i.cat === k).length; return cnt ? <Pill key={k} small active={filterCat.includes(k)} color={v.color} onClick={() => setFilterCat(prev => prev.includes(k) ? prev.filter(c => c !== k) : [...prev, k])}>{v.icon} {v.label} ({cnt})</Pill> : null; })}</div>}

          {/* Items with swipe */}
          <div className="flex flex-col gap-1.5">
            {filtered.map(item => {
              const cat = categories[item.cat] || CATS.drugo;
              const status = getSt(item);
              const frz = freezers.find(f => f.id === item.freezer);
              return (
                <SwipeCard key={item.id} onSwipeLeft={() => doArchive(item, false)} onClick={() => { setShowDetail(item); setEditMode(false); }}>
                  <div style={{ "--cat": cat.color }} className={cx("border rounded-16 py-3 px-3.5 cursor-pointer relative overflow-hidden", STATUS_CARD[status])}>
                    <div className="absolute left-0 inset-y-0 w-1 bg-(--cat) rounded-l-16" />
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2.5 pl-2 flex-1 min-w-0">
                        <span className="text-24 shrink-0">{cat.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-[5px]">
                            <span className="text-14 font-bold text-ink whitespace-nowrap overflow-hidden text-ellipsis">{item.packets > 1 && <span className="text-accent-3">{item.packets}x </span>}{item.name}</span>
                            {item.sticky && <span className="text-10">📌</span>}
                          </div>
                          <div className="text-11 text-ink-3 flex gap-[3px] flex-wrap items-center">
                            <span>{item.qty}{item.packets > 1 ? " · " + item.packets + "p" : ""}</span>
                            {allF && frz && <><span>·</span><span>{frz.icon}</span></>}
                            {item.label && <><span>·</span><span className="text-accent-3 font-semibold">{item.label}</span></>}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className={cx("text-12 font-extrabold py-[3px] px-2 rounded-8 inline-block mb-0.5", STATUS_BADGE[status])}>{wksShort(item.expiry)}</div>
                        <div className="text-10 text-ink-dim">{fmtD(item.expiry)}</div>
                      </div>
                    </div>
                  </div>
                </SwipeCard>
              );
            })}
          </div>

          {filtered.length === 0 && <EmptyState icon={items.length === 0 ? "❄️" : "🔍"}>{items.length === 0 ? "Zamrzovalnik je prazen!" : "Ni zadetkov"}</EmptyState>}
        </div>

        <Fab onClick={() => { const df = selFrzs.length === 1 ? selFrzs[0] : "home"; setAddData({ name: "", cat: "", qty: "", packets: 1, label: "", frozen: localDateStr(), expiry: "", freezer: df }); setAddStep(0); setSuggestions([]); setScreen("add"); }} />

        {/* DETAIL MODAL - REDESIGNED */}
        {showDetail && (() => {
          const item = showDetail;
          const cat = categories[item.cat] || CATS.drugo;
          const status = getSt(item);
          const frz = freezers.find(f => f.id === item.freezer);

          if (editMode && editData) {
            return (
              <Modal onClose={() => setEditMode(false)}>
                <h3 className="text-18 font-extrabold mb-5 text-center">✏️ Uredi izdelek</h3>
                <Label>Ime</Label>
                <Input value={editData.name} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="mb-3.5" />
                <Label>Kategorija</Label>
                <div className="flex flex-wrap gap-1.5 mb-3.5">{Object.entries(categories).map(([k, v]) => <button key={k} onClick={() => setEditData(d => ({ ...d, cat: k }))} style={{ "--cat": v.color }} className={cx("py-[7px] px-[11px] rounded-12 text-12 font-semibold cursor-pointer border", editData.cat === k ? "border-(--cat)/50 bg-(--cat)/13 text-(--cat)" : "border-line-strong bg-surface-2 text-ink-2")}>{v.icon} {v.label}</button>)}</div>
                <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                  <div><Label>Količina</Label><Input value={editData.qty} onChange={e => setEditData(d => ({ ...d, qty: e.target.value }))} /></div>
                  <div><Label>Paketi</Label><div className="flex items-center gap-2"><button onClick={() => setEditData(d => ({ ...d, packets: Math.max(1, d.packets - 1) }))} className="w-10 h-[46px] rounded-10 border border-line-strong bg-surface text-ink-2 text-20 cursor-pointer">−</button><span className="text-20 font-extrabold min-w-6 text-center">{editData.packets}</span><button onClick={() => setEditData(d => ({ ...d, packets: d.packets + 1 }))} className="w-10 h-[46px] rounded-10 border border-accent-2/30 bg-accent-2/10 text-accent-3 text-20 cursor-pointer">+</button></div></div>
                </div>
                <Label>Labela</Label>
                <LabelInp value={editData.label} onChange={v => setEditData(d => ({ ...d, label: v }))} labels={existingLabels} placeholder="opcijsko" />
                <div className="h-3.5" />
                <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                  <div><Label>Zamrznjeno</Label><Input type="date" value={editData.frozen} onChange={e => setEditData(d => ({ ...d, frozen: e.target.value }))} /></div>
                  <div><Label>Rok uporabe</Label><Input type="date" value={editData.expiry} onChange={e => setEditData(d => ({ ...d, expiry: e.target.value }))} /></div>
                </div>
                <Label>Zamrzovalnik</Label>
                <div className="flex gap-1.5 flex-wrap mb-5">{freezers.map(f => <button key={f.id} onClick={() => setEditData(d => ({ ...d, freezer: f.id }))} className={cx("py-2.25 px-3.5 rounded-12 border text-13 font-bold cursor-pointer", editData.freezer === f.id ? CHIP_ON : CHIP_OFF)}>{f.icon} {f.name}</button>)}</div>
                <Btn v="success" onClick={async () => { await dbUpdateItem(editData.id, { name: editData.name, cat: editData.cat, qty: editData.qty, packets: editData.packets, label: editData.label, frozen: editData.frozen, expiry: editData.expiry, freezer: editData.freezer }); setShowDetail(editData); setEditMode(false); }}>💾 Shrani</Btn>
                <Btn v="ghost" onClick={() => setEditMode(false)} className="mt-2">Prekliči</Btn>
              </Modal>
            );
          }

          return (
            <Modal onClose={() => setShowDetail(null)}>
              {/* Redesigned detail layout */}
              <div className="text-center mb-3">
                <span className="text-56">{cat.icon}</span>
                <h2 className="text-22 font-extrabold mt-2 mb-1">{item.name}</h2>
                {/* Status with full text */}
                <div className={cx("text-15 font-bold mb-1", STATUS_TEXT[status])}>{wksUntil(item.expiry)}</div>
              </div>

              {/* Key info: frozen date + expiry first */}
              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                <FC label="Zamrznjeno" value={fmtD(item.frozen)} />
                <FC label="Rok uporabe" value={fmtD(item.expiry)} />
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                <FC label="Količina" value={item.qty + (item.packets > 1 ? " / " + item.packets + " pak." : "")} />
                <FC label="Zamrzovalnik" value={frz ? frz.icon + " " + frz.name : "—"} />
              </div>
              {/* Category + label row */}
              <div className={cx("grid gap-2.5 mb-4", item.label ? "grid-cols-2" : "grid-cols-1")}>
                <FC label="Kategorija" value={cat.label} />
                {item.label && <FC label="Labela" value={item.label} />}
              </div>

              {/* Quick packet decrement */}
              {item.packets > 1 && (
                <div className="flex items-center justify-between py-3 px-4 bg-accent-2/6 border border-accent-2/15 rounded-14 mb-3.5">
                  <div><div className="text-13 font-bold text-accent-3">Odštej paket</div><div className="text-12 text-ink-3">Trenutno: {item.packets}</div></div>
                  <button onClick={async () => { const newP = item.packets - 1; await dbUpdateItem(item.id, { packets: newP }); setShowDetail({ ...item, packets: newP }); }} className="w-11 h-11 rounded-12 border border-accent-2/40 bg-accent-2/15 text-accent-3 text-20 font-bold cursor-pointer flex items-center justify-center">−1</button>
                </div>
              )}

              {/* Action buttons - redesigned */}
              <div className="flex gap-2 mb-2">
                <button onClick={() => doArchive(item, false)} className="flex-3 p-3.75 rounded-14 border-none bg-grad-success text-white text-16 font-bold cursor-pointer">✓ Uporabljeno</button>
                <button onClick={() => doArchive(item, true)} className="flex-1 p-3.75 rounded-14 border border-danger/30 bg-danger/10 text-danger text-14 font-bold cursor-pointer">🗑</button>
              </div>
              <div className="flex gap-2 mb-2">
                <button onClick={() => { setEditData({ ...item }); setEditMode(true); }} className="flex-1 p-3 rounded-14 border border-accent/30 bg-accent/8 text-accent text-14 font-semibold cursor-pointer">✏️ Uredi</button>
                <button onClick={async () => { await dbUpdateItem(item.id, { sticky: !item.sticky }); setShowDetail({ ...item, sticky: !item.sticky }); }} className={cx("flex-1 p-3 rounded-14 border border-line-strong text-14 font-semibold cursor-pointer", item.sticky ? "bg-amber/10 text-amber" : "bg-surface text-ink-2")}>{item.sticky ? "📌 Odpni" : "📌 Pripni"}</button>
                <button onClick={async () => { await dbDeleteItem(item.id); setShowDetail(null); }} className="flex-1 p-3 rounded-14 border border-danger/15 bg-transparent text-ink-3 text-14 font-semibold cursor-pointer">Zbriši</button>
              </div>
            </Modal>
          );
        })()}
        <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
      </Screen>
    );
  }

  // ═══════════════════════════
  // FREEZER - ADD (SIMPLIFIED)
  // ═══════════════════════════
  const stepLabels = addStep < 2 ? [t('korak1'), t('korak2')] : [t('korak1'), t('korak2'), t('korak3')];

  return (
    <Screen>
      <div className="relative z-1 pt-4 px-4 pb-[calc(100px+env(safe-area-inset-bottom))] min-h-screen">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => { if (addStep === 0) setScreen("home"); else setAddStep(addStep - 1); }} className={BACK_BTN}>{t('nazaj')}</button>
          <h2 className="text-18 font-extrabold">{t('dodajVZamrzovalnik')}</h2>
          <button onClick={() => setScreen("home")} className="bg-field border border-line-strong rounded-12 w-10 h-10 text-ink-2 text-18 cursor-pointer flex items-center justify-center">✕</button>
        </div>

        {/* Progress - only show active steps */}
        <div className="flex gap-1.5 mb-7">
          {stepLabels.map((l, i) => <div key={i} className="flex-1 text-center"><div className={cx("h-1 rounded-2 mb-1.5", i <= addStep ? "bg-grad-primary" : "bg-handle/50")} /><span className={cx("text-11 font-semibold", i <= addStep ? "text-accent" : "text-ink-dim")}>{l}</span></div>)}
        </div>

        {/* STEP 0: Name + Category */}
        {addStep === 0 && (
          <div>
            <Label>{t('kajZamrzuješ')}</Label>
            <input ref={inputRef} value={addData.name} onChange={e => { setAddData(d => ({ ...d, name: e.target.value })); setSuggestions(e.target.value.length >= 2 ? SUGG.filter(s => s.n.toLowerCase().includes(e.target.value.toLowerCase())).slice(0, 5) : []); }} placeholder={t('primerekIskanja')} className="w-full box-border px-4 py-3.5 bg-field border border-field-line rounded-14 text-ink outline-none font-medium text-17" />
            {suggestions.length > 0 && <div className="mt-2 flex flex-col gap-1">{suggestions.map((s, i) => { const cat = categories[s.c] || CATS[s.c]; return <button key={i} onClick={() => { const exp = new Date(addData.frozen); exp.setMonth(exp.getMonth() + (cat?.months || 6)); setAddData(d => ({ ...d, name: s.n, cat: s.c, expiry: localDateStr(exp) })); setSuggestions([]); setAddStep(1); }} style={{ "--cat": cat?.color }} className="flex items-center gap-3 py-3.25 px-3.5 bg-field border border-line-strong rounded-14 text-ink text-15 cursor-pointer text-left"><span className="text-22">{cat?.icon}</span><div><div className="font-semibold">{s.n}</div><div className="text-12 font-semibold text-(--cat)">{cat?.label} · rok {cat?.months} mes.</div></div></button>; })}</div>}
            {addData.name.length >= 2 && suggestions.length === 0 && <div className="mt-4"><p className="text-13 text-ink-3 mb-2.5">{t('izberiKategorijo')}</p><div className="grid grid-cols-3 gap-2">{Object.entries(categories).map(([k, v]) => <button key={k} onClick={() => { const exp = new Date(addData.frozen); exp.setMonth(exp.getMonth() + (v.months || 6)); setAddData(d => ({ ...d, cat: k, expiry: localDateStr(exp) })); setAddStep(1); }} style={{ "--cat": v.color }} className="py-3.5 px-1.5 bg-surface border border-line rounded-14 text-ink cursor-pointer text-center"><div className="text-24 mb-1">{v.icon}</div><div className="text-11 font-semibold text-(--cat)">{v.label}</div></button>)}</div></div>}
          </div>
        )}

        {/* STEP 1: Quantity + Quick summary + ADD or MORE OPTIONS */}
        {addStep === 1 && (
          <div>
            <div className="text-center mb-5" style={{ "--cat": (categories[addData.cat] || CATS[addData.cat])?.color }}>
              <span className="text-44">{(categories[addData.cat] || CATS[addData.cat])?.icon}</span>
              <h3 className="text-20 font-bold mt-2">{addData.name}</h3>
              <span className="text-13 font-semibold text-(--cat)">{(categories[addData.cat] || CATS[addData.cat])?.label}</span>
            </div>

            <Label>{t('količina')}</Label>
            <Input ref={inputRef} value={addData.qty} onChange={e => setAddData(d => ({ ...d, qty: e.target.value }))} placeholder="npr. 500g, 2 kosa, 1L" className="mb-2" />
            <div className="flex gap-1.5 flex-wrap mb-5">
              {QO.map(q => <button key={q} onClick={() => setAddData(d => ({ ...d, qty: q }))} className={cx("py-2 px-3 rounded-12 border text-13 font-semibold cursor-pointer", addData.qty === q ? CHIP2_ON : CHIP_OFF)}>{q}</button>)}
            </div>

            {/* Auto-summary */}
            <div className="py-3.5 px-4 bg-surface-2 rounded-14 border border-line mb-5">
              <div className="flex justify-between text-13 text-ink-2 mb-1.5">
                <span>{t('rokUporabe')}:</span>
                <span className="text-success font-bold">{addData.expiry ? fmtD(addData.expiry) : fmtD(recalc(addData.frozen, addData.cat))}</span>
              </div>
              <div className="flex justify-between text-13 text-ink-2">
                <span>{t('zamrzovalnik')}:</span>
                <span className="text-ink font-semibold">{freezers.find(f => f.id === addData.freezer)?.icon} {freezers.find(f => f.id === addData.freezer)?.name}</span>
              </div>
            </div>

            <Btn v="success" disabled={!addData.qty} onClick={async () => {
              const exp = addData.expiry || recalc(addData.frozen, addData.cat);
              await dbAddItem({ name: addData.name, cat: addData.cat, qty: addData.qty, packets: 1, label: "", frozen: addData.frozen, expiry: exp, freezer: addData.freezer, sticky: false });
              setScreen("home");
            }}>{t('dodajVZamrzovalnik')}</Btn>
            <Btn v="ghost" disabled={!addData.qty} onClick={() => setAddStep(2)} className="mt-2">{t('večOpcij')}</Btn>
          </div>
        )}

        {/* STEP 2: More options - packets, label, edit dates, freezer */}
        {addStep === 2 && (
          <div>
            <div className="text-center mb-5">
              <span className="text-44">{(categories[addData.cat] || CATS[addData.cat])?.icon}</span>
              <h3 className="text-20 font-bold mt-2">{addData.name}</h3>
              <span className="text-13 text-ink-3">{addData.qty} · {(categories[addData.cat] || CATS[addData.cat])?.label}</span>
            </div>

            <Label>{t('paketi')}</Label>
            <div className="flex items-center gap-3 mb-4.5">
              <button onClick={() => setAddData(d => ({ ...d, packets: Math.max(1, d.packets - 1) }))} className={STEPPER_MINUS}>−</button>
              <span className="text-24 font-extrabold min-w-8 text-center">{addData.packets}</span>
              <button onClick={() => setAddData(d => ({ ...d, packets: d.packets + 1 }))} className={STEPPER_PLUS}>+</button>
              <span className="text-13 text-ink-3">{t('paketov')}</span>
            </div>

            <Label>{t('labela')} <span className="font-normal text-ink-dim">({t('opcijsko')})</span></Label>
            <LabelInp value={addData.label} onChange={v => setAddData(d => ({ ...d, label: v }))} labels={existingLabels} placeholder={t('primerekLabele')} />
            <div className="h-4" />

            <div className="grid grid-cols-2 gap-2.5 mb-3.5">
              <div><Label>{t('zamrznjeno')}</Label><Input type="date" value={addData.frozen} onChange={e => { const f = e.target.value; setAddData(d => ({ ...d, frozen: f, expiry: recalc(f, d.cat) })); }} /></div>
              <div><Label>{t('rokUporabe')}</Label><Input type="date" value={addData.expiry || recalc(addData.frozen, addData.cat)} onChange={e => setAddData(d => ({ ...d, expiry: e.target.value }))} /></div>
            </div>

            <Label>{t('zamrzovalnik')}</Label>
            <div className="flex gap-2 flex-wrap mb-6">
              {freezers.map(f => <button key={f.id} onClick={() => setAddData(d => ({ ...d, freezer: f.id }))} className={cx("py-2.5 px-4 rounded-14 border text-14 font-bold cursor-pointer", addData.freezer === f.id ? CHIP_ON : CHIP_OFF)}>{f.icon} {f.name}</button>)}
            </div>

            <Btn v="success" onClick={async () => {
              const exp = addData.expiry || recalc(addData.frozen, addData.cat);
              await dbAddItem({ name: addData.name, cat: addData.cat, qty: addData.qty, packets: addData.packets, label: addData.label, frozen: addData.frozen, expiry: exp, freezer: addData.freezer, sticky: false });
              setScreen("home");
            }}>{t('dodajVZamrzovalnik')}</Btn>
          </div>
        )}
      </div>
    </Screen>
  );
}
