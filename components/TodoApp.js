'use client';
import { useState, useRef } from 'react';
import { useTodoLists, useTodoArchivedLists, useTodoItems } from '@/lib/hooks';

const LIST_EMOJIS = ['📋', '🏖️', '🏠', '🛒', '🎉', '🪴', '🛠️', '✈️', '📚', '🥗', '🌾', '🎸', '🐶', '🌱', '💼'];

function getStyles(isDark) {
  return {
    bg: isDark ? 'linear-gradient(180deg,#0B1120 0%,#111827 40%,#0F172A 100%)' : 'linear-gradient(180deg,#F0F4FF 0%,#E8EEFF 40%,#EEF2FF 100%)',
    cardBg: isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.9)',
    cardBorder: isDark ? '1px solid rgba(71,85,105,0.2)' : '1px solid rgba(99,102,241,0.15)',
    textPrimary: isDark ? '#E2E8F0' : '#1E293B',
    textSecondary: isDark ? '#64748B' : '#94A3B8',
    textMuted: isDark ? '#334155' : '#CBD5E1',
    INP: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', background: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.9)', border: isDark ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(99,102,241,0.25)', borderRadius: 12, color: isDark ? '#E2E8F0' : '#1E293B', fontSize: 15, outline: 'none', fontWeight: 500 },
  };
}

// ─── MODAL wrapper ───
function Modal({ children, onClose, isDark }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: isDark ? 'linear-gradient(180deg,#1E293B,#0F172A)' : '#FFFFFF', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 430, padding: '24px 20px 36px', borderTop: isDark ? '1px solid rgba(71,85,105,0.3)' : '1px solid rgba(99,102,241,0.15)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: isDark ? '#334155' : '#CBD5E1', borderRadius: 2, margin: '0 auto 20px' }} />
        {children}
      </div>
    </div>
  );
}

// ─── MAIN TODO APP ───
export default function TodoApp({ user, householdId, members, lang, isDark }) {
  const st = getStyles(isDark);
  const { lists, addList, updateList, archiveList, deleteList } = useTodoLists(householdId);
  const { lists: archivedLists, unarchiveList } = useTodoArchivedLists(householdId);

  const [screen, setScreen] = useState('home'); // 'home' | 'list' | 'archive' | 'archivedList'
  const [activeList, setActiveList] = useState(null);
  const [activeArchivedList, setActiveArchivedList] = useState(null);
  const [showNewList, setShowNewList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListEmoji, setNewListEmoji] = useState('📋');
  const [newListDue, setNewListDue] = useState('');

  const A = { maxWidth: 430, margin: '0 auto', minHeight: '100vh', background: st.bg, color: st.textPrimary, fontFamily: "'Outfit','DM Sans',-apple-system,sans-serif" };

  const handleAddList = async () => {
    if (!newListTitle.trim()) return;
    await addList({ title: newListTitle.trim(), emoji: newListEmoji, due_date: newListDue || null, created_by: user.id });
    setNewListTitle(''); setNewListEmoji('📋'); setNewListDue(''); setShowNewList(false);
  };

  // ─── ARCHIVED LIST VIEW (read-only) ───
  if (screen === 'archivedList' && activeArchivedList) return (
    <TodoListScreen
      list={activeArchivedList} householdId={householdId} members={members} user={user}
      isDark={isDark} st={st} A={A}
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
      isDark={isDark} st={st} A={A}
      onBack={() => setScreen('home')}
      onArchive={async () => { await archiveList(activeList.id); setScreen('home'); }}
      onUpdateList={async (id, updates) => { await updateList(id, updates); setActiveList(l => ({ ...l, ...updates })); }}
    />
  );

  // ─── ARCHIVE ───
  if (screen === 'archive') return (
    <div style={A}>
      <div style={{ padding: '20px 16px calc(100px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <button onClick={() => setScreen('home')} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 12, padding: '10px 16px', color: st.textSecondary, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>← Nazaj</button>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: st.textPrimary }}>📦 Arhiv list</h2>
        </div>
        {archivedLists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: st.textSecondary }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>😭</div>
            <p>Ni arhiviranih list</p>
          </div>
        ) : archivedLists.map(list => (
          <div key={list.id} onClick={() => { setActiveArchivedList(list); setScreen('archivedList'); }} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 16, padding: '14px 16px', marginBottom: 8, cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{list.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: st.textPrimary }}>{list.title}</div>
                <div style={{ fontSize: 12, color: st.textSecondary }}>Arhivirano: {new Date(list.archived_at).toLocaleDateString('sl-SI')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={e => { e.stopPropagation(); unarchiveList(list.id); }} style={{ flex: 1, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', color: '#6366F1', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>↩ Vrni nazaj</button>
              <button onClick={e => { e.stopPropagation(); deleteList(list.id); }} style={{ flex: 1, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>🗑 Izbriši</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── HOME ───
  return (
    <div style={A}>
      <div style={{ padding: '20px 16px calc(100px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{lang === 'en' ? '✅ To-do' : '✅ Opravila'}</h1>
          <button onClick={() => setScreen('archive')} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 10, padding: '8px 12px', color: st.textSecondary, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>📦</button>
        </div>

        {lists.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: st.textSecondary }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: st.textPrimary }}>Ni aktivnih list</p>
            <p style={{ fontSize: 14 }}>Ustvari prvo listo z gumbom +</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lists.map(list => (
              <TodoListCard key={list.id} list={list} householdId={householdId} isDark={isDark} st={st}
                onClick={() => { setActiveList(list); setScreen('list'); }} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={() => setShowNewList(true)} style={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 20, width: 56, height: 56, borderRadius: 28, background: 'linear-gradient(135deg,#A855F7,#6366F1)', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 12px rgba(168,85,247,0.35)', zIndex: 50 }}>+</button>

      {/* New list modal */}
      {showNewList && (
        <Modal isDark={isDark} onClose={() => setShowNewList(false)}>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: st.textPrimary }}>Nova lista</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {LIST_EMOJIS.map(e => (
              <button key={e} onClick={() => setNewListEmoji(e)} style={{ fontSize: 22, padding: 7, borderRadius: 10, border: '1px solid ' + (newListEmoji === e ? 'rgba(168,85,247,0.5)' : 'rgba(71,85,105,0.2)'), background: newListEmoji === e ? 'rgba(168,85,247,0.15)' : 'transparent', cursor: 'pointer' }}>{e}</button>
            ))}
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, color: st.textSecondary, display: 'block', marginBottom: 6 }}>Naslov liste</label>
          <input autoFocus value={newListTitle} onChange={e => setNewListTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddList(); }} placeholder="npr. Gremo na morje, Za doma..." style={{ ...st.INP, marginBottom: 12 }} />
          <label style={{ fontSize: 12, fontWeight: 700, color: st.textSecondary, display: 'block', marginBottom: 6 }}>Rok (opcijsko)</label>
          <input type="date" value={newListDue} onChange={e => setNewListDue(e.target.value)} style={{ ...st.INP, marginBottom: 20, colorScheme: isDark ? 'dark' : 'light' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAddList} disabled={!newListTitle.trim()} style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: newListTitle.trim() ? 'linear-gradient(135deg,#A855F7,#6366F1)' : 'rgba(30,41,59,0.4)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: newListTitle.trim() ? 'pointer' : 'default', opacity: newListTitle.trim() ? 1 : 0.5 }}>Ustvari listo</button>
            <button onClick={() => setShowNewList(false)} style={{ flex: 1, padding: 14, borderRadius: 14, border: st.cardBorder, background: 'transparent', color: st.textSecondary, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Prekliči</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── LIST CARD (home screen) ───
function TodoListCard({ list, householdId, isDark, st, onClick }) {
  const { items } = useTodoItems(householdId, list.id);
  const done = items.filter(i => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? new Date(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  const accentColor = isPast ? '#EF4444' : isUrgent ? '#F59E0B' : '#A855F7';

  return (
    <div onClick={onClick} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 16, padding: '14px 16px', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: total > 0 ? 10 : 0 }}>
        <span style={{ fontSize: 24 }}>{list.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: st.textPrimary }}>{list.title}</div>
          {total > 0 && <div style={{ fontSize: 12, color: st.textSecondary, marginTop: 2 }}>{done}/{total} opravljenih</div>}
        </div>
        {dueDate && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: accentColor + '20', color: accentColor, flexShrink: 0 }}>
            {isPast ? '🔴 zamujeno' : dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      {total > 0 && (
        <div style={{ height: 3, background: isDark ? 'rgba(71,85,105,0.3)' : 'rgba(99,102,241,0.1)', borderRadius: 2 }}>
          <div style={{ height: '100%', borderRadius: 2, width: pct + '%', background: accentColor, transition: 'width 0.3s' }} />
        </div>
      )}
    </div>
  );
}

// ─── LIST DETAIL SCREEN ───
function TodoListScreen({ list, householdId, members, user, isDark, st, A, onBack, onArchive, onUpdateList, onUnarchive, readOnly }) {
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
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  const accentColor = isPast ? '#EF4444' : isUrgent ? '#F59E0B' : '#A855F7';

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
    <div style={A} onClick={() => assignPicker && setAssignPicker(null)}>
      <div style={{ padding: '20px 16px calc(100px + env(safe-area-inset-bottom))' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 12, padding: '10px 16px', color: st.textSecondary, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>← Nazaj</button>
          {!readOnly && <button onClick={onArchive} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 12, padding: '10px 14px', color: st.textSecondary, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>📦 Zaključi</button>}
          {readOnly && <button onClick={onUnarchive} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: '10px 14px', color: '#6366F1', fontSize: 13, cursor: 'pointer', fontWeight: 700 }}>↩ Obnovi listo</button>}
        </div>

        {/* List info */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })} style={{ fontSize: 44, marginBottom: 6, cursor: 'pointer' }}>{list.emoji}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: st.textPrimary }}>{list.title}</h2>
            {!readOnly && <button onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: st.textSecondary, fontSize: 14, padding: 4 }}>✏️</button>}
          </div>
          {dueDate && (
            <div style={{ fontSize: 13, fontWeight: 600, color: accentColor }}>
              rok: {dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'long' })}
              {daysLeft !== null && daysLeft >= 0 && ` · še ${daysLeft} dni`}
              {isPast && ' · zamujeno'}
            </div>
          )}
          {total > 0 && <div style={{ fontSize: 12, color: st.textSecondary, marginTop: 4 }}>{done}/{total} opravljenih</div>}
        </div>

        {/* Progress */}
        {total > 0 && (
          <div style={{ height: 4, background: isDark ? 'rgba(71,85,105,0.3)' : 'rgba(99,102,241,0.1)', borderRadius: 2, marginBottom: 20 }}>
            <div style={{ height: '100%', borderRadius: 2, width: pct + '%', background: accentColor, transition: 'width 0.3s' }} />
          </div>
        )}

        {/* Add item */}
        {!readOnly && <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input ref={inputRef} value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} placeholder="Dodaj opravilo..." style={{ ...st.INP, flex: 1 }} />
          <button onClick={handleAdd} disabled={!newItem.trim()} style={{ width: 48, height: 48, borderRadius: 12, border: 'none', background: newItem.trim() ? 'linear-gradient(135deg,#A855F7,#6366F1)' : 'rgba(30,41,59,0.4)', color: '#fff', fontSize: 22, cursor: newItem.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>+</button>
        </div>}

        {/* Open items */}
        {openItems.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: st.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Odprto ({openItems.length})</div>
            <div style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 16, padding: '4px 12px', marginBottom: 16 }}>
              {openItems.map((item, idx) => (
                <TodoItemRow key={item.id} item={item} isLast={idx === openItems.length - 1} member={getMember(item.assigned_to)} members={members} isDark={isDark} st={st} showPicker={assignPicker === item.id}
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
            <div style={{ fontSize: 11, fontWeight: 700, color: st.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Opravljeno ({doneItems.length})</div>
            <div style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 16, padding: '4px 12px', marginBottom: 20, opacity: 0.65 }}>
              {doneItems.map((item, idx) => (
                <TodoItemRow key={item.id} item={item} isLast={idx === doneItems.length - 1} member={getMember(item.assigned_to)} members={members} isDark={isDark} st={st} showPicker={assignPicker === item.id}
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
        <Modal isDark={isDark} onClose={() => setListEdit(null)}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: st.textPrimary }}>Uredi listo</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {LIST_EMOJIS.map(e => (
              <button key={e} onClick={() => setListEdit(d => ({ ...d, emoji: e }))} style={{ fontSize: 22, padding: 7, borderRadius: 10, border: '1px solid ' + (listEdit.emoji === e ? 'rgba(168,85,247,0.5)' : 'rgba(71,85,105,0.2)'), background: listEdit.emoji === e ? 'rgba(168,85,247,0.15)' : 'transparent', cursor: 'pointer' }}>{e}</button>
            ))}
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, color: st.textSecondary, display: 'block', marginBottom: 6 }}>Naslov liste</label>
          <input autoFocus value={listEdit.title} onChange={e => setListEdit(d => ({ ...d, title: e.target.value }))} style={{ ...st.INP, marginBottom: 12 }} />
          <label style={{ fontSize: 12, fontWeight: 700, color: st.textSecondary, display: 'block', marginBottom: 6 }}>Rok (opcijsko)</label>
          <input type="date" value={listEdit.due_date || ''} onChange={e => setListEdit(d => ({ ...d, due_date: e.target.value }))} style={{ ...st.INP, marginBottom: 20, colorScheme: isDark ? 'dark' : 'light' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={async () => { if (!listEdit.title.trim()) return; await onUpdateList(list.id, { title: listEdit.title.trim(), emoji: listEdit.emoji, due_date: listEdit.due_date || null }); setListEdit(null); }} style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#A855F7,#6366F1)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Shrani</button>
            <button onClick={() => setListEdit(null)} style={{ flex: 1, padding: 14, borderRadius: 14, border: st.cardBorder, background: 'transparent', color: st.textSecondary, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Prekliči</button>
          </div>
        </Modal>
      )}

      {/* Item detail modal */}
      {itemDetail && (
        <Modal isDark={isDark} onClose={() => setItemDetail(null)}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', color: st.textPrimary }}>Uredi opravilo</h3>
          <label style={{ fontSize: 12, fontWeight: 700, color: st.textSecondary, display: 'block', marginBottom: 6 }}>Naslov</label>
          <input
            autoFocus
            value={itemDetail.title}
            onChange={e => setItemDetail(d => ({ ...d, title: e.target.value }))}
            style={{ ...st.INP, marginBottom: 14 }}
          />
          <label style={{ fontSize: 12, fontWeight: 700, color: st.textSecondary, display: 'block', marginBottom: 6 }}>Opombe</label>
          <textarea
            value={itemDetail.notes || ''}
            onChange={e => setItemDetail(d => ({ ...d, notes: e.target.value }))}
            placeholder="Dodaj podrobnosti, opombe..."
            rows={4}
            style={{ ...st.INP, resize: 'none', lineHeight: 1.5, marginBottom: 20 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                if (!itemDetail.title.trim()) return;
                await updateItem(itemDetail.id, { title: itemDetail.title.trim(), notes: itemDetail.notes || null });
                setItemDetail(null);
              }}
              style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#A855F7,#6366F1)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >Shrani</button>
            <button onClick={() => setItemDetail(null)} style={{ flex: 1, padding: 14, borderRadius: 14, border: st.cardBorder, background: 'transparent', color: st.textSecondary, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Prekliči</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── ITEM ROW ───
function TodoItemRow({ item, isLast, member, members, isDark, st, showPicker, onToggle, onDelete, onTap, onPickerOpen, onAssign }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: isLast ? 'none' : '1px solid ' + (isDark ? 'rgba(71,85,105,0.15)' : 'rgba(99,102,241,0.08)') }}>
      <button onClick={onToggle} style={{ width: 24, height: 24, borderRadius: 7, border: '1.5px solid ' + (item.checked ? '#22C55E' : isDark ? 'rgba(71,85,105,0.5)' : 'rgba(99,102,241,0.3)'), background: item.checked ? '#22C55E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#fff', fontSize: 13, transition: 'all 0.15s' }}>
        {item.checked && '✓'}
      </button>

      <div onClick={onTap} style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: item.checked ? st.textSecondary : st.textPrimary, textDecoration: item.checked ? 'line-through' : 'none' }}>
          {item.title}
        </div>
        {item.notes && <div style={{ fontSize: 11, color: st.textSecondary, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {item.notes}</div>}
      </div>

      {/* Assign picker */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={onPickerOpen} style={{ width: 28, height: 28, borderRadius: '50%', background: member ? 'linear-gradient(135deg,#6366F1,#0EA5E9)' : isDark ? 'rgba(71,85,105,0.3)' : 'rgba(99,102,241,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: member ? '#fff' : st.textSecondary, cursor: 'pointer' }}>
          {member ? (member.display_name || '?')[0].toUpperCase() : '+'}
        </button>
        {showPicker && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: 34, background: isDark ? '#1E293B' : '#fff', border: st.cardBorder, borderRadius: 12, padding: 6, zIndex: 20, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
            <div onClick={() => onAssign(null)} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: st.textSecondary }}>Nihče</div>
            {members.map(m => (
              <div key={m.user_id || m.id} onClick={() => onAssign(m.user_id)} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, color: st.textPrimary, fontWeight: 500 }}>
                {m.display_name || 'Uporabnik'}
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={onDelete} style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', color: st.textMuted, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
    </div>
  );
}
