'use client';
import { useState, useRef } from 'react';
import { useTodoLists, useTodoArchivedLists, useTodoItems } from '@/lib/hooks';
import { cx, dueTone, DUE_TEXT, DUE_BAR, DUE_BADGE } from '@/lib/utils';
import { Screen, Modal, Input, SectionHeader } from './ui';

const LIST_EMOJIS = ['📋', '🏖️', '🏠', '🛒', '🎉', '🪴', '🛠️', '✈️', '📚', '🥗', '🌾', '🎸', '🐶', '🌱', '💼'];

// Repeated class recipes local to this module
const LBL = "block text-12 font-bold text-ink-3 mb-1.5";
const BACK_BTN = "bg-surface border border-line rounded-12 py-2.5 px-4 text-ink-3 text-14 cursor-pointer font-semibold";
const SAVE_BTN = "flex-1 p-3.5 rounded-14 border-none bg-grad-violet text-white text-15 font-bold cursor-pointer";
const CANCEL_BTN = "flex-1 p-3.5 rounded-14 border border-line bg-transparent text-ink-3 text-15 font-semibold cursor-pointer";

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
          <h2 className="text-20 font-bold text-ink">📦 Arhiv list</h2>
        </div>
        {archivedLists.length === 0 ? (
          <div className="text-center py-15 px-5 text-ink-3">
            <div className="text-48 mb-3">😭</div>
            <p>Ni arhiviranih list</p>
          </div>
        ) : archivedLists.map(list => (
          <div key={list.id} onClick={() => { setActiveArchivedList(list); setScreen('archivedList'); }} className="bg-surface border border-line rounded-16 py-3.5 px-4 mb-2 cursor-pointer">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="text-22">{list.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-15 font-semibold text-ink">{list.title}</div>
                <div className="text-12 text-ink-3">Arhivirano: {new Date(list.archived_at).toLocaleDateString('sl-SI')}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={e => { e.stopPropagation(); unarchiveList(list.id); }} className="flex-1 h-9 rounded-10 bg-accent-2/12 border border-accent-2/20 text-accent-2 cursor-pointer text-13 font-bold">↩ Vrni nazaj</button>
              <button onClick={e => { e.stopPropagation(); deleteList(list.id); }} className="flex-1 h-9 rounded-10 bg-danger/8 border border-danger/20 text-danger cursor-pointer text-13 font-bold">🗑 Izbriši</button>
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
          <h1 className="text-26 font-extrabold">{lang === 'en' ? '✅ To-do' : '✅ Opravila'}</h1>
          <button onClick={() => setScreen('archive')} className="bg-surface border border-line rounded-10 py-2 px-3 text-ink-3 text-14 cursor-pointer font-semibold">📦</button>
        </div>

        {lists.length === 0 ? (
          <div className="text-center py-15 px-5 text-ink-3">
            <div className="text-48 mb-3">📋</div>
            <p className="text-16 font-semibold mb-2 text-ink">Ni aktivnih list</p>
            <p className="text-14">Ustvari prvo listo z gumbom +</p>
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
      <button onClick={() => setShowNewList(true)} className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-5 w-14 h-14 rounded-full bg-grad-violet border-none text-white text-24 cursor-pointer shadow-fab-violet z-50">+</button>

      {/* New list modal */}
      {showNewList && (
        <Modal onClose={() => setShowNewList(false)}>
          <h3 className="text-18 font-bold mb-4 text-ink">Nova lista</h3>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {LIST_EMOJIS.map(e => (
              <button key={e} onClick={() => setNewListEmoji(e)} className={cx("text-22 p-[7px] rounded-10 border cursor-pointer", newListEmoji === e ? "border-violet/50 bg-violet/15" : "border-line bg-transparent")}>{e}</button>
            ))}
          </div>
          <label className={LBL}>Naslov liste</label>
          <Input size="sm" autoFocus value={newListTitle} onChange={e => setNewListTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddList(); }} placeholder="npr. Gremo na morje, Za doma..." className="mb-3" />
          <label className={LBL}>Rok (opcijsko)</label>
          <Input size="sm" type="date" value={newListDue} onChange={e => setNewListDue(e.target.value)} className="mb-5" />
          <div className="flex gap-2">
            <button onClick={handleAddList} disabled={!newListTitle.trim()} className={cx("flex-1 p-3.5 rounded-14 border-none text-white text-15 font-bold", newListTitle.trim() ? "bg-grad-violet cursor-pointer" : "bg-surface-2 opacity-50 cursor-default")}>Ustvari listo</button>
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
    <div onClick={onClick} className="bg-surface border border-line rounded-16 py-3.5 px-4 cursor-pointer">
      <div className={cx("flex items-center gap-2.5", total > 0 && "mb-2.5")}>
        <span className="text-24">{list.emoji}</span>
        <div className="flex-1">
          <div className="text-15 font-bold text-ink">{list.title}</div>
          {total > 0 && <div className="text-12 text-ink-3 mt-0.5">{done}/{total} opravljenih</div>}
        </div>
        {dueDate && (
          <span className={cx("text-11 font-bold px-2 py-[3px] rounded-8 shrink-0", DUE_BADGE[tone])}>
            {isPast ? '🔴 zamujeno' : dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-[3px] bg-line-strong rounded-2">
          <div className={cx("h-full rounded-2 transition-[width] duration-300", DUE_BAR[tone])} style={{ width: pct + '%' }} />
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
          {!readOnly && <button onClick={onArchive} className="bg-surface border border-line rounded-12 py-2.5 px-3.5 text-ink-3 text-13 cursor-pointer font-semibold">📦 Zaključi</button>}
          {readOnly && <button onClick={onUnarchive} className="bg-accent-2/12 border border-accent-2/20 rounded-12 py-2.5 px-3.5 text-accent-2 text-13 cursor-pointer font-bold">↩ Obnovi listo</button>}
        </div>

        {/* List info */}
        <div className="text-center mb-5">
          <div onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })} className="text-44 mb-1.5 cursor-pointer">{list.emoji}</div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h2 className="text-22 font-extrabold text-ink">{list.title}</h2>
            {!readOnly && <button onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })} className="bg-transparent border-none cursor-pointer text-ink-3 text-14 p-1">✏️</button>}
          </div>
          {dueDate && (
            <div className={cx("text-13 font-semibold", DUE_TEXT[tone])}>
              rok: {dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })}
              {daysLeft !== null && daysLeft >= 0 && ` · še ${daysLeft} dni`}
              {isPast && ' · zamujeno'}
            </div>
          )}
          {total > 0 && <div className="text-12 text-ink-3 mt-1">{done}/{total} opravljenih</div>}
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="h-1 bg-line-strong rounded-2 mb-5">
            <div className={cx("h-full rounded-2 transition-[width] duration-300", DUE_BAR[tone])} style={{ width: pct + '%' }} />
          </div>
        )}

        {/* Add item */}
        {!readOnly && <div className="flex gap-2 mb-5">
          <Input size="sm" ref={inputRef} value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} placeholder="Dodaj opravilo..." className="flex-1" />
          <button onClick={handleAdd} disabled={!newItem.trim()} className={cx("w-12 h-12 rounded-12 border-none text-white text-22 flex items-center justify-center shrink-0", newItem.trim() ? "bg-grad-violet cursor-pointer" : "bg-surface-2 cursor-default")}>+</button>
        </div>}

        {/* Open items */}
        {openItems.length > 0 && (
          <>
            <SectionHeader>Odprto ({openItems.length})</SectionHeader>
            <div className="bg-surface border border-line rounded-16 py-1 px-3 mb-4">
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
            <div className="bg-surface border border-line rounded-16 py-1 px-3 mb-5 opacity-65">
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
          <h3 className="text-16 font-bold mb-4 text-ink">Uredi listo</h3>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {LIST_EMOJIS.map(e => (
              <button key={e} onClick={() => setListEdit(d => ({ ...d, emoji: e }))} className={cx("text-22 p-[7px] rounded-10 border cursor-pointer", listEdit.emoji === e ? "border-violet/50 bg-violet/15" : "border-line bg-transparent")}>{e}</button>
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
          <h3 className="text-16 font-bold mb-4 text-ink">Uredi opravilo</h3>
          <label className={LBL}>Naslov</label>
          <Input size="sm" autoFocus value={itemDetail.title} onChange={e => setItemDetail(d => ({ ...d, title: e.target.value }))} className="mb-3.5" />
          <label className={LBL}>Opombe</label>
          <textarea
            value={itemDetail.notes || ''}
            onChange={e => setItemDetail(d => ({ ...d, notes: e.target.value }))}
            placeholder="Dodaj podrobnosti, opombe..."
            rows={4}
            className="w-full box-border px-3.5 py-3 bg-field border border-field-line rounded-12 text-ink outline-none font-medium text-15 resize-none leading-normal mb-5"
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
    <div className={cx("flex items-center gap-2.5 py-[11px]", !isLast && "border-b border-line")}>
      <button onClick={onToggle} className={cx("w-6 h-6 rounded-[7px] border-[1.5px] flex items-center justify-center cursor-pointer shrink-0 text-white text-13 transition-all duration-150", item.checked ? "bg-success border-success" : "bg-transparent border-line-strong")}>
        {item.checked && '✓'}
      </button>

      <div onClick={onTap} className="flex-1 cursor-pointer min-w-0">
        <div className={cx("text-15 font-medium", item.checked ? "text-ink-3 line-through" : "text-ink")}>
          {item.title}
        </div>
        {item.notes && <div className="text-11 text-ink-3 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">📝 {item.notes}</div>}
      </div>

      {/* Assign picker */}
      <div className="relative shrink-0">
        <button onClick={onPickerOpen} className={cx("w-7 h-7 rounded-full border-none flex items-center justify-center text-12 font-bold cursor-pointer", member ? "bg-grad-primary text-white" : "bg-line-strong text-ink-3")}>
          {member ? (member.display_name || '?')[0].toUpperCase() : '+'}
        </button>
        {showPicker && (
          <div onClick={e => e.stopPropagation()} className="absolute right-0 top-[34px] bg-surface-solid border border-line rounded-12 p-1.5 z-20 min-w-[150px] shadow-pop">
            <div onClick={() => onAssign(null)} className="py-2 px-2.5 rounded-8 cursor-pointer text-13 text-ink-3">Nihče</div>
            {members.map(m => (
              <div key={m.user_id || m.id} onClick={() => onAssign(m.user_id)} className="py-2 px-2.5 rounded-8 cursor-pointer text-13 text-ink font-medium">
                {m.display_name || 'Uporabnik'}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onDelete} className="w-6 h-6 rounded-6 bg-transparent border-none text-ink-dim cursor-pointer text-14 flex items-center justify-center shrink-0">✕</button>
    </div>
  );
}
