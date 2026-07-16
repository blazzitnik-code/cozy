'use client';
import { useState, useRef } from 'react';
import { useTodoLists, useTodoArchivedLists, useTodoItems } from '@/lib/hooks';
import { cx, dueTone, DUE_TEXT, DUE_BAR, DUE_BADGE } from '@/lib/utils';
import { Screen, Modal, Input, SectionHeader } from './ui';

const LIST_EMOJIS = ['📋', '🏖️', '🏠', '🛒', '🎉', '🪴', '🛠️', '✈️', '📚', '🥗', '🌾', '🎸', '🐶', '🌱', '💼'];

// Repeated class recipes local to this module
const LBL = "block text-xs font-bold text-slate-400 dark:text-slate-500 mb-1.5";
const BACK_BTN = "bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-xl py-2.5 px-4 text-slate-400 dark:text-slate-500 text-sm cursor-pointer font-semibold";
const SAVE_BTN = "flex-1 p-3.5 rounded-xl border-none bg-linear-135 from-purple-500 to-indigo-500 text-white text-base font-bold cursor-pointer";
const CANCEL_BTN = "flex-1 p-3.5 rounded-xl border border-indigo-500/15 dark:border-slate-600/20 bg-transparent text-slate-400 dark:text-slate-500 text-base font-semibold cursor-pointer";

// ─── MAIN TODO APP ───
export default function TodoApp({ user, householdId, members, lang }) {
  const { lists, addList, updateList, archiveList, deleteList } = useTodoLists(householdId);
  const { lists: archivedLists, unarchiveList } = useTodoArchivedLists(householdId);

  const [screen, setScreen] = useState('home'); // 'home' | 'list' | 'archive' | 'archivedList'
  const [activeList, setActiveList] = useState(null);
  const [activeArchivedList, setActiveArchivedList] = useState(null);
  const [showNewList, setShowNewList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListEmoji, setNewListEmoji] = useState('📋');
  const [newListDue, setNewListDue] = useState('');

  const handleAddList = async () => {
    if (!newListTitle.trim()) return;
    await addList({ title: newListTitle.trim(), emoji: newListEmoji, due_date: newListDue || null, created_by: user.id });
    setNewListTitle(''); setNewListEmoji('📋'); setNewListDue(''); setShowNewList(false);
  };

  // ─── ARCHIVED LIST VIEW (read-only) ───
  if (screen === 'archivedList' && activeArchivedList) return (
    <TodoListScreen
      list={activeArchivedList} householdId={householdId} members={members} user={user}
      onBack={() => setScreen('archive')}
      onArchive={null}
      onUpdateList={null}
      onUnarchive={async () => { await unarchiveList(activeArchivedList.id); setScreen('home'); }}
      readOnly
    />
  );

  // ─── LIST DETAIL ───
  if (screen === 'list' && activeList) return (
    <TodoListScreen
      list={activeList} householdId={householdId} members={members} user={user}
      onBack={() => setScreen('home')}
      onArchive={async () => { await archiveList(activeList.id); setScreen('home'); }}
      onUpdateList={async (id, updates) => { await updateList(id, updates); setActiveList(l => ({ ...l, ...updates })); }}
    />
  );

  // ─── ARCHIVE ───
  if (screen === 'archive') return (
    <Screen>
      <div className="pt-5 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2.5 mb-6">
          <button onClick={() => setScreen('home')} className={BACK_BTN}>← Nazaj</button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">📦 Arhiv list</h2>
        </div>
        {archivedLists.length === 0 ? (
          <div className="text-center py-15 px-5 text-slate-400 dark:text-slate-500">
            <div className="text-5xl mb-3">😭</div>
            <p>Ni arhiviranih list</p>
          </div>
        ) : archivedLists.map(list => (
          <div key={list.id} onClick={() => { setActiveArchivedList(list); setScreen('archivedList'); }} className="bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-2xl py-3.5 px-4 mb-2 cursor-pointer">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="text-2xl">{list.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-slate-800 dark:text-slate-200">{list.title}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">Arhivirano: {new Date(list.archived_at).toLocaleDateString('sl-SI')}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={e => { e.stopPropagation(); unarchiveList(list.id); }} className="flex-1 h-9 rounded-lg bg-indigo-500/12 border border-indigo-500/20 text-indigo-500 cursor-pointer text-sm font-bold">↩ Vrni nazaj</button>
              <button onClick={e => { e.stopPropagation(); deleteList(list.id); }} className="flex-1 h-9 rounded-lg bg-red-500/8 border border-red-500/20 text-red-500 cursor-pointer text-sm font-bold">🗑 Izbriši</button>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );

  // ─── HOME ───
  return (
    <Screen>
      <div className="pt-5 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold">{lang === 'en' ? '✅ To-do' : '✅ Opravila'}</h1>
          <button onClick={() => setScreen('archive')} className="bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-lg py-2 px-3 text-slate-400 dark:text-slate-500 text-sm cursor-pointer font-semibold">📦</button>
        </div>

        {lists.length === 0 ? (
          <div className="text-center py-15 px-5 text-slate-400 dark:text-slate-500">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-base font-semibold mb-2 text-slate-800 dark:text-slate-200">Ni aktivnih list</p>
            <p className="text-sm">Ustvari prvo listo z gumbom +</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {lists.map(list => (
              <TodoListCard key={list.id} list={list} householdId={householdId}
                onClick={() => { setActiveList(list); setScreen('list'); }} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowNewList(true)} className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-5 w-14 h-14 rounded-full bg-linear-135 from-purple-500 to-indigo-500 border-none text-white text-2xl cursor-pointer shadow-lg shadow-purple-500/35 z-50">+</button>

      {/* New list modal */}
      {showNewList && (
        <Modal onClose={() => setShowNewList(false)}>
          <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-200">Nova lista</h3>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {LIST_EMOJIS.map(e => (
              <button key={e} onClick={() => setNewListEmoji(e)} className={cx("text-2xl p-1.75 rounded-lg border cursor-pointer", newListEmoji === e ? "border-purple-500/50 bg-purple-500/15" : "border-indigo-500/15 dark:border-slate-600/20 bg-transparent")}>{e}</button>
            ))}
          </div>
          <label className={LBL}>Naslov liste</label>
          <Input size="sm" autoFocus value={newListTitle} onChange={e => setNewListTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddList(); }} placeholder="npr. Gremo na morje, Za doma..." className="mb-3" />
          <label className={LBL}>Rok (opcijsko)</label>
          <Input size="sm" type="date" value={newListDue} onChange={e => setNewListDue(e.target.value)} className="mb-5" />
          <div className="flex gap-2">
            <button onClick={handleAddList} disabled={!newListTitle.trim()} className={cx("flex-1 p-3.5 rounded-xl border-none text-white text-base font-bold", newListTitle.trim() ? "bg-linear-135 from-purple-500 to-indigo-500 cursor-pointer" : "bg-white/70 dark:bg-slate-800/50 opacity-50 cursor-default")}>Ustvari listo</button>
            <button onClick={() => setShowNewList(false)} className={CANCEL_BTN}>Prekliči</button>
          </div>
        </Modal>
      )}
    </Screen>
  );
}

// ─── LIST CARD (home screen) ───
function TodoListCard({ list, householdId, onClick }) {
  const { items } = useTodoItems(householdId, list.id);
  const done = items.filter(i => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? new Date(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const tone = dueTone(daysLeft);

  return (
    <div onClick={onClick} className="bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-2xl py-3.5 px-4 cursor-pointer">
      <div className={cx("flex items-center gap-2.5", total > 0 && "mb-2.5")}>
        <span className="text-2xl">{list.emoji}</span>
        <div className="flex-1">
          <div className="text-base font-bold text-slate-800 dark:text-slate-200">{list.title}</div>
          {total > 0 && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{done}/{total} opravljenih</div>}
        </div>
        {dueDate && (
          <span className={cx("text-xs font-bold px-2 py-0.75 rounded-lg shrink-0", DUE_BADGE[tone])}>
            {isPast ? '🔴 zamujeno' : dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-0.75 bg-indigo-500/20 dark:bg-slate-600/30 rounded-xs">
          <div className={cx("h-full rounded-xs transition-[width] duration-300", DUE_BAR[tone])} style={{ width: pct + '%' }} />
        </div>
      )}
    </div>
  );
}

// ─── LIST DETAIL SCREEN ───
function TodoListScreen({ list, householdId, members, user, onBack, onArchive, onUpdateList, onUnarchive, readOnly }) {
  const { items, addItem, toggleItem, deleteItem, updateItem } = useTodoItems(householdId, list.id);
  const [newItem, setNewItem] = useState('');
  const [assignPicker, setAssignPicker] = useState(null); // item id
  const [itemDetail, setItemDetail] = useState(null); // item being edited
  const [listEdit, setListEdit] = useState(null); // { title, emoji, due_date }
  const inputRef = useRef(null);

  const done = items.filter(i => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? new Date(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const tone = dueTone(daysLeft);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    await addItem(newItem.trim());
    setNewItem('');
    inputRef.current?.focus();
  };

  const openItems = items.filter(i => !i.checked).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const doneItems = items.filter(i => i.checked).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const getMember = (userId) => members.find(m => m.user_id === userId);

  return (
    <Screen onClick={() => assignPicker && setAssignPicker(null)}>
      <div className="pt-5 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className={BACK_BTN}>← Nazaj</button>
          {!readOnly && <button onClick={onArchive} className="bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-xl py-2.5 px-3.5 text-slate-400 dark:text-slate-500 text-sm cursor-pointer font-semibold">📦 Zaključi</button>}
          {readOnly && <button onClick={onUnarchive} className="bg-indigo-500/12 border border-indigo-500/20 rounded-xl py-2.5 px-3.5 text-indigo-500 text-sm cursor-pointer font-bold">↩ Obnovi listo</button>}
        </div>

        {/* List info */}
        <div className="text-center mb-5">
          <div onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })} className="text-5xl mb-1.5 cursor-pointer">{list.emoji}</div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-200">{list.title}</h2>
            {!readOnly && <button onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })} className="bg-transparent border-none cursor-pointer text-slate-400 dark:text-slate-500 text-sm p-1">✏️</button>}
          </div>
          {dueDate && (
            <div className={cx("text-sm font-semibold", DUE_TEXT[tone])}>
              rok: {dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })}
              {daysLeft !== null && daysLeft >= 0 && ` · še ${daysLeft} dni`}
              {isPast && ' · zamujeno'}
            </div>
          )}
          {total > 0 && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{done}/{total} opravljenih</div>}
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="h-1 bg-indigo-500/20 dark:bg-slate-600/30 rounded-xs mb-5">
            <div className={cx("h-full rounded-xs transition-[width] duration-300", DUE_BAR[tone])} style={{ width: pct + '%' }} />
          </div>
        )}

        {/* Add item */}
        {!readOnly && <div className="flex gap-2 mb-5">
          <Input size="sm" ref={inputRef} value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} placeholder="Dodaj opravilo..." className="flex-1" />
          <button onClick={handleAdd} disabled={!newItem.trim()} className={cx("w-12 h-12 rounded-xl border-none text-white text-2xl flex items-center justify-center shrink-0", newItem.trim() ? "bg-linear-135 from-purple-500 to-indigo-500 cursor-pointer" : "bg-white/70 dark:bg-slate-800/50 cursor-default")}>+</button>
        </div>}

        {/* Open items */}
        {openItems.length > 0 && (
          <>
            <SectionHeader>Odprto ({openItems.length})</SectionHeader>
            <div className="bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-2xl py-1 px-3 mb-4">
              {openItems.map((item, idx) => (
                <TodoItemRow key={item.id} item={item} isLast={idx === openItems.length - 1} member={getMember(item.assigned_to)} members={members} showPicker={assignPicker === item.id}
                  onToggle={() => toggleItem(item.id)} onDelete={() => deleteItem(item.id)}
                  onTap={() => setItemDetail({ ...item })}
                  onPickerOpen={e => { e.stopPropagation(); setAssignPicker(item.id); }}
                  onAssign={userId => { updateItem(item.id, { assigned_to: userId }); setAssignPicker(null); }} />
              ))}
            </div>
          </>
        )}

        {/* Done items */}
        {doneItems.length > 0 && (
          <>
            <SectionHeader>Opravljeno ({doneItems.length})</SectionHeader>
            <div className="bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-2xl py-1 px-3 mb-5 opacity-65">
              {doneItems.map((item, idx) => (
                <TodoItemRow key={item.id} item={item} isLast={idx === doneItems.length - 1} member={getMember(item.assigned_to)} members={members} showPicker={assignPicker === item.id}
                  onToggle={() => toggleItem(item.id)} onDelete={() => deleteItem(item.id)}
                  onTap={() => setItemDetail({ ...item })}
                  onPickerOpen={e => { e.stopPropagation(); setAssignPicker(item.id); }}
                  onAssign={userId => { updateItem(item.id, { assigned_to: userId }); setAssignPicker(null); }} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* List edit modal */}
      {listEdit && (
        <Modal onClose={() => setListEdit(null)}>
          <h3 className="text-base font-bold mb-4 text-slate-800 dark:text-slate-200">Uredi listo</h3>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {LIST_EMOJIS.map(e => (
              <button key={e} onClick={() => setListEdit(d => ({ ...d, emoji: e }))} className={cx("text-2xl p-1.75 rounded-lg border cursor-pointer", listEdit.emoji === e ? "border-purple-500/50 bg-purple-500/15" : "border-indigo-500/15 dark:border-slate-600/20 bg-transparent")}>{e}</button>
            ))}
          </div>
          <label className={LBL}>Naslov liste</label>
          <Input size="sm" autoFocus value={listEdit.title} onChange={e => setListEdit(d => ({ ...d, title: e.target.value }))} className="mb-3" />
          <label className={LBL}>Rok (opcijsko)</label>
          <Input size="sm" type="date" value={listEdit.due_date || ''} onChange={e => setListEdit(d => ({ ...d, due_date: e.target.value }))} className="mb-5" />
          <div className="flex gap-2">
            <button onClick={async () => { if (!listEdit.title.trim()) return; await onUpdateList(list.id, { title: listEdit.title.trim(), emoji: listEdit.emoji, due_date: listEdit.due_date || null }); setListEdit(null); }} className={SAVE_BTN}>Shrani</button>
            <button onClick={() => setListEdit(null)} className={CANCEL_BTN}>Prekliči</button>
          </div>
        </Modal>
      )}

      {/* Item detail modal */}
      {itemDetail && (
        <Modal onClose={() => setItemDetail(null)}>
          <h3 className="text-base font-bold mb-4 text-slate-800 dark:text-slate-200">Uredi opravilo</h3>
          <label className={LBL}>Naslov</label>
          <Input size="sm" autoFocus value={itemDetail.title} onChange={e => setItemDetail(d => ({ ...d, title: e.target.value }))} className="mb-3.5" />
          <label className={LBL}>Opombe</label>
          <textarea
            value={itemDetail.notes || ''}
            onChange={e => setItemDetail(d => ({ ...d, notes: e.target.value }))}
            placeholder="Dodaj podrobnosti, opombe..."
            rows={4}
            className="w-full box-border px-3.5 py-3 bg-white/90 dark:bg-slate-800/80 border border-indigo-500/25 dark:border-indigo-500/30 rounded-xl text-slate-800 dark:text-slate-200 outline-none font-medium text-base resize-none leading-normal mb-5"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (!itemDetail.title.trim()) return;
                await updateItem(itemDetail.id, { title: itemDetail.title.trim(), notes: itemDetail.notes || null });
                setItemDetail(null);
              }}
              className={SAVE_BTN}
            >Shrani</button>
            <button onClick={() => setItemDetail(null)} className={CANCEL_BTN}>Prekliči</button>
          </div>
        </Modal>
      )}
    </Screen>
  );
}

// ─── ITEM ROW ───
function TodoItemRow({ item, isLast, member, members, showPicker, onToggle, onDelete, onTap, onPickerOpen, onAssign }) {
  return (
    <div className={cx("flex items-center gap-2.5 py-2.75", !isLast && "border-b border-indigo-500/15 dark:border-slate-600/20")}>
      <button onClick={onToggle} className={cx("w-6 h-6 rounded-md border-2 flex items-center justify-center cursor-pointer shrink-0 text-white text-sm transition-all duration-150", item.checked ? "bg-green-500 border-green-500" : "bg-transparent border-indigo-500/20 dark:border-slate-600/30")}>
        {item.checked && '✓'}
      </button>

      <div onClick={onTap} className="flex-1 cursor-pointer min-w-0">
        <div className={cx("text-base font-medium", item.checked ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-800 dark:text-slate-200")}>
          {item.title}
        </div>
        {item.notes && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">📝 {item.notes}</div>}
      </div>

      {/* Assign picker */}
      <div className="relative shrink-0">
        <button onClick={onPickerOpen} className={cx("w-7 h-7 rounded-full border-none flex items-center justify-center text-xs font-bold cursor-pointer", member ? "bg-linear-135 from-sky-500 to-indigo-500 text-white" : "bg-indigo-500/20 dark:bg-slate-600/30 text-slate-400 dark:text-slate-500")}>
          {member ? (member.display_name || '?')[0].toUpperCase() : '+'}
        </button>
        {showPicker && (
          <div onClick={e => e.stopPropagation()} className="absolute right-0 top-8.5 bg-white dark:bg-slate-800 border border-indigo-500/15 dark:border-slate-600/20 rounded-xl p-1.5 z-20 min-w-37.5 shadow-lg shadow-black/40">
            <div onClick={() => onAssign(null)} className="py-2 px-2.5 rounded-lg cursor-pointer text-sm text-slate-400 dark:text-slate-500">Nihče</div>
            {members.map(m => (
              <div key={m.user_id || m.id} onClick={() => onAssign(m.user_id)} className="py-2 px-2.5 rounded-lg cursor-pointer text-sm text-slate-800 dark:text-slate-200 font-medium">
                {m.display_name || 'Uporabnik'}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onDelete} className="w-6 h-6 rounded-md bg-transparent border-none text-slate-300 dark:text-slate-600 cursor-pointer text-sm flex items-center justify-center shrink-0">✕</button>
    </div>
  );
}
