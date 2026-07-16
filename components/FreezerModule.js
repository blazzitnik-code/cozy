'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useT } from '@/lib/i18n';
import { normalizujNiz } from '@/lib/hooks';
import { CATS, SUGG, FICONS, QO } from '@/lib/constants';
import { getSt, fmtD, wksUntil, wksShort, localDateStr, cx, STATUS_TEXT, STATUS_CARD, STATUS_BADGE } from '@/lib/utils';
import {
  Screen,
  Pill,
  FC,
  Btn,
  Modal,
  ConfirmModal,
  SwipeCard,
  LogoToggle,
  Input,
  Label,
  IconButton,
  EmptyState,
  Fab,
} from './ui';

// Repeated class recipes local to this module
const BACK_BTN =
  'bg-white/90 dark:bg-slate-800/80 border border-indigo-500/20 dark:border-slate-600/30 rounded-xl py-2.5 px-4 text-slate-500 dark:text-slate-400 text-sm cursor-pointer font-semibold';
const SEARCH_INP =
  'w-full box-border py-3.5 pr-4 pl-9.5 bg-white/90 dark:bg-slate-800/80 border border-indigo-500/20 dark:border-slate-600/30 rounded-xl text-slate-800 dark:text-slate-200 outline-none font-medium text-sm';
const STEPPER_MINUS =
  'w-11 h-11 rounded-xl border border-indigo-500/20 dark:border-slate-600/30 bg-white/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-2xl cursor-pointer flex items-center justify-center';
const STEPPER_PLUS =
  'w-11 h-11 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-2xl cursor-pointer flex items-center justify-center';
// Sky-accent selectable chips (freezer pickers)
const CHIP_ON = 'border-sky-400/50 bg-sky-400/12 text-sky-400';
const CHIP_OFF =
  'border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400';
// Indigo-accent selectable chips (quantity picker)
const CHIP2_ON = 'border-indigo-500/50 bg-indigo-500/15 text-indigo-400';

// ─── FREEZER DROPDOWN ───
function FreezerDD({ freezers, selected, onChange, onAdd }) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('🏠');
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const allSel = selected.length === 0;
  const lbl = allSel
    ? 'Vse'
    : selected.length === 1
      ? freezers.find((f) => f.id === selected[0])?.icon + ' ' + freezers.find((f) => f.id === selected[0])?.name
      : selected.length + ' izbrani';
  const toggle = (id) => {
    if (id === 'all') {
      onChange([]);
      return;
    }
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    onChange(next.length === freezers.length ? [] : next);
  };
  const doAdd = async () => {
    if (!newName.trim()) return;
    await onAdd({ name: newName.trim(), icon: newIcon });
    setNewName('');
    setNewIcon('🏠');
    setShowAdd(false);
    setOpen(false);
  };
  const check = (on) =>
    cx(
      'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border-2 text-xs text-white',
      on ? 'border-sky-400 bg-sky-400' : 'border-slate-300 bg-transparent dark:border-slate-600',
    );
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cx(
          'flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-bold text-slate-800 dark:text-slate-200',
          open
            ? 'border-sky-400/50 bg-sky-400/12'
            : 'border-indigo-500/20 bg-white/80 dark:border-slate-600/30 dark:bg-slate-800/60',
        )}
      >
        <span>{lbl}</span>
        <span
          className={cx(
            'text-[10px] text-slate-400 transition-transform duration-200 dark:text-slate-500',
            open && 'rotate-180',
          )}
        >
          ▼
        </span>
      </button>
      {open && (
        <div className="absolute top-[calc(100%+6px)] right-0 z-60 min-w-55 rounded-2xl border border-indigo-500/20 bg-white p-1.5 shadow-lg shadow-black/40 dark:border-slate-600/30 dark:bg-slate-800">
          <button
            onClick={() => {
              toggle('all');
              setOpen(false);
            }}
            className={cx(
              'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left text-sm font-semibold',
              allSel ? 'bg-sky-400/12 text-sky-400' : 'bg-transparent text-slate-500 dark:text-slate-400',
            )}
          >
            <span className={check(allSel)}>{allSel ? '✓' : ''}</span> Vse
          </button>
          {freezers.map((f) => {
            const on = allSel || selected.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={cx(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left text-sm font-semibold',
                  !allSel && on ? 'bg-sky-400/8' : 'bg-transparent',
                  on ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500',
                )}
              >
                <span className={check(!allSel && on)}>{!allSel && on ? '✓' : ''}</span> {f.icon} {f.name}
              </button>
            );
          })}
          {/* ADD NEW FREEZER */}
          <div className="mt-1.5 border-t border-indigo-500/20 pt-1.5 dark:border-slate-600/30">
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-sky-400"
              >
                + Nov zamrzovalnik
              </button>
            ) : (
              <div className="flex flex-col gap-2 px-1.5 py-2">
                <div className="flex flex-wrap gap-1">
                  {FICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setNewIcon(ic)}
                      className={cx(
                        'cursor-pointer rounded-lg border p-1 text-xl',
                        newIcon === ic ? 'border-sky-400/50 bg-sky-400/13' : 'border-transparent bg-transparent',
                      )}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ime zamrzovalnika..."
                  autoFocus
                  className="box-border w-full rounded-lg border border-indigo-500/20 bg-white/90 px-2.5 py-2 text-sm text-slate-800 outline-none dark:border-slate-600/30 dark:bg-slate-800/80 dark:text-slate-200"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') doAdd();
                  }}
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={doAdd}
                    disabled={!newName.trim()}
                    className={cx(
                      'flex-1 rounded-lg border-none p-2 text-sm font-bold text-white',
                      newName.trim()
                        ? 'cursor-pointer bg-linear-135 from-sky-500 to-indigo-500'
                        : 'cursor-default bg-white/80 opacity-50 dark:bg-slate-800/60',
                    )}
                  >
                    Dodaj
                  </button>
                  <button
                    onClick={() => {
                      setShowAdd(false);
                      setNewName('');
                    }}
                    className="flex-1 cursor-pointer rounded-lg border border-indigo-500/20 bg-transparent p-2 text-sm font-semibold text-slate-400 dark:border-slate-600/30 dark:text-slate-500"
                  >
                    Prekliči
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LabelInp({ value, onChange, labels, placeholder }) {
  const [focused, setFocused] = useState(false);
  const sug = useMemo(() => {
    if (!focused || !labels.length) return [];
    if (!value) return labels.slice(0, 5);
    return labels.filter((l) => l.toLowerCase().includes(value.toLowerCase()) && l !== value).slice(0, 5);
  }, [value, focused, labels]);
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
      />
      {sug.length > 0 && (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-10 rounded-xl border border-indigo-500/20 bg-white p-1 shadow-lg shadow-black/40 dark:border-slate-600/30 dark:bg-slate-800">
          {sug.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => onChange(s)}
              className="w-full cursor-pointer rounded-lg border-none bg-transparent px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              📎 {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FreezerModule({
  lang,
  items,
  dbAddItem,
  dbUpdateItem,
  dbDeleteItem,
  archived,
  dbArchiveItem,
  dbUpdateArchived,
  dbDeleteArchived,
  dbUnarchiveItem,
  freezers,
  dbAddFreezer,
  categories,
  onToggleMode,
  onOpenSettings,
}) {
  const t = useT(lang);

  // ─── FREEZER UI STATE ───
  const [screen, setScreen] = useState('home');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState([]);
  const [filterStatus, setFilterStatus] = useState(null);
  const [showCatFilter, setShowCatFilter] = useState(false);
  const [selFrzs, setSelFrzs] = useState([]);
  const [showDetail, setShowDetail] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archView, setArchView] = useState('monthly');
  const [archSearch, setArchSearch] = useState('');
  const [editArchived, setEditArchived] = useState(null);
  const [archCatF, setArchCatF] = useState([]);
  const [addStep, setAddStep] = useState(0);
  const [addData, setAddData] = useState({
    name: '',
    cat: '',
    qty: '',
    packets: 1,
    label: '',
    frozen: localDateStr(),
    expiry: '',
    freezer: 'home',
  });
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  const existingLabels = useMemo(
    () => [...new Set([...items, ...archived].map((i) => i.label).filter(Boolean))],
    [items, archived],
  );

  useEffect(() => {
    if (screen === 'add' && inputRef.current) setTimeout(() => inputRef.current?.focus(), 120);
  }, [screen, addStep]);

  // ─── FREEZER LOGIC ───
  const allF = selFrzs.length === 0;
  const vis = allF ? items : items.filter((i) => selFrzs.includes(i.freezer));
  const expC = vis.filter((i) => getSt(i) === 'expired').length;
  const warnC = vis.filter((i) => getSt(i) === 'warning').length;
  const filtered = vis
    .filter((i) => {
      if (filterCat.length > 0 && !filterCat.includes(i.cat)) return false;
      if (filterStatus === 'expired' && getSt(i) !== 'expired') return false;
      if (filterStatus === 'warning' && getSt(i) !== 'warning') return false;
      if (
        search &&
        !normalizujNiz(i.name).includes(normalizujNiz(search)) &&
        !(i.label && normalizujNiz(i.label).includes(normalizujNiz(search)))
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (a.sticky && !b.sticky) return -1;
      if (!a.sticky && b.sticky) return 1;
      return new Date(a.expiry) - new Date(b.expiry);
    });

  function recalc(f, c) {
    const cat = categories[c] || CATS[c];
    const e = new Date(f);
    e.setMonth(e.getMonth() + (cat?.months || 6));
    return localDateStr(e);
  }

  async function doArchive(item, wasted = false) {
    await dbArchiveItem(item, wasted);
    setShowDetail(null);
  }

  // ═══════════════════════════
  // FREEZER - ARCHIVE (full v4 + waste)
  // ═══════════════════════════
  if (showArchive) {
    const fa = archived.filter((a) => {
      if (
        archSearch &&
        !a.name.toLowerCase().includes(archSearch.toLowerCase()) &&
        !(a.label && a.label.toLowerCase().includes(archSearch.toLowerCase()))
      )
        return false;
      if (archCatF.length > 0 && !archCatF.includes(a.cat)) return false;
      return true;
    });
    const byMonth = {};
    fa.forEach((a) => {
      const d = new Date(a.archived_at);
      const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!byMonth[k])
        byMonth[k] = { label: d.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' }), items: [] };
      byMonth[k].items.push(a);
    });
    const byCat = {};
    fa.forEach((a) => {
      if (!byCat[a.cat]) byCat[a.cat] = [];
      byCat[a.cat].push(a);
    });
    const byItem = {};
    fa.forEach((a) => {
      if (!byItem[a.name]) byItem[a.name] = { cat: a.cat, items: [] };
      byItem[a.name].items.push(a);
    });
    const tot = fa.length;
    const mc = Object.keys(byMonth).length;
    const wastedCount = fa.filter((a) => a.wasted).length;
    const usedCount = fa.filter((a) => !a.wasted).length;

    return (
      <Screen>
        {/* MODAL — EDIT ARCHIVED ITEM */}
        {editArchived && (
          <Modal onClose={() => setEditArchived(null)}>
            <h3 className="mb-4 text-lg font-bold">
              {t('urediArhiv')}
              {editArchived.name}
            </h3>
            <div className="mb-3">
              <Label>{t('ime')}</Label>
              <Input
                value={editArchived.name}
                onChange={(e) => setEditArchived((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="mb-5">
              <Label>{t('količina')}</Label>
              <Input
                value={editArchived.qty}
                onChange={(e) => setEditArchived((p) => ({ ...p, qty: e.target.value }))}
              />
            </div>
            <div className="mb-2.5 flex gap-2">
              <button
                onClick={async () => {
                  await dbUpdateArchived(editArchived.id, { name: editArchived.name, qty: editArchived.qty });
                  setEditArchived(null);
                }}
                className="flex-1 cursor-pointer rounded-xl border-none bg-linear-135 from-sky-500 to-indigo-500 p-3.25 text-base font-bold text-white"
              >
                {t('shrani')}
              </button>
              <button
                onClick={() => setEditArchived(null)}
                className="flex-1 cursor-pointer rounded-xl border border-indigo-500/20 bg-transparent p-3.25 text-base font-semibold text-slate-400 dark:border-slate-600/30 dark:text-slate-500"
              >
                {t('prekliči')}
              </button>
            </div>
            <button
              onClick={() =>
                setConfirmAction({
                  message: t('izbrišiVprašanje'),
                  onConfirm: async () => {
                    await dbDeleteArchived(editArchived.id);
                    setEditArchived(null);
                  },
                })
              }
              className="w-full cursor-pointer rounded-xl border border-red-500/30 bg-red-500/10 p-3.25 text-base font-semibold text-red-500"
            >
              {t('izbrišiArhiv')}
            </button>
            <button
              onClick={() =>
                setConfirmAction({
                  message: t('vrniVprašanje'),
                  onConfirm: async () => {
                    await dbUnarchiveItem(editArchived);
                    setEditArchived(null);
                  },
                })
              }
              className="mt-2 w-full cursor-pointer rounded-xl border border-green-500/30 bg-green-500/10 p-3.25 text-base font-semibold text-green-500"
            >
              {t('vrniVZamrzovalnik')}
            </button>
          </Modal>
        )}

        <div className="relative z-1 px-4 pt-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-center gap-3 pt-3">
            <button onClick={() => setShowArchive(false)} className={BACK_BTN}>
              {t('nazaj')}
            </button>
            <h2 className="text-xl font-extrabold">{t('arhiv')}</h2>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-slate-300 dark:text-slate-600">
              🔍
            </span>
            <input
              value={archSearch}
              onChange={(e) => setArchSearch(e.target.value)}
              placeholder={t('išičVArhivu')}
              className={SEARCH_INP}
            />
            {archSearch && (
              <button
                onClick={() => setArchSearch('')}
                className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer border-none bg-transparent text-base text-slate-400 dark:text-slate-500"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category filter pills */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Pill small active={archCatF.length === 0} onClick={() => setArchCatF([])}>
              {t('vse')}
            </Pill>
            {Object.entries(categories).map(([k, v]) => {
              const cnt = archived.filter((a) => a.cat === k).length;
              return cnt ? (
                <Pill
                  key={k}
                  small
                  active={archCatF.includes(k)}
                  color={v.color}
                  onClick={() => setArchCatF((prev) => (prev.includes(k) ? prev.filter((c) => c !== k) : [...prev, k]))}
                >
                  {v.icon} {cnt}
                </Pill>
              ) : null;
            })}
          </div>

          {/* Stats row with waste tracking */}
          <div className="mb-3.5 grid grid-cols-4 gap-1.5">
            {[
              [t('zadetki'), tot, 'text-sky-400', 'text-slate-400 dark:text-slate-500'],
              [t('povprMes'), mc ? Math.round(tot / mc) : 0, 'text-indigo-400', 'text-slate-400 dark:text-slate-500'],
              [t('porabljeno2'), usedCount, 'text-green-500', 'text-green-500'],
              [t('zavrženo'), wastedCount, 'text-red-500', 'text-red-500'],
            ].map(([l, v, valCls, lblCls]) => (
              <div
                key={l}
                className="rounded-xl border border-indigo-500/15 bg-white/80 px-2 py-2.5 text-center dark:border-slate-600/20 dark:bg-slate-800/60"
              >
                <div className={cx('text-[9px] font-semibold tracking-[1px] uppercase', lblCls)}>{l}</div>
                <div className={cx('mt-0.5 text-2xl font-extrabold', valCls)}>{v}</div>
              </div>
            ))}
          </div>

          {/* View toggle */}
          <div className="mb-3.5 flex gap-1.5">
            <Pill small active={archView === 'monthly'} onClick={() => setArchView('monthly')}>
              {t('mesečno')}
            </Pill>
            <Pill small active={archView === 'category'} onClick={() => setArchView('category')}>
              {t('kategorije')}
            </Pill>
            <Pill small active={archView === 'item'} onClick={() => setArchView('item')}>
              {t('poIzdelku')}
            </Pill>
          </div>

          {tot === 0 && <EmptyState icon="📭">{t('niZadetkov')}</EmptyState>}

          {/* MONTHLY VIEW */}
          {archView === 'monthly' &&
            Object.entries(byMonth)
              .sort((a, b) => b[0].localeCompare(a[0]))
              .map(([k, { label, items: mi }]) => (
                <div key={k} className="mb-4">
                  <div className="mb-1.5 flex justify-between">
                    <h3 className="text-sm font-bold text-slate-500 capitalize dark:text-slate-400">{label}</h3>
                    <span className="text-xs font-semibold text-slate-300 dark:text-slate-600">{mi.length}</span>
                  </div>
                  {mi.map((it, i) => {
                    const cat = categories[it.cat] || CATS.drugo;
                    return (
                      <div
                        key={it.id + '-' + i}
                        onClick={() => setEditArchived(it)}
                        className={cx(
                          'mb-[3px] flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.25',
                          it.wasted
                            ? 'border-red-500/15 bg-red-500/6'
                            : 'border-indigo-500/15 bg-white/70 dark:border-slate-600/20 dark:bg-slate-800/50',
                        )}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div
                            className={cx(
                              'text-sm font-semibold',
                              it.wasted ? 'text-red-500' : 'text-slate-800 dark:text-slate-200',
                            )}
                          >
                            {it.name} {it.wasted && <span className="text-xs opacity-70">· zavrženo</span>}
                          </div>
                          <div className="text-xs text-slate-300 dark:text-slate-600">
                            {it.qty}
                            {it.packets > 1 ? ' / ' + it.packets + 'p' : ''}
                            {it.label ? ' · ' + it.label : ''}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs text-slate-300 dark:text-slate-600">
                          {fmtD(it.archived_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

          {/* CATEGORY VIEW */}
          {archView === 'category' &&
            Object.entries(byCat)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([ck, ci]) => {
                const cat = categories[ck] || CATS.drugo;
                return (
                  <div key={ck} className="mb-4" style={{ '--cat': cat.color }}>
                    <div className="mb-1.5 flex justify-between">
                      <h3 className="text-sm font-bold text-(--cat)">
                        {cat.icon} {cat.label}
                      </h3>
                      <span className="text-xs font-semibold text-slate-300 dark:text-slate-600">{ci.length}</span>
                    </div>
                    <div className="mb-2 h-1.5 overflow-hidden rounded-xs bg-white/80 dark:bg-slate-800/60">
                      <div
                        className="h-full rounded-xs bg-(--cat) opacity-70"
                        style={{ width: Math.min(100, (ci.length / tot) * 300) + '%' }}
                      />
                    </div>
                    {ci.slice(0, 5).map((it, i) => (
                      <div
                        key={it.id + '-' + i}
                        onClick={() => setEditArchived(it)}
                        className={cx(
                          'mb-[3px] flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.75',
                          it.wasted ? 'bg-red-500/6' : 'bg-white/40 dark:bg-slate-800/30',
                        )}
                      >
                        <div
                          className={cx(
                            'flex-1 text-sm font-medium',
                            it.wasted ? 'text-red-500' : 'text-slate-800 dark:text-slate-200',
                          )}
                        >
                          {it.name}
                          {it.wasted ? ' · zavrženo' : ''}
                        </div>
                        <div className="text-xs text-slate-300 dark:text-slate-600">{it.qty}</div>
                        <div className="text-xs text-slate-300 dark:text-slate-600">{fmtD(it.archived_at)}</div>
                      </div>
                    ))}
                    {ci.length > 5 && (
                      <div className="px-3 py-1 text-xs text-slate-300 dark:text-slate-600">+ še {ci.length - 5}</div>
                    )}
                  </div>
                );
              })}

          {/* PER-ITEM VIEW with mini bar charts */}
          {archView === 'item' &&
            Object.entries(byItem)
              .sort((a, b) => b[1].items.length - a[1].items.length)
              .map(([name, { cat: ck, items: ie }]) => {
                const cat = categories[ck] || CATS.drugo;
                const wastedInItem = ie.filter((e) => e.wasted).length;
                const mb = {};
                ie.forEach((e) => {
                  const d = new Date(e.archived_at);
                  const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                  if (!mb[k])
                    mb[k] = { label: d.toLocaleDateString('sl-SI', { month: 'short', year: '2-digit' }), count: 0 };
                  mb[k].count++;
                });
                const mx = Math.max(...Object.values(mb).map((m) => m.count));
                return (
                  <div key={name} className="mb-4" style={{ '--cat': cat.color }}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-xl">{cat.icon}</span>
                      <div>
                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{name}</div>
                        <div className="text-xs font-semibold text-(--cat)">
                          Skupaj: {ie.length}× | {cat.label}
                          {wastedInItem > 0 && <span className="text-red-500"> · {wastedInItem}× zavrženo</span>}
                        </div>
                      </div>
                    </div>
                    <div className="mb-1 flex h-12.5 items-end gap-0.75 px-1">
                      {Object.entries(mb)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([k, { count }]) => (
                          <div key={k} className="flex flex-1 flex-col items-center gap-0.5">
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{count}</div>
                            <div
                              className="w-full max-w-7 rounded-sm bg-(--cat) opacity-60"
                              style={{ height: Math.max(8, (count / mx) * 36) }}
                            />
                          </div>
                        ))}
                    </div>
                    <div className="flex gap-0.75 px-1">
                      {Object.entries(mb)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([k, { label }]) => (
                          <div
                            key={k}
                            className="flex-1 text-center text-[9px] font-semibold text-slate-300 dark:text-slate-600"
                          >
                            {label}
                          </div>
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
  if (screen === 'home') {
    return (
      <Screen>
        <div className="relative z-1 px-4 pt-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
          <div className="mb-3.5 flex items-start justify-between pt-3">
            <LogoToggle mode="freezer" onToggle={onToggleMode} />
            <div className="flex items-center gap-2">
              <FreezerDD freezers={freezers} selected={selFrzs} onChange={setSelFrzs} onAdd={dbAddFreezer} />
              <IconButton
                onClick={() => {
                  setShowArchive(true);
                  setArchSearch('');
                  setArchCatF([]);
                }}
              >
                📦
              </IconButton>
              <IconButton onClick={onOpenSettings}>⚙️</IconButton>
            </div>
          </div>

          {(expC > 0 || warnC > 0) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {expC > 0 && (
                <button
                  onClick={() => setFilterStatus(filterStatus === 'expired' ? null : 'expired')}
                  className={cx(
                    'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold text-red-500',
                    filterStatus === 'expired' ? 'border-red-500/60 bg-red-500/25' : 'border-red-500/25 bg-red-500/12',
                  )}
                >
                  🔴 {expC} poteklo
                </button>
              )}
              {warnC > 0 && (
                <button
                  onClick={() => setFilterStatus(filterStatus === 'warning' ? null : 'warning')}
                  className={cx(
                    'cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold text-amber-500',
                    filterStatus === 'warning'
                      ? 'border-amber-500/50 bg-amber-500/20'
                      : 'border-amber-500/20 bg-amber-500/10',
                  )}
                >
                  🟠 {warnC} kmalu
                </button>
              )}
              {filterStatus && (
                <button
                  onClick={() => setFilterStatus(null)}
                  className="cursor-pointer rounded-full border border-indigo-500/20 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-400 dark:border-slate-600/30 dark:text-slate-500"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <div className={cx('flex gap-2', showCatFilter ? 'mb-2' : 'mb-3')}>
            <div className="relative flex-1">
              <span className="absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-slate-300 dark:text-slate-600">
                🔍
              </span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('išči')}
                className={cx(SEARCH_INP, search && 'pr-9.5')}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer border-none bg-transparent text-base leading-none text-slate-400 dark:text-slate-500"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => setShowCatFilter(!showCatFilter)}
              className={cx(
                'relative flex h-11.5 w-11.5 shrink-0 cursor-pointer items-center justify-center rounded-xl border text-lg',
                showCatFilter || filterCat.length > 0
                  ? 'border-indigo-500/50 bg-indigo-500/12 text-indigo-400'
                  : 'border-indigo-500/20 bg-white/80 text-slate-400 dark:border-slate-600/30 dark:bg-slate-800/60 dark:text-slate-500',
              )}
            >
              ☰
              {filterCat.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-indigo-400" />
              )}
            </button>
          </div>

          {showCatFilter && (
            <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl border border-indigo-500/15 bg-white/70 px-3 py-2.5 dark:border-slate-600/20 dark:bg-slate-800/50">
              <Pill small active={filterCat.length === 0} onClick={() => setFilterCat([])}>
                Vse
              </Pill>
              {Object.entries(categories).map(([k, v]) => {
                const cnt = vis.filter((i) => i.cat === k).length;
                return cnt ? (
                  <Pill
                    key={k}
                    small
                    active={filterCat.includes(k)}
                    color={v.color}
                    onClick={() =>
                      setFilterCat((prev) => (prev.includes(k) ? prev.filter((c) => c !== k) : [...prev, k]))
                    }
                  >
                    {v.icon} {v.label} ({cnt})
                  </Pill>
                ) : null;
              })}
            </div>
          )}

          {/* Items with swipe */}
          <div className="flex flex-col gap-1.5">
            {filtered.map((item) => {
              const cat = categories[item.cat] || CATS.drugo;
              const status = getSt(item);
              const frz = freezers.find((f) => f.id === item.freezer);
              return (
                <SwipeCard
                  key={item.id}
                  onSwipeLeft={() => doArchive(item, false)}
                  onClick={() => {
                    setShowDetail(item);
                    setEditMode(false);
                  }}
                >
                  <div
                    style={{ '--cat': cat.color }}
                    className={cx(
                      'relative cursor-pointer overflow-hidden rounded-2xl border px-3.5 py-3',
                      STATUS_CARD[status],
                    )}
                  >
                    <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-(--cat)" />
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-2">
                        <span className="shrink-0 text-2xl">{cat.icon}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.25">
                            <span className="overflow-hidden text-sm font-bold text-ellipsis whitespace-nowrap text-slate-800 dark:text-slate-200">
                              {item.packets > 1 && <span className="text-indigo-400">{item.packets}x </span>}
                              {item.name}
                            </span>
                            {item.sticky && <span className="text-[10px]">📌</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-0.75 text-xs text-slate-400 dark:text-slate-500">
                            <span>
                              {item.qty}
                              {item.packets > 1 ? ' · ' + item.packets + 'p' : ''}
                            </span>
                            {allF && frz && (
                              <>
                                <span>·</span>
                                <span>{frz.icon}</span>
                              </>
                            )}
                            {item.label && (
                              <>
                                <span>·</span>
                                <span className="font-semibold text-indigo-400">{item.label}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="ml-2 shrink-0 text-right">
                        <div
                          className={cx(
                            'mb-0.5 inline-block rounded-lg px-2 py-0.75 text-xs font-extrabold',
                            STATUS_BADGE[status],
                          )}
                        >
                          {wksShort(item.expiry)}
                        </div>
                        <div className="text-[10px] text-slate-300 dark:text-slate-600">{fmtD(item.expiry)}</div>
                      </div>
                    </div>
                  </div>
                </SwipeCard>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <EmptyState icon={items.length === 0 ? '❄️' : '🔍'}>
              {items.length === 0 ? 'Zamrzovalnik je prazen!' : 'Ni zadetkov'}
            </EmptyState>
          )}
        </div>

        <Fab
          onClick={() => {
            const df = selFrzs.length === 1 ? selFrzs[0] : 'home';
            setAddData({
              name: '',
              cat: '',
              qty: '',
              packets: 1,
              label: '',
              frozen: localDateStr(),
              expiry: '',
              freezer: df,
            });
            setAddStep(0);
            setSuggestions([]);
            setScreen('add');
          }}
        />

        {/* DETAIL MODAL - REDESIGNED */}
        {showDetail &&
          (() => {
            const item = showDetail;
            const cat = categories[item.cat] || CATS.drugo;
            const status = getSt(item);
            const frz = freezers.find((f) => f.id === item.freezer);

            if (editMode && editData) {
              return (
                <Modal onClose={() => setEditMode(false)}>
                  <h3 className="mb-5 text-center text-lg font-extrabold">✏️ Uredi izdelek</h3>
                  <Label>Ime</Label>
                  <Input
                    value={editData.name}
                    onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                    className="mb-3.5"
                  />
                  <Label>Kategorija</Label>
                  <div className="mb-3.5 flex flex-wrap gap-1.5">
                    {Object.entries(categories).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => setEditData((d) => ({ ...d, cat: k }))}
                        style={{ '--cat': v.color }}
                        className={cx(
                          'cursor-pointer rounded-xl border px-2.75 py-1.75 text-xs font-semibold',
                          editData.cat === k
                            ? 'border-(--cat)/50 bg-(--cat)/13 text-(--cat)'
                            : 'border-indigo-500/20 bg-white/70 text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/50 dark:text-slate-400',
                        )}
                      >
                        {v.icon} {v.label}
                      </button>
                    ))}
                  </div>
                  <div className="mb-3.5 grid grid-cols-2 gap-2.5">
                    <div>
                      <Label>Količina</Label>
                      <Input
                        value={editData.qty}
                        onChange={(e) => setEditData((d) => ({ ...d, qty: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Paketi</Label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditData((d) => ({ ...d, packets: Math.max(1, d.packets - 1) }))}
                          className="h-11.5 w-10 cursor-pointer rounded-lg border border-indigo-500/20 bg-white/80 text-xl text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/60 dark:text-slate-400"
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center text-xl font-extrabold">{editData.packets}</span>
                        <button
                          onClick={() => setEditData((d) => ({ ...d, packets: d.packets + 1 }))}
                          className="h-11.5 w-10 cursor-pointer rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-xl text-indigo-400"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <Label>Labela</Label>
                  <LabelInp
                    value={editData.label}
                    onChange={(v) => setEditData((d) => ({ ...d, label: v }))}
                    labels={existingLabels}
                    placeholder="opcijsko"
                  />
                  <div className="h-3.5" />
                  <div className="mb-3.5 grid grid-cols-2 gap-2.5">
                    <div>
                      <Label>Zamrznjeno</Label>
                      <Input
                        type="date"
                        value={editData.frozen}
                        onChange={(e) => setEditData((d) => ({ ...d, frozen: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Rok uporabe</Label>
                      <Input
                        type="date"
                        value={editData.expiry}
                        onChange={(e) => setEditData((d) => ({ ...d, expiry: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Label>Zamrzovalnik</Label>
                  <div className="mb-5 flex flex-wrap gap-1.5">
                    {freezers.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setEditData((d) => ({ ...d, freezer: f.id }))}
                        className={cx(
                          'cursor-pointer rounded-xl border px-3.5 py-2.25 text-sm font-bold',
                          editData.freezer === f.id ? CHIP_ON : CHIP_OFF,
                        )}
                      >
                        {f.icon} {f.name}
                      </button>
                    ))}
                  </div>
                  <Btn
                    v="success"
                    onClick={async () => {
                      await dbUpdateItem(editData.id, {
                        name: editData.name,
                        cat: editData.cat,
                        qty: editData.qty,
                        packets: editData.packets,
                        label: editData.label,
                        frozen: editData.frozen,
                        expiry: editData.expiry,
                        freezer: editData.freezer,
                      });
                      setShowDetail(editData);
                      setEditMode(false);
                    }}
                  >
                    💾 Shrani
                  </Btn>
                  <Btn v="ghost" onClick={() => setEditMode(false)} className="mt-2">
                    Prekliči
                  </Btn>
                </Modal>
              );
            }

            return (
              <Modal onClose={() => setShowDetail(null)}>
                {/* Redesigned detail layout */}
                <div className="mb-3 text-center">
                  <span className="text-6xl">{cat.icon}</span>
                  <h2 className="mt-2 mb-1 text-2xl font-extrabold">{item.name}</h2>
                  {/* Status with full text */}
                  <div className={cx('mb-1 text-base font-bold', STATUS_TEXT[status])}>{wksUntil(item.expiry)}</div>
                </div>

                {/* Key info: frozen date + expiry first */}
                <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                  <FC label="Zamrznjeno" value={fmtD(item.frozen)} />
                  <FC label="Rok uporabe" value={fmtD(item.expiry)} />
                </div>
                <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                  <FC label="Količina" value={item.qty + (item.packets > 1 ? ' / ' + item.packets + ' pak.' : '')} />
                  <FC label="Zamrzovalnik" value={frz ? frz.icon + ' ' + frz.name : '—'} />
                </div>
                {/* Category + label row */}
                <div className={cx('mb-4 grid gap-2.5', item.label ? 'grid-cols-2' : 'grid-cols-1')}>
                  <FC label="Kategorija" value={cat.label} />
                  {item.label && <FC label="Labela" value={item.label} />}
                </div>

                {/* Quick packet decrement */}
                {item.packets > 1 && (
                  <div className="mb-3.5 flex items-center justify-between rounded-xl border border-indigo-500/15 bg-indigo-500/6 px-4 py-3">
                    <div>
                      <div className="text-sm font-bold text-indigo-400">Odštej paket</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">Trenutno: {item.packets}</div>
                    </div>
                    <button
                      onClick={async () => {
                        const newP = item.packets - 1;
                        await dbUpdateItem(item.id, { packets: newP });
                        setShowDetail({ ...item, packets: newP });
                      }}
                      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/15 text-xl font-bold text-indigo-400"
                    >
                      −1
                    </button>
                  </div>
                )}

                {/* Action buttons - redesigned */}
                <div className="mb-2 flex gap-2">
                  <button
                    onClick={() => doArchive(item, false)}
                    className="flex-3 cursor-pointer rounded-xl border-none bg-linear-135 from-green-500 to-emerald-600 p-3.75 text-base font-bold text-white"
                  >
                    ✓ Uporabljeno
                  </button>
                  <button
                    onClick={() => doArchive(item, true)}
                    className="flex-1 cursor-pointer rounded-xl border border-red-500/30 bg-red-500/10 p-3.75 text-sm font-bold text-red-500"
                  >
                    🗑
                  </button>
                </div>
                <div className="mb-2 flex gap-2">
                  <button
                    onClick={() => {
                      setEditData({ ...item });
                      setEditMode(true);
                    }}
                    className="flex-1 cursor-pointer rounded-xl border border-sky-400/30 bg-sky-400/8 p-3 text-sm font-semibold text-sky-400"
                  >
                    ✏️ Uredi
                  </button>
                  <button
                    onClick={async () => {
                      await dbUpdateItem(item.id, { sticky: !item.sticky });
                      setShowDetail({ ...item, sticky: !item.sticky });
                    }}
                    className={cx(
                      'flex-1 cursor-pointer rounded-xl border border-indigo-500/20 p-3 text-sm font-semibold dark:border-slate-600/30',
                      item.sticky
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-white/80 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400',
                    )}
                  >
                    {item.sticky ? '📌 Odpni' : '📌 Pripni'}
                  </button>
                  <button
                    onClick={async () => {
                      await dbDeleteItem(item.id);
                      setShowDetail(null);
                    }}
                    className="flex-1 cursor-pointer rounded-xl border border-red-500/15 bg-transparent p-3 text-sm font-semibold text-slate-400 dark:text-slate-500"
                  >
                    Zbriši
                  </button>
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
      <div className="relative z-1 min-h-screen px-4 pt-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => {
              if (addStep === 0) setScreen('home');
              else setAddStep(addStep - 1);
            }}
            className={BACK_BTN}
          >
            {t('nazaj')}
          </button>
          <h2 className="text-lg font-extrabold">{t('dodajVZamrzovalnik')}</h2>
          <button
            onClick={() => setScreen('home')}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-indigo-500/20 bg-white/90 text-lg text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/80 dark:text-slate-400"
          >
            ✕
          </button>
        </div>

        {/* Progress - only show active steps */}
        <div className="mb-7 flex gap-1.5">
          {stepLabels.map((l, i) => (
            <div key={i} className="flex-1 text-center">
              <div
                className={cx(
                  'mb-1.5 h-1 rounded-xs',
                  i <= addStep ? 'bg-linear-135 from-sky-500 to-indigo-500' : 'bg-slate-300/50 dark:bg-slate-700/50',
                )}
              />
              <span
                className={cx(
                  'text-xs font-semibold',
                  i <= addStep ? 'text-sky-400' : 'text-slate-300 dark:text-slate-600',
                )}
              >
                {l}
              </span>
            </div>
          ))}
        </div>

        {/* STEP 0: Name + Category */}
        {addStep === 0 && (
          <div>
            <Label>{t('kajZamrzuješ')}</Label>
            <input
              ref={inputRef}
              value={addData.name}
              onChange={(e) => {
                setAddData((d) => ({ ...d, name: e.target.value }));
                setSuggestions(
                  e.target.value.length >= 2
                    ? SUGG.filter((s) => s.n.toLowerCase().includes(e.target.value.toLowerCase())).slice(0, 5)
                    : [],
                );
              }}
              placeholder={t('primerekIskanja')}
              className="box-border w-full rounded-xl border border-indigo-500/25 bg-white/90 px-4 py-3.5 text-lg font-medium text-slate-800 outline-none dark:border-indigo-500/30 dark:bg-slate-800/80 dark:text-slate-200"
            />
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1">
                {suggestions.map((s, i) => {
                  const cat = categories[s.c] || CATS[s.c];
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        const exp = new Date(addData.frozen);
                        exp.setMonth(exp.getMonth() + (cat?.months || 6));
                        setAddData((d) => ({ ...d, name: s.n, cat: s.c, expiry: localDateStr(exp) }));
                        setSuggestions([]);
                        setAddStep(1);
                      }}
                      style={{ '--cat': cat?.color }}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-indigo-500/20 bg-white/90 px-3.5 py-3.25 text-left text-base text-slate-800 dark:border-slate-600/30 dark:bg-slate-800/80 dark:text-slate-200"
                    >
                      <span className="text-2xl">{cat?.icon}</span>
                      <div>
                        <div className="font-semibold">{s.n}</div>
                        <div className="text-xs font-semibold text-(--cat)">
                          {cat?.label} · rok {cat?.months} mes.
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {addData.name.length >= 2 && suggestions.length === 0 && (
              <div className="mt-4">
                <p className="mb-2.5 text-sm text-slate-400 dark:text-slate-500">{t('izberiKategorijo')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(categories).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => {
                        const exp = new Date(addData.frozen);
                        exp.setMonth(exp.getMonth() + (v.months || 6));
                        setAddData((d) => ({ ...d, cat: k, expiry: localDateStr(exp) }));
                        setAddStep(1);
                      }}
                      style={{ '--cat': v.color }}
                      className="cursor-pointer rounded-xl border border-indigo-500/15 bg-white/80 px-1.5 py-3.5 text-center text-slate-800 dark:border-slate-600/20 dark:bg-slate-800/60 dark:text-slate-200"
                    >
                      <div className="mb-1 text-2xl">{v.icon}</div>
                      <div className="text-xs font-semibold text-(--cat)">{v.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1: Quantity + Quick summary + ADD or MORE OPTIONS */}
        {addStep === 1 && (
          <div>
            <div
              className="mb-5 text-center"
              style={{ '--cat': (categories[addData.cat] || CATS[addData.cat])?.color }}
            >
              <span className="text-5xl">{(categories[addData.cat] || CATS[addData.cat])?.icon}</span>
              <h3 className="mt-2 text-xl font-bold">{addData.name}</h3>
              <span className="text-sm font-semibold text-(--cat)">
                {(categories[addData.cat] || CATS[addData.cat])?.label}
              </span>
            </div>

            <Label>{t('količina')}</Label>
            <Input
              ref={inputRef}
              value={addData.qty}
              onChange={(e) => setAddData((d) => ({ ...d, qty: e.target.value }))}
              placeholder="npr. 500g, 2 kosa, 1L"
              className="mb-2"
            />
            <div className="mb-5 flex flex-wrap gap-1.5">
              {QO.map((q) => (
                <button
                  key={q}
                  onClick={() => setAddData((d) => ({ ...d, qty: q }))}
                  className={cx(
                    'cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold',
                    addData.qty === q ? CHIP2_ON : CHIP_OFF,
                  )}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Auto-summary */}
            <div className="mb-5 rounded-xl border border-indigo-500/15 bg-white/70 px-4 py-3.5 dark:border-slate-600/20 dark:bg-slate-800/50">
              <div className="mb-1.5 flex justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>{t('rokUporabe')}:</span>
                <span className="font-bold text-green-500">
                  {addData.expiry ? fmtD(addData.expiry) : fmtD(recalc(addData.frozen, addData.cat))}
                </span>
              </div>
              <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                <span>{t('zamrzovalnik')}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {freezers.find((f) => f.id === addData.freezer)?.icon}{' '}
                  {freezers.find((f) => f.id === addData.freezer)?.name}
                </span>
              </div>
            </div>

            <Btn
              v="success"
              disabled={!addData.qty}
              onClick={async () => {
                const exp = addData.expiry || recalc(addData.frozen, addData.cat);
                await dbAddItem({
                  name: addData.name,
                  cat: addData.cat,
                  qty: addData.qty,
                  packets: 1,
                  label: '',
                  frozen: addData.frozen,
                  expiry: exp,
                  freezer: addData.freezer,
                  sticky: false,
                });
                setScreen('home');
              }}
            >
              {t('dodajVZamrzovalnik')}
            </Btn>
            <Btn v="ghost" disabled={!addData.qty} onClick={() => setAddStep(2)} className="mt-2">
              {t('večOpcij')}
            </Btn>
          </div>
        )}

        {/* STEP 2: More options - packets, label, edit dates, freezer */}
        {addStep === 2 && (
          <div>
            <div className="mb-5 text-center">
              <span className="text-5xl">{(categories[addData.cat] || CATS[addData.cat])?.icon}</span>
              <h3 className="mt-2 text-xl font-bold">{addData.name}</h3>
              <span className="text-sm text-slate-400 dark:text-slate-500">
                {addData.qty} · {(categories[addData.cat] || CATS[addData.cat])?.label}
              </span>
            </div>

            <Label>{t('paketi')}</Label>
            <div className="mb-4.5 flex items-center gap-3">
              <button
                onClick={() => setAddData((d) => ({ ...d, packets: Math.max(1, d.packets - 1) }))}
                className={STEPPER_MINUS}
              >
                −
              </button>
              <span className="min-w-8 text-center text-2xl font-extrabold">{addData.packets}</span>
              <button onClick={() => setAddData((d) => ({ ...d, packets: d.packets + 1 }))} className={STEPPER_PLUS}>
                +
              </button>
              <span className="text-sm text-slate-400 dark:text-slate-500">{t('paketov')}</span>
            </div>

            <Label>
              {t('labela')} <span className="font-normal text-slate-300 dark:text-slate-600">({t('opcijsko')})</span>
            </Label>
            <LabelInp
              value={addData.label}
              onChange={(v) => setAddData((d) => ({ ...d, label: v }))}
              labels={existingLabels}
              placeholder={t('primerekLabele')}
            />
            <div className="h-4" />

            <div className="mb-3.5 grid grid-cols-2 gap-2.5">
              <div>
                <Label>{t('zamrznjeno')}</Label>
                <Input
                  type="date"
                  value={addData.frozen}
                  onChange={(e) => {
                    const f = e.target.value;
                    setAddData((d) => ({ ...d, frozen: f, expiry: recalc(f, d.cat) }));
                  }}
                />
              </div>
              <div>
                <Label>{t('rokUporabe')}</Label>
                <Input
                  type="date"
                  value={addData.expiry || recalc(addData.frozen, addData.cat)}
                  onChange={(e) => setAddData((d) => ({ ...d, expiry: e.target.value }))}
                />
              </div>
            </div>

            <Label>{t('zamrzovalnik')}</Label>
            <div className="mb-6 flex flex-wrap gap-2">
              {freezers.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAddData((d) => ({ ...d, freezer: f.id }))}
                  className={cx(
                    'cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-bold',
                    addData.freezer === f.id ? CHIP_ON : CHIP_OFF,
                  )}
                >
                  {f.icon} {f.name}
                </button>
              ))}
            </div>

            <Btn
              v="success"
              onClick={async () => {
                const exp = addData.expiry || recalc(addData.frozen, addData.cat);
                await dbAddItem({
                  name: addData.name,
                  cat: addData.cat,
                  qty: addData.qty,
                  packets: addData.packets,
                  label: addData.label,
                  frozen: addData.frozen,
                  expiry: exp,
                  freezer: addData.freezer,
                  sticky: false,
                });
                setScreen('home');
              }}
            >
              {t('dodajVZamrzovalnik')}
            </Btn>
          </div>
        )}
      </div>
    </Screen>
  );
}
