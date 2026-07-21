'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations, useFormatter, useLocale } from 'next-intl';
import {
  ChevronDown,
  History,
  Minus,
  Pencil,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useCatLabel, useExpiryText } from '@/lib/intl';
import { normalizujNiz } from '@/lib/hooks';
import { CATS, SUGG, FICONS, QO } from '@/lib/constants';
import { getSt, localDateStr, localDateFromStr, cx, STATUS_TEXT, STATUS_ROW, STATUS_BADGE } from '@/lib/utils';
import {
  Screen,
  PageBody,
  Card,
  Pill,
  FC,
  Btn,
  Modal,
  ConfirmModal,
  ModalActions,
  SwipeCard,
  ModuleHeader,
  Input,
  Label,
  IconButton,
  EmptyState,
  Fab,
  BackBtn,
  CHIP_ON,
  CHIP_OFF,
  POPOVER,
  POPOVER_POP,
  LIST_ROW,
  SPRING_FAST,
  POP,
  PRESS,
  PRESS_SM,
  ROW_PRESS,
  ScreenEnter,
  ScrollChips,
  StepPane,
  TickNum,
  useStepDir,
} from './ui';

// Repeated class recipes local to this module
const SEARCH_INP =
  'w-full box-border h-12 pr-4 pl-9.5 bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-xl text-stone-900 dark:text-stone-100 placeholder:text-stone-400 outline-none font-medium text-base transition-colors focus:border-orange-500';
const STEPPER_MINUS = cx(
  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-stone-300 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
  PRESS_SM,
);
const STEPPER_PLUS = cx(
  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900',
  PRESS_SM,
);

// ─── FREEZER DROPDOWN ───
function FreezerDD({ freezers, selected, onChange, onAdd, onManage }) {
  const t = useTranslations('Freezer');
  const tc = useTranslations('Common');
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
    ? tc('all')
    : selected.length === 1
      ? freezers.find((f) => f.id === selected[0])?.icon + ' ' + freezers.find((f) => f.id === selected[0])?.name
      : t('selectedCount', { count: selected.length });
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
      'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border-2 text-xs text-white dark:text-stone-900',
      on
        ? 'border-stone-900 bg-stone-900 dark:border-stone-100 dark:bg-stone-100'
        : 'border-stone-300 bg-transparent dark:border-stone-600',
    );
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
              toggle('all');
              setOpen(false);
            }}
            className={cx(
              'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left text-sm font-semibold',
              ROW_PRESS,
              allSel
                ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                : 'bg-transparent text-stone-500 dark:text-stone-400',
            )}
          >
            <span className={check(allSel)}>{allSel ? '✓' : ''}</span> {tc('all')}
          </button>
          {freezers.map((f) => {
            const on = allSel || selected.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={cx(
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-xl border-none px-3 py-2.5 text-left text-sm font-semibold',
                  ROW_PRESS,
                  !allSel && on ? 'bg-stone-100 dark:bg-stone-800' : 'bg-transparent',
                  on ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400 dark:text-stone-500',
                )}
              >
                <span className={check(!allSel && on)}>{!allSel && on ? '✓' : ''}</span> {f.icon} {f.name}
              </button>
            );
          })}
          {/* ADD NEW FREEZER + MANAGE */}
          <div className="mt-1.5 border-t border-stone-200 pt-1.5 dark:border-white/10">
            {!showAdd ? (
              <>
                <button
                  onClick={() => setShowAdd(true)}
                  className={cx(
                    'flex w-full items-center gap-2 rounded-xl border-none bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-orange-600 dark:text-orange-400',
                    ROW_PRESS,
                  )}
                >
                  {t('newFreezer')}
                </button>
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
              </>
            ) : (
              <div className="flex flex-col gap-2 px-1.5 py-2">
                <div className="flex flex-wrap gap-1">
                  {FICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => setNewIcon(ic)}
                      className={cx(
                        'cursor-pointer rounded-lg border p-1 text-xl',
                        PRESS_SM,
                        newIcon === ic
                          ? 'border-stone-900 bg-stone-100 dark:border-stone-100 dark:bg-stone-800'
                          : 'border-transparent bg-transparent',
                      )}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
                <Input
                  size="xs"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('freezerNamePlaceholder')}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') doAdd();
                  }}
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={doAdd}
                    disabled={!newName.trim()}
                    className={cx(
                      'flex-1 rounded-lg border-none p-2 text-sm font-bold',
                      PRESS_SM,
                      newName.trim()
                        ? 'cursor-pointer bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                        : 'cursor-default bg-stone-200 text-stone-400 dark:bg-stone-800 dark:text-stone-600',
                    )}
                  >
                    {tc('add')}
                  </button>
                  <button
                    onClick={() => {
                      setShowAdd(false);
                      setNewName('');
                    }}
                    className={cx(
                      'flex-1 rounded-lg border border-stone-300 bg-transparent p-2 text-sm font-semibold text-stone-500 dark:border-stone-700 dark:text-stone-400',
                      PRESS_SM,
                    )}
                  >
                    {tc('cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
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
        <motion.div {...POPOVER_POP} className={cx(POPOVER, 'absolute inset-x-0 top-[calc(100%+4px)] z-10 origin-top')}>
          {sug.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => onChange(s)}
              className={cx(
                'w-full rounded-lg border-none bg-transparent px-3.5 py-2.5 text-left text-sm font-medium text-stone-900 dark:text-stone-100',
                ROW_PRESS,
              )}
            >
              📎 {s}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export default function FreezerModule({
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
  dbUpdateFreezer,
  dbDeleteFreezer,
  categories,
  itemsLoading,
  onGoHome,
  onOpenSettings,
}) {
  const t = useTranslations('Freezer');
  const tc = useTranslations('Common');
  const ta = useTranslations('A11y');
  const tMod = useTranslations('Modules');
  const locale = useLocale();
  const format = useFormatter();
  const catLabel = useCatLabel();
  const expiryText = useExpiryText();
  const sugg = SUGG[locale] ?? SUGG.sl;
  const qo = QO[locale] ?? QO.sl;

  // ─── FREEZER UI STATE ───
  const [screen, setScreen] = useState('home');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState([]);
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
  const [adding, setAdding] = useState(false); // guards double-submit while the insert is in flight
  const addDir = useStepDir(addStep); // slide direction for the add-flow StepPane
  // Suppresses the archView pane's own entrance while the archive screen
  // itself is entering (both mount in the same commit — the rise would
  // compound); view toggles inside the archive replay it solo.
  const archViewReady = useRef(false);
  useEffect(() => {
    archViewReady.current = showArchive;
  }, [showArchive]);
  // Leaving the add flow always resets the step, so the next open slides
  // forward again (a stale addStep would make useStepDir report "backward").
  const exitAdd = () => {
    setScreen('home');
    setAddStep(0);
    setAdding(false);
  };
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
  const [manageFreezers, setManageFreezers] = useState(false);
  const [editingFreezer, setEditingFreezer] = useState(null); // { id, name, icon }

  // Quick-quantity chip (add flow STEP 1) — rendered per QO group (counts | measures).
  const qtyChip = (q) => (
    <button
      key={q}
      onClick={() => setAddData((d) => ({ ...d, qty: q }))}
      className={cx(
        'shrink-0 cursor-pointer rounded-full border px-3 py-2 text-sm font-semibold whitespace-nowrap',
        PRESS_SM,
        addData.qty === q ? CHIP_ON : CHIP_OFF,
      )}
    >
      {q}
    </button>
  );

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
  const filtered = vis
    .filter((i) => {
      if (filterCat.length > 0 && !filterCat.includes(i.cat)) return false;
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
    const e = localDateFromStr(f);
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
      if (!byMonth[k]) byMonth[k] = { label: format.dateTime(d, 'monthYear'), items: [] };
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
        <Modal open={!!editArchived} onClose={() => setEditArchived(null)}>
          {editArchived && (
            <>
              <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight">
                {t('editArchived', { name: editArchived.name })}
              </h3>
              <div className="mb-3">
                <Label>{tc('name')}</Label>
                <Input
                  value={editArchived.name}
                  onChange={(e) => setEditArchived((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="mb-5">
                <Label>{tc('quantity')}</Label>
                <Input
                  value={editArchived.qty}
                  onChange={(e) => setEditArchived((p) => ({ ...p, qty: e.target.value }))}
                />
              </div>
              <ModalActions
                className="mb-2.5"
                saveLabel={t('save')}
                onSave={async () => {
                  await dbUpdateArchived(editArchived.id, { name: editArchived.name, qty: editArchived.qty });
                  setEditArchived(null);
                }}
                onCancel={() => setEditArchived(null)}
              />
              <button
                onClick={() =>
                  setConfirmAction({
                    message: t('deleteFromArchiveQuestion'),
                    onConfirm: async () => {
                      await dbDeleteArchived(editArchived.id);
                      setEditArchived(null);
                    },
                  })
                }
                className={cx(
                  'w-full rounded-full border border-red-500/25 bg-red-500/10 p-3.25 text-base font-semibold text-red-600 dark:text-red-400',
                  PRESS,
                )}
              >
                {t('deleteFromArchive')}
              </button>
              <button
                onClick={() =>
                  setConfirmAction({
                    message: t('returnQuestion'),
                    onConfirm: async () => {
                      await dbUnarchiveItem(editArchived);
                      setEditArchived(null);
                    },
                  })
                }
                className={cx(
                  'mt-2 w-full rounded-full border border-green-600/30 bg-green-600/10 p-3.25 text-base font-semibold text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-400',
                  PRESS,
                )}
              >
                {t('returnToFreezer')}
              </button>
            </>
          )}
        </Modal>

        <PageBody key="frz-archive">
          <div className="mb-4 flex items-center gap-3 pt-3">
            <BackBtn onClick={() => setShowArchive(false)} />
            <h2 className="font-serif text-2xl font-semibold tracking-tight">{t('archive')}</h2>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400 dark:text-stone-600" />
            <input
              value={archSearch}
              onChange={(e) => setArchSearch(e.target.value)}
              placeholder={t('searchArchive')}
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

          {/* Category filter pills */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <Pill small active={archCatF.length === 0} onClick={() => setArchCatF([])}>
              {tc('all')}
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
              [t('results'), tot, 'text-stone-900 dark:text-stone-100', 'text-stone-400 dark:text-stone-500'],
              [
                t('avgPerMonth'),
                mc ? Math.round(tot / mc) : 0,
                'text-stone-900 dark:text-stone-100',
                'text-stone-400 dark:text-stone-500',
              ],
              [t('used'), usedCount, 'text-green-600 dark:text-green-400', 'text-green-600 dark:text-green-400'],
              [t('wasted'), wastedCount, 'text-red-600 dark:text-red-400', 'text-red-600 dark:text-red-400'],
            ].map(([l, v, valCls, lblCls]) => (
              <Card key={l} className="rounded-xl px-2 py-2.5 text-center">
                <div className={cx('text-[9px] font-semibold tracking-[1px] uppercase', lblCls)}>{l}</div>
                <div className={cx('mt-0.5 text-2xl font-extrabold', valCls)}>{v}</div>
              </Card>
            ))}
          </div>

          {/* View toggle */}
          <div className="mb-3.5 flex gap-1.5">
            <Pill small active={archView === 'monthly'} onClick={() => setArchView('monthly')}>
              {t('monthly')}
            </Pill>
            <Pill small active={archView === 'category'} onClick={() => setArchView('category')}>
              {t('byCategory')}
            </Pill>
            <Pill small active={archView === 'item'} onClick={() => setArchView('item')}>
              {t('byItem')}
            </Pill>
          </div>

          {tot === 0 && <EmptyState icon="📭">{tc('noResults')}</EmptyState>}

          <ScreenEnter key={archView} initial={archViewReady.current ? undefined : false}>
            {/* MONTHLY VIEW */}
            {archView === 'monthly' &&
              Object.entries(byMonth)
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([k, { label, items: mi }]) => (
                  <div key={k} className="mb-4">
                    <div className="mb-1.5 flex justify-between">
                      <h3 className="text-sm font-bold text-stone-500 capitalize dark:text-stone-400">{label}</h3>
                      <span className="text-xs font-semibold text-stone-400 dark:text-stone-600">{mi.length}</span>
                    </div>
                    {mi.map((it, i) => {
                      const cat = categories[it.cat] || CATS.drugo;
                      return (
                        <div
                          key={it.id + '-' + i}
                          onClick={() => setEditArchived(it)}
                          className={cx(
                            'flex items-center gap-2.5 border-b border-dotted border-stone-300 px-0.5 py-2.25 last:border-b-0 dark:border-stone-700',
                            ROW_PRESS,
                          )}
                        >
                          <span className="text-lg">{cat.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div
                              className={cx(
                                'text-sm font-semibold',
                                it.wasted ? 'text-red-600 dark:text-red-400' : 'text-stone-900 dark:text-stone-100',
                              )}
                            >
                              {it.name} {it.wasted && <span className="text-xs opacity-70">· {t('wastedLower')}</span>}
                            </div>
                            <div className="text-xs text-stone-400 dark:text-stone-600">
                              {it.qty}
                              {it.packets > 1 ? ' / ' + t('packetsShort', { count: it.packets }) : ''}
                              {it.label ? ' · ' + it.label : ''}
                            </div>
                          </div>
                          <div className="shrink-0 text-xs text-stone-400 dark:text-stone-600">
                            {format.dateTime(new Date(it.archived_at), 'day')}
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
                          {cat.icon} {catLabel(ck, cat)}
                        </h3>
                        <span className="text-xs font-semibold text-stone-400 dark:text-stone-600">{ci.length}</span>
                      </div>
                      <div className="mb-2 h-1.5 overflow-hidden rounded-xs bg-stone-200 dark:bg-stone-800">
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
                            'flex items-center gap-2.5 border-b border-dotted border-stone-200 px-0.5 py-1.75 last:border-b-0 dark:border-stone-800',
                            ROW_PRESS,
                          )}
                        >
                          <div
                            className={cx(
                              'flex-1 text-sm font-medium',
                              it.wasted ? 'text-red-600 dark:text-red-400' : 'text-stone-900 dark:text-stone-100',
                            )}
                          >
                            {it.name}
                            {it.wasted ? ' · ' + t('wastedLower') : ''}
                          </div>
                          <div className="text-xs text-stone-400 dark:text-stone-600">{it.qty}</div>
                          <div className="text-xs text-stone-400 dark:text-stone-600">
                            {format.dateTime(new Date(it.archived_at), 'day')}
                          </div>
                        </div>
                      ))}
                      {ci.length > 5 && (
                        <div className="px-3 py-1 text-xs text-stone-400 dark:text-stone-600">
                          {t('moreCount', { count: ci.length - 5 })}
                        </div>
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
                    if (!mb[k]) mb[k] = { label: format.dateTime(d, 'monthShortYY'), count: 0 };
                    mb[k].count++;
                  });
                  const mx = Math.max(...Object.values(mb).map((m) => m.count));
                  return (
                    <div key={name} className="mb-4" style={{ '--cat': cat.color }}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xl">{cat.icon}</span>
                        <div>
                          <div className="text-sm font-bold text-stone-900 dark:text-stone-100">{name}</div>
                          <div className="text-xs font-semibold text-(--cat)">
                            {t('totalTimes', { count: ie.length, label: catLabel(ck, cat) })}
                            {wastedInItem > 0 && (
                              <span className="text-red-600 dark:text-red-400">
                                {' '}
                                · {t('wastedTimes', { count: wastedInItem })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mb-1 flex h-12.5 items-end gap-0.75 px-1">
                        {Object.entries(mb)
                          .sort((a, b) => a[0].localeCompare(b[0]))
                          .map(([k, { count }]) => (
                            <div key={k} className="flex flex-1 flex-col items-center gap-0.5">
                              <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500">{count}</div>
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
                              className="flex-1 text-center text-[9px] font-semibold text-stone-400 dark:text-stone-600"
                            >
                              {label}
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
          </ScreenEnter>
        </PageBody>
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
        <PageBody key="frz-home">
          <ModuleHeader title={tMod('freezer')} emoji="❄️" onHome={onGoHome}>
            <FreezerDD
              freezers={freezers}
              selected={selFrzs}
              onChange={setSelFrzs}
              onAdd={dbAddFreezer}
              onManage={() => setManageFreezers(true)}
            />
            <IconButton
              aria-label={ta('archive')}
              onClick={() => {
                setShowArchive(true);
                setArchSearch('');
                setArchCatF([]);
              }}
            >
              <History className="size-4.5" />
            </IconButton>
            <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
              <Settings className="size-4.5" />
            </IconButton>
          </ModuleHeader>

          <div className={cx('flex gap-2', showCatFilter ? 'mb-2' : 'mb-3')}>
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-stone-400 dark:text-stone-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tc('search')}
                className={cx(SEARCH_INP, search && 'pr-9.5')}
              />
              {search && (
                <motion.button
                  {...POP}
                  aria-label={ta('clearSearch')}
                  onClick={() => setSearch('')}
                  className={cx(
                    'absolute top-1/2 right-3 -translate-y-1/2 border-none bg-transparent text-stone-400 dark:text-stone-500',
                    PRESS_SM,
                  )}
                >
                  <X className="size-4" />
                </motion.button>
              )}
            </div>
            <button
              aria-label={ta('filterCategories')}
              onClick={() => setShowCatFilter(!showCatFilter)}
              className={cx(
                'relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border',
                PRESS_SM,
                showCatFilter || filterCat.length > 0
                  ? 'border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900'
                  : 'border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
              )}
            >
              <SlidersHorizontal className="size-4.5" />
              {filterCat.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500" />
              )}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {showCatFilter && (
              <motion.div
                key="catFilter"
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: 'auto', opacity: 1, marginBottom: 12 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-1.5 rounded-xl border border-stone-200/70 bg-white px-3 py-2.5 dark:border-white/10 dark:bg-stone-900">
                  <Pill small active={filterCat.length === 0} onClick={() => setFilterCat([])}>
                    {tc('all')}
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
                        {v.icon} {catLabel(k, v)} ({cnt})
                      </Pill>
                    ) : null;
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Items with swipe */}
          <div className="relative flex flex-col">
            <AnimatePresence initial={false} mode="popLayout">
              {filtered.map((item) => {
                const cat = categories[item.cat] || CATS.drugo;
                const status = getSt(item);
                const frz = freezers.find((f) => f.id === item.freezer);
                return (
                  <motion.div {...LIST_ROW} key={item.id}>
                    <SwipeCard
                      onSwipeLeft={() => doArchive(item, false)}
                      onClick={() => {
                        setShowDetail(item);
                        setEditMode(false);
                      }}
                    >
                      {/* Flat row: opaque page-colored bg keeps the swipe reveal
                          hidden at rest; dotted divider on every row. */}
                      <div
                        style={{ '--cat': cat.color }}
                        className={cx(
                          'relative cursor-pointer overflow-hidden border-b border-dotted border-stone-300 px-1 py-3 dark:border-stone-700',
                          STATUS_ROW[status],
                        )}
                      >
                        <div className="absolute inset-y-2.5 left-0 w-1 rounded-full bg-(--cat)" />
                        <div className="flex items-center justify-between">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-2">
                            <span className="shrink-0 text-2xl">{cat.icon}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.25">
                                <span className="overflow-hidden text-sm font-bold text-ellipsis whitespace-nowrap text-stone-900 dark:text-stone-100">
                                  {item.packets > 1 && (
                                    <span className="text-stone-500 dark:text-stone-400">{item.packets}x </span>
                                  )}
                                  {item.name}
                                </span>
                                {item.sticky && <span className="text-[10px]">📌</span>}
                              </div>
                              <div className="flex flex-wrap items-center gap-0.75 text-xs text-stone-400 dark:text-stone-500">
                                <span>
                                  {item.qty}
                                  {item.packets > 1 ? ' · ' + t('packetsShort', { count: item.packets }) : ''}
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
                                    <span className="font-semibold text-orange-600 dark:text-orange-400">
                                      {item.label}
                                    </span>
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
                              {expiryText(item.expiry, { short: true })}
                            </div>
                            <div className="text-[10px] text-stone-400 dark:text-stone-600">
                              {format.dateTime(new Date(item.expiry), 'day')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </SwipeCard>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {!itemsLoading && filtered.length === 0 && (
            <EmptyState icon={items.length === 0 ? '❄️' : '🔍'}>
              {items.length === 0 ? t('empty') : tc('noResults')}
            </EmptyState>
          )}
        </PageBody>

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

        {/* DETAIL / EDIT MODAL — one sheet; edit is a content swap of the same
            sheet (the sheet stays up), any close from either mode animates down */}
        <Modal open={!!showDetail} onClose={() => (editMode ? setEditMode(false) : setShowDetail(null))}>
          {showDetail &&
            (() => {
              const item = showDetail;
              const cat = categories[item.cat] || CATS.drugo;
              const status = getSt(item);
              const frz = freezers.find((f) => f.id === item.freezer);

              if (editMode && editData) {
                return (
                  <>
                    <h3 className="mb-5 text-center font-serif text-xl font-semibold tracking-tight">
                      {t('editItem')}
                    </h3>
                    <Label>{tc('name')}</Label>
                    <Input
                      value={editData.name}
                      onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                      className="mb-3.5"
                    />
                    <Label>{t('category')}</Label>
                    <div className="mb-3.5 flex flex-wrap gap-1.5">
                      {Object.entries(categories).map(([k, v]) => (
                        <button
                          key={k}
                          onClick={() => setEditData((d) => ({ ...d, cat: k }))}
                          style={{ '--cat': v.color }}
                          className={cx(
                            'cursor-pointer rounded-full border px-2.75 py-1.75 text-xs font-semibold',
                            PRESS_SM,
                            editData.cat === k
                              ? 'border-(--cat)/50 bg-(--cat)/13 text-(--cat)'
                              : 'border-stone-300 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
                          )}
                        >
                          {v.icon} {catLabel(k, v)}
                        </button>
                      ))}
                    </div>
                    <div className="mb-3.5 grid grid-cols-2 gap-2.5">
                      <div>
                        <Label>{tc('quantity')}</Label>
                        <Input
                          value={editData.qty}
                          onChange={(e) => setEditData((d) => ({ ...d, qty: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>{t('packets')}</Label>
                        <div className="flex items-center gap-2">
                          <button
                            aria-label={ta('decrease')}
                            onClick={() => setEditData((d) => ({ ...d, packets: Math.max(1, d.packets - 1) }))}
                            className={cx(
                              'flex h-11.5 w-10 items-center justify-center rounded-full border border-stone-300 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
                              PRESS_SM,
                            )}
                          >
                            <Minus className="size-4.5" />
                          </button>
                          <TickNum value={editData.packets} className="min-w-6 text-xl font-extrabold" />
                          <button
                            aria-label={ta('increase')}
                            onClick={() => setEditData((d) => ({ ...d, packets: d.packets + 1 }))}
                            className={cx(
                              'flex h-11.5 w-10 items-center justify-center rounded-full border-none bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900',
                              PRESS_SM,
                            )}
                          >
                            <Plus className="size-4.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <Label>{t('label')}</Label>
                    <LabelInp
                      value={editData.label}
                      onChange={(v) => setEditData((d) => ({ ...d, label: v }))}
                      labels={existingLabels}
                      placeholder={tc('optional')}
                    />
                    <div className="h-3.5" />
                    <div className="mb-3.5 grid grid-cols-2 gap-2.5">
                      <div>
                        <Label>{t('frozen')}</Label>
                        <Input
                          type="date"
                          value={editData.frozen}
                          onChange={(e) => setEditData((d) => ({ ...d, frozen: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>{t('expiryDate')}</Label>
                        <Input
                          type="date"
                          value={editData.expiry}
                          onChange={(e) => setEditData((d) => ({ ...d, expiry: e.target.value }))}
                        />
                      </div>
                    </div>
                    <Label>{t('freezer')}</Label>
                    <div className="mb-5 flex flex-wrap gap-1.5">
                      {freezers.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setEditData((d) => ({ ...d, freezer: f.id }))}
                          className={cx(
                            'cursor-pointer rounded-full border px-3.5 py-2.25 text-sm font-bold',
                            PRESS_SM,
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
                      {t('save')}
                    </Btn>
                    <Btn v="ghost" onClick={() => setEditMode(false)} className="mt-2">
                      {tc('cancel')}
                    </Btn>
                  </>
                );
              }

              return (
                <>
                  {/* Redesigned detail layout */}
                  <div className="mb-3 text-center">
                    <span className="text-6xl">{cat.icon}</span>
                    <h2 className="mt-2 mb-1 font-serif text-3xl font-semibold tracking-tight">{item.name}</h2>
                    {/* Status with full text */}
                    <div className={cx('mb-1 text-base font-bold', STATUS_TEXT[status])}>{expiryText(item.expiry)}</div>
                  </div>

                  {/* Key info: frozen date + expiry first */}
                  <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                    <FC label={t('frozen')} value={format.dateTime(new Date(item.frozen), 'day')} />
                    <FC label={t('expiryDate')} value={format.dateTime(new Date(item.expiry), 'day')} />
                  </div>
                  <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                    <FC
                      label={tc('quantity')}
                      value={item.qty + (item.packets > 1 ? ' / ' + t('packetsAbbr', { count: item.packets }) : '')}
                    />
                    <FC label={t('freezer')} value={frz ? frz.icon + ' ' + frz.name : '—'} />
                  </div>
                  {/* Category + label row */}
                  <div className={cx('mb-4 grid gap-2.5', item.label ? 'grid-cols-2' : 'grid-cols-1')}>
                    <FC label={t('category')} value={catLabel(item.cat, cat)} />
                    {item.label && <FC label={t('label')} value={item.label} />}
                  </div>

                  {/* Quick packet decrement */}
                  {item.packets > 1 && (
                    <div className="mb-3.5 flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 dark:border-white/10 dark:bg-stone-950/60">
                      <div>
                        <div className="text-sm font-bold text-stone-900 dark:text-stone-100">
                          {t('subtractPacket')}
                        </div>
                        <div className="text-xs text-stone-400 dark:text-stone-500">
                          {t('currently', { count: item.packets })}
                        </div>
                      </div>
                      <button
                        aria-label={t('subtractPacket')}
                        onClick={async () => {
                          const newP = item.packets - 1;
                          await dbUpdateItem(item.id, { packets: newP });
                          setShowDetail({ ...item, packets: newP });
                        }}
                        className={cx(
                          'flex h-11 w-11 items-center justify-center rounded-full border-none bg-stone-900 text-base font-bold text-white dark:bg-stone-100 dark:text-stone-900',
                          PRESS_SM,
                        )}
                      >
                        −1
                      </button>
                    </div>
                  )}

                  {/* Action buttons - redesigned */}
                  <div className="mb-2 flex gap-2">
                    <button
                      onClick={() => doArchive(item, false)}
                      className={cx(
                        'flex-3 rounded-full border-none bg-green-600 p-3.75 text-base font-bold text-white',
                        PRESS,
                      )}
                    >
                      {t('usedBtn')}
                    </button>
                    <button
                      aria-label={ta('delete')}
                      onClick={() => doArchive(item, true)}
                      className={cx(
                        'flex flex-1 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10 p-3.75 text-red-600 dark:text-red-400',
                        PRESS,
                      )}
                    >
                      <Trash2 className="size-4.5" />
                    </button>
                  </div>
                  <div className="mb-2 flex gap-2">
                    <button
                      onClick={() => {
                        setEditData({ ...item });
                        setEditMode(true);
                      }}
                      className={cx(
                        'flex-1 rounded-full border border-stone-300 bg-white p-3 text-sm font-semibold text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300',
                        PRESS,
                      )}
                    >
                      {t('edit')}
                    </button>
                    <button
                      onClick={async () => {
                        await dbUpdateItem(item.id, { sticky: !item.sticky });
                        setShowDetail({ ...item, sticky: !item.sticky });
                      }}
                      className={cx(
                        'flex-1 cursor-pointer rounded-full border p-3 text-sm font-semibold',
                        PRESS,
                        item.sticky
                          ? 'border-amber-500/40 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                          : 'border-stone-300 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
                      )}
                    >
                      {item.sticky ? t('unpin') : t('pin')}
                    </button>
                    <button
                      onClick={async () => {
                        await dbDeleteItem(item.id);
                        setShowDetail(null);
                      }}
                      className={cx(
                        'flex-1 rounded-xl border border-red-500/15 bg-transparent p-3 text-sm font-semibold text-stone-400 dark:text-stone-500',
                        PRESS,
                      )}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </>
              );
            })()}
        </Modal>

        {/* Manage freezers modal — edit / delete (add lives in the dropdown) */}
        <Modal
          open={manageFreezers}
          onClose={() => {
            setManageFreezers(false);
            setEditingFreezer(null);
          }}
        >
          <h3 className="mb-4 text-center font-serif text-xl font-semibold tracking-tight">{t('manageTitle')}</h3>
          {freezers.map((f) => {
            const isEditing = editingFreezer?.id === f.id;
            return (
              <div key={f.id} className="mb-2">
                {isEditing ? (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 dark:border-white/10 dark:bg-stone-950/60">
                    <div className="mb-2.5 flex flex-wrap gap-1.5">
                      {FICONS.map((ic) => (
                        <button
                          key={ic}
                          onClick={() => setEditingFreezer((e) => ({ ...e, icon: ic }))}
                          className={cx(
                            'flex size-10 cursor-pointer items-center justify-center rounded-lg border-2 text-xl',
                            PRESS_SM,
                            editingFreezer.icon === ic
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
                      value={editingFreezer.name}
                      onChange={(e) => setEditingFreezer((es) => ({ ...es, name: e.target.value }))}
                      className="mb-2.5"
                    />
                    <div className="flex gap-2">
                      <Btn
                        onClick={async () => {
                          await dbUpdateFreezer(editingFreezer.id, {
                            name: editingFreezer.name,
                            icon: editingFreezer.icon,
                          });
                          setEditingFreezer(null);
                        }}
                        disabled={!editingFreezer.name}
                      >
                        {tc('save')}
                      </Btn>
                      <Btn v="ghost" onClick={() => setEditingFreezer(null)}>
                        {tc('cancel')}
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex h-12 flex-1 items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3.5 dark:border-stone-700 dark:bg-stone-900">
                      <span className="text-xl">{f.icon}</span>
                      <span className="text-sm font-bold text-stone-700 dark:text-stone-300">{f.name}</span>
                    </div>
                    <button
                      aria-label={ta('edit')}
                      onClick={() => setEditingFreezer({ id: f.id, name: f.name, icon: f.icon })}
                      className={cx(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
                        PRESS_SM,
                      )}
                    >
                      <Pencil className="size-4" />
                    </button>
                    {freezers.length > 1 && (
                      <button
                        aria-label={ta('delete')}
                        onClick={() =>
                          setConfirmAction({
                            message: t('deleteFreezerConfirm', { name: f.name }),
                            onConfirm: async () => {
                              await dbDeleteFreezer(f.id);
                              setSelFrzs((prev) => prev.filter((x) => x !== f.id));
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
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Modal>

        <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
      </Screen>
    );
  }

  // ═══════════════════════════
  // FREEZER - ADD (SIMPLIFIED)
  // ═══════════════════════════
  const stepLabels = addStep < 2 ? [t('step1'), t('step2')] : [t('step1'), t('step2'), t('step3')];

  return (
    <Screen>
      <PageBody key="frz-add" className="min-h-dvh">
        <div className="mb-6 flex items-center justify-between">
          <BackBtn
            onClick={() => {
              if (addStep === 0) exitAdd();
              else setAddStep(addStep - 1);
            }}
          />
          <h2 className="font-serif text-xl font-semibold tracking-tight">{t('addToFreezer')}</h2>
          <button
            aria-label={ta('close')}
            onClick={exitAdd}
            className={cx(
              'flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
              PRESS_SM,
            )}
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Progress - only active steps; the orange fill sweeps in per segment
            and the third segment glides into the row when step 2 reveals it
            (step-index keys are stable, steps never reorder; layout="position"
            so cell widths snap on the 2↔3 change — the label/fill aren't
            scale-distorted, only positions glide) */}
        <div className="relative mb-7 flex gap-1.5">
          <AnimatePresence initial={false} mode="popLayout">
            {stepLabels.map((l, i) => (
              <motion.div
                key={i}
                layout="position"
                {...CHIP_IN}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex-1 text-center"
              >
                <div className="mb-1.5 h-1 overflow-hidden rounded-xs bg-stone-200 dark:bg-stone-800">
                  <motion.div
                    initial={false}
                    animate={{ scaleX: i <= addStep ? 1 : 0 }}
                    transition={SPRING_FAST}
                    className="h-full w-full origin-left rounded-xs bg-orange-500"
                  />
                </div>
                <span
                  className={cx(
                    'text-xs font-semibold transition-colors',
                    i <= addStep ? 'text-orange-600 dark:text-orange-400' : 'text-stone-400 dark:text-stone-600',
                  )}
                >
                  {l}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <StepPane step={addStep} dir={addDir}>
          {/* STEP 0: Name + Category */}
          {addStep === 0 && (
            <div>
              <Label>{t('whatFreezing')}</Label>
              <Input
                ref={inputRef}
                value={addData.name}
                onChange={(e) => {
                  setAddData((d) => ({ ...d, name: e.target.value }));
                  setSuggestions(
                    e.target.value.length >= 2
                      ? sugg.filter((s) => s.n.toLowerCase().includes(e.target.value.toLowerCase())).slice(0, 5)
                      : [],
                  );
                }}
                placeholder={t('namePlaceholder')}
              />
              {suggestions.length > 0 && (
                <motion.div {...POPOVER_POP} className="mt-2 flex origin-top flex-col gap-1">
                  {suggestions.map((s, i) => {
                    const cat = categories[s.c] || CATS[s.c];
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          const exp = localDateFromStr(addData.frozen);
                          exp.setMonth(exp.getMonth() + (cat?.months || 6));
                          setAddData((d) => ({ ...d, name: s.n, cat: s.c, expiry: localDateStr(exp) }));
                          setSuggestions([]);
                          setAddStep(1);
                        }}
                        style={{ '--cat': cat?.color }}
                        className={cx(
                          'flex items-center gap-3 rounded-xl border border-stone-200/70 bg-white px-3.5 py-3.25 text-left text-base text-stone-900 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100',
                          PRESS_SM,
                        )}
                      >
                        <span className="text-2xl">{cat?.icon}</span>
                        <div>
                          <div className="font-semibold">{s.n}</div>
                          <div className="text-xs font-semibold text-(--cat)">
                            {catLabel(s.c, cat)} · {t('shelfLife', { months: cat?.months ?? 6 })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
              {addData.name.length >= 2 && suggestions.length === 0 && (
                <div className="mt-4">
                  <p className="mb-2.5 text-sm text-stone-400 dark:text-stone-500">{t('selectCategory')}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(categories).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => {
                          const exp = localDateFromStr(addData.frozen);
                          exp.setMonth(exp.getMonth() + (v.months || 6));
                          setAddData((d) => ({ ...d, cat: k, expiry: localDateStr(exp) }));
                          setAddStep(1);
                        }}
                        style={{ '--cat': v.color }}
                        className={cx(
                          'rounded-xl border border-stone-200/70 bg-white px-1.5 py-3.5 text-center text-stone-900 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100',
                          PRESS_SM,
                        )}
                      >
                        <div className="mb-1 text-2xl">{v.icon}</div>
                        <div className="text-xs font-semibold text-(--cat)">{catLabel(k, v)}</div>
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
                <h3 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{addData.name}</h3>
                <span className="text-sm font-semibold text-(--cat)">
                  {catLabel(addData.cat, categories[addData.cat] || CATS[addData.cat])}
                </span>
              </div>

              <Label>{tc('quantity')}</Label>
              <Input
                ref={inputRef}
                value={addData.qty}
                onChange={(e) => setAddData((d) => ({ ...d, qty: e.target.value }))}
                placeholder={t('qtyPlaceholder')}
                className="mb-2"
              />
              {/* Quick quantities: counts | divider | measures in one scrollable row */}
              <ScrollChips className="mb-5">
                {qo.counts.map(qtyChip)}
                <span aria-hidden="true" className="w-px shrink-0 self-stretch bg-stone-300 dark:bg-stone-700" />
                {qo.measures.map(qtyChip)}
              </ScrollChips>

              {/* Auto-summary */}
              <div className="mb-5 rounded-xl border border-stone-200/70 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-stone-900">
                <div className="mb-1.5 flex justify-between text-sm text-stone-500 dark:text-stone-400">
                  <span>{t('expiryDate')}:</span>
                  <span className="font-bold text-green-600 dark:text-green-400">
                    {format.dateTime(new Date(addData.expiry || recalc(addData.frozen, addData.cat)), 'day')}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-stone-500 dark:text-stone-400">
                  <span>{t('freezer')}:</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {freezers.find((f) => f.id === addData.freezer)?.icon}{' '}
                    {freezers.find((f) => f.id === addData.freezer)?.name}
                  </span>
                </div>
              </div>

              <Btn
                v="success"
                disabled={!addData.qty || adding}
                onClick={async () => {
                  setAdding(true);
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
                  exitAdd();
                }}
              >
                {t('addToFreezer')}
              </Btn>
              <Btn v="ghost" disabled={!addData.qty} onClick={() => setAddStep(2)} className="mt-2">
                {t('moreOptions')}
              </Btn>
            </div>
          )}

          {/* STEP 2: More options - packets, label, edit dates, freezer */}
          {addStep === 2 && (
            <div>
              <div className="mb-5 text-center">
                <span className="text-5xl">{(categories[addData.cat] || CATS[addData.cat])?.icon}</span>
                <h3 className="mt-2 font-serif text-2xl font-semibold tracking-tight">{addData.name}</h3>
                <span className="text-sm text-stone-400 dark:text-stone-500">
                  {addData.qty} · {catLabel(addData.cat, categories[addData.cat] || CATS[addData.cat])}
                </span>
              </div>

              <Label>{t('packets')}</Label>
              <div className="mb-4.5 flex items-center gap-3">
                <button
                  aria-label={ta('decrease')}
                  onClick={() => setAddData((d) => ({ ...d, packets: Math.max(1, d.packets - 1) }))}
                  className={STEPPER_MINUS}
                >
                  <Minus className="size-5" />
                </button>
                <TickNum value={addData.packets} className="min-w-8 text-2xl font-extrabold" />
                <button
                  aria-label={ta('increase')}
                  onClick={() => setAddData((d) => ({ ...d, packets: d.packets + 1 }))}
                  className={STEPPER_PLUS}
                >
                  <Plus className="size-5" />
                </button>
                <span className="text-sm text-stone-400 dark:text-stone-500">{t('packetsWord')}</span>
              </div>

              <Label>
                {t('label')} <span className="font-normal text-stone-400 dark:text-stone-600">({tc('optional')})</span>
              </Label>
              <LabelInp
                value={addData.label}
                onChange={(v) => setAddData((d) => ({ ...d, label: v }))}
                labels={existingLabels}
                placeholder={t('labelPlaceholder')}
              />
              <div className="h-4" />

              <div className="mb-3.5 grid grid-cols-2 gap-2.5">
                <div>
                  <Label>{t('frozen')}</Label>
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
                  <Label>{t('expiryDate')}</Label>
                  <Input
                    type="date"
                    value={addData.expiry || recalc(addData.frozen, addData.cat)}
                    onChange={(e) => setAddData((d) => ({ ...d, expiry: e.target.value }))}
                  />
                </div>
              </div>

              <Label>{t('freezer')}</Label>
              <div className="mb-6 flex flex-wrap gap-2">
                {freezers.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setAddData((d) => ({ ...d, freezer: f.id }))}
                    className={cx(
                      'cursor-pointer rounded-full border px-4 py-2.5 text-sm font-bold',
                      PRESS_SM,
                      addData.freezer === f.id ? CHIP_ON : CHIP_OFF,
                    )}
                  >
                    {f.icon} {f.name}
                  </button>
                ))}
              </div>

              <Btn
                v="success"
                disabled={adding}
                onClick={async () => {
                  setAdding(true);
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
                  exitAdd();
                }}
              >
                {t('addToFreezer')}
              </Btn>
            </div>
          )}
        </StepPane>
      </PageBody>
    </Screen>
  );
}
