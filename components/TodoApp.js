'use client';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react';
import { useTranslations, useFormatter } from 'next-intl';
import { Check, GripVertical, History, Pencil, Plus, Settings, Star, X } from 'lucide-react';
import { cx, dueTone, localDateFromStr, DUE_TEXT, DUE_BAR, DUE_BADGE } from '@/lib/utils';
import {
  Screen,
  PageBody,
  Card,
  Fab,
  Modal,
  Input,
  Label,
  SectionHeader,
  BackBtn,
  ModalActions,
  ModuleHeader,
  IconButton,
  EmptyState,
  Pill,
  POPOVER,
  POPOVER_POP,
  POP,
  LIST_ROW,
  PRESS,
  PRESS_SM,
  ROW_PRESS,
} from './ui';

const LIST_EMOJIS = ['📋', '🏖️', '🏠', '🛒', '🎉', '🪴', '🛠️', '✈️', '📚', '🥗', '🌾', '🎸', '🐶', '🌱', '💼'];

// ─── MAIN TODO APP ───
// All todo data + mutators arrive via props from AppShell's persistent hooks,
// so tab switches remount this module with warm data (no refetch flicker).
export default function TodoApp({
  user,
  members,
  lists,
  listsLoading,
  archivedLists,
  addList,
  updateList,
  archiveList,
  unarchiveList,
  deleteList,
  itemsByList,
  addItem,
  updateItem,
  deleteItem,
  toggleItem,
  onOpenSettings,
  onGoHome,
}) {
  const t = useTranslations('Todo');
  const ta = useTranslations('A11y');
  const tMod = useTranslations('Modules');
  const format = useFormatter();

  const [screen, setScreen] = useState('home'); // 'home' | 'list' | 'archive' | 'archivedList'
  const [activeList, setActiveList] = useState(null);
  const [activeArchivedList, setActiveArchivedList] = useState(null);
  const [showNewList, setShowNewList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newListEmoji, setNewListEmoji] = useState('📋');
  const [newListDue, setNewListDue] = useState('');
  const [creatingList, setCreatingList] = useState(false);

  const handleAddList = async () => {
    if (!newListTitle.trim() || creatingList) return; // guard rapid double-submit
    setCreatingList(true);
    try {
      await addList({
        title: newListTitle.trim(),
        emoji: newListEmoji,
        due_date: newListDue || null,
        created_by: user.id,
      });
      setNewListTitle('');
      setNewListEmoji('📋');
      setNewListDue('');
      setShowNewList(false);
    } finally {
      setCreatingList(false);
    }
  };

  // ─── ARCHIVED LIST VIEW (read-only) ───
  if (screen === 'archivedList' && activeArchivedList)
    return (
      <TodoListScreen
        list={activeArchivedList}
        items={itemsByList[activeArchivedList.id] || []}
        addItem={(title) => addItem(activeArchivedList.id, title)}
        updateItem={updateItem}
        deleteItem={deleteItem}
        toggleItem={toggleItem}
        members={members}
        user={user}
        onBack={() => setScreen('archive')}
        onArchive={null}
        onUpdateList={null}
        onUnarchive={async () => {
          await unarchiveList(activeArchivedList.id);
          setScreen('home');
        }}
        readOnly
      />
    );

  // ─── LIST DETAIL ───
  if (screen === 'list' && activeList)
    return (
      <TodoListScreen
        list={activeList}
        items={itemsByList[activeList.id] || []}
        addItem={(title) => addItem(activeList.id, title)}
        updateItem={updateItem}
        deleteItem={deleteItem}
        toggleItem={toggleItem}
        members={members}
        user={user}
        onBack={() => setScreen('home')}
        onArchive={async () => {
          await archiveList(activeList.id);
          setScreen('home');
        }}
        onUpdateList={async (id, updates) => {
          await updateList(id, updates);
          setActiveList((l) => ({ ...l, ...updates }));
        }}
      />
    );

  // ─── ARCHIVE ───
  if (screen === 'archive')
    return (
      <Screen>
        <PageBody key="todo-archive">
          <div className="mb-6 flex items-center gap-2.5">
            <BackBtn onClick={() => setScreen('home')} />
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {t('archiveTitle')}
            </h2>
          </div>
          {archivedLists.length === 0 ? (
            listsLoading ? null : (
              <EmptyState icon="😭">{t('noArchived')}</EmptyState>
            )
          ) : (
            archivedLists.map((list) => (
              <Card
                key={list.id}
                onClick={() => {
                  setActiveArchivedList(list);
                  setScreen('archivedList');
                }}
                // press={false}: the card holds Restore/Delete buttons — an
                // ancestor :active scale would fire on their presses too, so
                // the card's own feedback is a ROW_PRESS bg tint instead.
                press={false}
                className={cx('mb-2 px-4 py-3.5', ROW_PRESS)}
              >
                <div className="mb-2.5 flex items-center gap-2.5">
                  <span className="text-2xl">{list.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold text-stone-900 dark:text-stone-100">{list.title}</div>
                    <div className="text-xs text-stone-400 dark:text-stone-500">
                      {t('archivedAt', { date: format.dateTime(new Date(list.archived_at), 'numericDate') })}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      unarchiveList(list.id);
                    }}
                    className={cx(
                      'h-9 flex-1 rounded-full border-none bg-stone-900 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900',
                      PRESS_SM,
                    )}
                  >
                    {t('restore')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteList(list.id);
                    }}
                    className={cx(
                      'h-9 flex-1 rounded-full border border-red-500/25 bg-red-500/10 text-sm font-bold text-red-600 dark:text-red-400',
                      PRESS_SM,
                    )}
                  >
                    {t('delete')}
                  </button>
                </div>
              </Card>
            ))
          )}
        </PageBody>
      </Screen>
    );

  // ─── HOME ───
  return (
    <Screen>
      <PageBody key="todo-home">
        <ModuleHeader title={tMod('todo')} emoji="✅" onHome={onGoHome}>
          <IconButton onClick={() => setScreen('archive')} aria-label={ta('archive')}>
            <History className="size-4.5" />
          </IconButton>
          <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
            <Settings className="size-4.5" />
          </IconButton>
        </ModuleHeader>

        {lists.length === 0 ? (
          // Cold start only: while the first fetch runs, render nothing so
          // the empty state can't flash before data arrives.
          listsLoading ? null : (
            <EmptyState icon="📋">
              <p className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-100">{t('noLists')}</p>
              <p>{t('createFirst')}</p>
            </EmptyState>
          )
        ) : (
          <div className="relative flex flex-col gap-2.5">
            <AnimatePresence initial={false} mode="popLayout">
              {lists.map((list) => (
                <motion.div {...LIST_ROW} key={list.id}>
                  <TodoListCard
                    list={list}
                    items={itemsByList[list.id] || []}
                    onClick={() => {
                      setActiveList(list);
                      setScreen('list');
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </PageBody>

      {/* FAB */}
      <Fab onClick={() => setShowNewList(true)} />

      {/* New list modal */}
      <Modal open={showNewList} onClose={() => setShowNewList(false)}>
        <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {t('newList')}
        </h3>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {LIST_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setNewListEmoji(e)}
              className={cx(
                'cursor-pointer rounded-lg border p-1.75 text-2xl',
                PRESS_SM,
                newListEmoji === e
                  ? 'border-stone-900 bg-stone-100 dark:border-stone-100 dark:bg-stone-800'
                  : 'border-stone-200 bg-transparent dark:border-white/10',
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <Label className="mb-1.5 text-xs">{t('listTitle')}</Label>
        <Input
          autoFocus
          value={newListTitle}
          onChange={(e) => setNewListTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddList();
          }}
          placeholder={t('listTitlePlaceholder')}
          className="mb-3"
        />
        <Label className="mb-1.5 text-xs">{t('due')}</Label>
        <Input type="date" value={newListDue} onChange={(e) => setNewListDue(e.target.value)} className="mb-5" />
        <ModalActions
          saveLabel={t('createList')}
          disabled={!newListTitle.trim() || creatingList}
          onSave={handleAddList}
          onCancel={() => setShowNewList(false)}
        />
      </Modal>
    </Screen>
  );
}

// ─── LIST CARD (home screen) ───
function TodoListCard({ list, items, onClick }) {
  const t = useTranslations('Todo');
  const format = useFormatter();
  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? localDateFromStr(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const tone = dueTone(daysLeft);

  return (
    <Card onClick={onClick} className="px-4 py-3.5">
      <div className={cx('flex items-center gap-2.5', total > 0 && 'mb-2.5')}>
        <span className="text-2xl">{list.emoji}</span>
        <div className="flex-1">
          <div className="text-base font-bold text-stone-900 dark:text-stone-100">{list.title}</div>
          {total > 0 && (
            <div className="mt-0.5 text-xs text-stone-400 dark:text-stone-500">{t('progress', { done, total })}</div>
          )}
        </div>
        {dueDate && (
          <span className={cx('shrink-0 rounded-lg px-2 py-0.75 text-xs font-bold', DUE_BADGE[tone])}>
            {isPast ? t('overdueBadge') : format.dateTime(dueDate, 'dayShort')}
          </span>
        )}
      </div>
      {total > 0 && (
        <div className="h-0.75 rounded-xs bg-stone-200 dark:bg-stone-800">
          <div
            className={cx('h-full rounded-xs transition-[width] duration-300', DUE_BAR[tone])}
            style={{ width: pct + '%' }}
          />
        </div>
      )}
    </Card>
  );
}

// ─── LIST DETAIL SCREEN ───
function TodoListScreen({
  list,
  items,
  addItem,
  toggleItem,
  deleteItem,
  updateItem,
  members,
  user,
  onBack,
  onArchive,
  onUpdateList,
  onUnarchive,
  readOnly,
}) {
  const t = useTranslations('Todo');
  const ta = useTranslations('A11y');
  const format = useFormatter();
  const [newItem, setNewItem] = useState('');
  const [assignPicker, setAssignPicker] = useState(null); // item id
  const [itemDetail, setItemDetail] = useState(null); // item being edited
  const [listEdit, setListEdit] = useState(null); // { title, emoji, due_date }
  const [onlyMine, setOnlyMine] = useState(false); // filter rows to items assigned to me
  const [onlyImportant, setOnlyImportant] = useState(false); // filter rows to starred items
  const inputRef = useRef(null);

  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? localDateFromStr(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const tone = dueTone(daysLeft);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    await addItem(newItem.trim());
    setNewItem('');
    inputRef.current?.focus();
  };

  // "Only mine" / "Important" filter which rows render (combinable, AND) —
  // done/total and the progress bar above still reflect the WHOLE list
  // regardless, since these are view preferences, not a change to what the
  // list actually contains.
  const visibleItems = items
    .filter((i) => !onlyMine || i.assigned_to === user.id)
    .filter((i) => !onlyImportant || i.important);
  const openItems = visibleItems.filter((i) => !i.checked).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const doneItems = visibleItems.filter((i) => i.checked).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const hasImportant = items.some((i) => i.important);
  const getMember = (userId) => members.find((m) => m.user_id === userId);

  // Stable handlers so memo'd TodoItemRows skip re-render when siblings change.
  const openItemDetail = useCallback((it) => setItemDetail({ ...it }), []);
  const assignMember = useCallback(
    (id, userId) => {
      updateItem(id, { assigned_to: userId });
      setAssignPicker(null);
    },
    [updateItem],
  );

  // Persist a drag reorder: reassign sort_order for the dragged segment only
  // (same approach as persistGroupOrder in ShoppingModule.js). updateItem is
  // already optimistic (local state applies instantly, write happens in the
  // background), so no need to await here.
  const persistItemOrder = useCallback(
    (ordered) => {
      let slots = ordered.map((i) => i.sort_order ?? 0).sort((a, b) => a - b);
      if (new Set(slots).size !== slots.length) {
        slots = ordered.map((_, idx) => slots[0] + idx);
      }
      ordered.forEach((item, idx) => {
        if ((item.sort_order ?? 0) !== slots[idx]) updateItem(item.id, { sort_order: slots[idx] });
      });
    },
    [updateItem],
  );

  return (
    <Screen onClick={() => assignPicker && setAssignPicker(null)}>
      <PageBody key={`todo-list-${list.id}`}>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <BackBtn onClick={onBack} />
          {!readOnly && (
            <BackBtn icon={Check} onClick={onArchive} className="px-3.5">
              {t('finish')}
            </BackBtn>
          )}
          {readOnly && (
            <button
              onClick={onUnarchive}
              className={cx(
                'rounded-full border-none bg-stone-900 px-3.5 py-2.5 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900',
                PRESS,
              )}
            >
              {t('restoreList')}
            </button>
          )}
        </div>

        {/* List info */}
        <div className="mb-5 text-center">
          <div
            onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })}
            className={cx('mb-1.5 inline-block cursor-pointer text-5xl', PRESS_SM)}
          >
            {list.emoji}
          </div>
          <div className="mb-1 flex items-center justify-center gap-2">
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {list.title}
            </h2>
            {!readOnly && (
              <button
                aria-label={ta('edit')}
                onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })}
                className={cx('border-none bg-transparent p-1 text-stone-400 dark:text-stone-500', PRESS_SM)}
              >
                <Pencil className="size-4" />
              </button>
            )}
          </div>
          {dueDate && (
            <div className={cx('text-sm font-semibold', DUE_TEXT[tone])}>
              {t('dueLabel', { date: format.dateTime(dueDate, 'dayMonthLong') })}
              {daysLeft !== null && daysLeft >= 0 && ` · ${t('daysLeft', { days: daysLeft })}`}
              {isPast && ` · ${t('overdueWord')}`}
            </div>
          )}
          {total > 0 && (
            <div className="mt-1 text-xs text-stone-400 dark:text-stone-500">{t('progress', { done, total })}</div>
          )}
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="mb-5 h-1 rounded-xs bg-stone-200 dark:bg-stone-800">
            <div
              className={cx('h-full rounded-xs transition-[width] duration-300', DUE_BAR[tone])}
              style={{ width: pct + '%' }}
            />
          </div>
        )}

        {/* Add item */}
        {!readOnly && (
          <div className="mb-5 flex gap-2">
            <Input
              ref={inputRef}
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder={t('addItemPlaceholder')}
              className="flex-1"
            />
            <button
              onClick={handleAdd}
              disabled={!newItem.trim()}
              aria-label={ta('add')}
              className={cx(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-none',
                PRESS_SM,
                newItem.trim()
                  ? 'cursor-pointer bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'cursor-default bg-stone-200 text-stone-400 dark:bg-stone-800 dark:text-stone-600',
              )}
            >
              <Plus className="size-5.5" />
            </button>
          </div>
        )}

        {/* Filters: assignee (2+ members only) + starred (once something's starred) */}
        {((members.length > 1 && total > 0) || hasImportant) && (
          <div className="mb-4 flex flex-wrap justify-end gap-1.5">
            {hasImportant && (
              <Pill small active={onlyImportant} onClick={() => setOnlyImportant((v) => !v)}>
                <Star className={cx('mr-1 inline size-3', onlyImportant && 'fill-current')} />
                {t('important')}
              </Pill>
            )}
            {members.length > 1 && total > 0 && (
              <Pill small active={onlyMine} onClick={() => setOnlyMine((v) => !v)}>
                {t('onlyMine')}
              </Pill>
            )}
          </div>
        )}

        {/* Open items */}
        {openItems.length > 0 && (
          <>
            <SectionHeader>{t('open', { count: openItems.length })}</SectionHeader>
            <Card className="relative mb-4 px-3 py-1">
              <TodoItemGroup
                items={openItems}
                members={members}
                assignPicker={assignPicker}
                getMember={getMember}
                onPersist={persistItemOrder}
                onToggle={toggleItem}
                onDelete={deleteItem}
                onTap={openItemDetail}
                onPickerOpen={setAssignPicker}
                onAssign={assignMember}
              />
            </Card>
          </>
        )}

        {/* Done items */}
        {doneItems.length > 0 && (
          <>
            <SectionHeader>{t('doneSection', { count: doneItems.length })}</SectionHeader>
            <Card className="relative mb-5 px-3 py-1 opacity-65">
              <AnimatePresence initial={false} mode="popLayout">
                {doneItems.map((item) => (
                  <TodoItemRow
                    key={item.id}
                    item={item}
                    member={getMember(item.assigned_to)}
                    members={members}
                    showPicker={assignPicker === item.id}
                    onToggle={toggleItem}
                    onDelete={deleteItem}
                    onTap={openItemDetail}
                    onPickerOpen={setAssignPicker}
                    onAssign={assignMember}
                  />
                ))}
              </AnimatePresence>
            </Card>
          </>
        )}
      </PageBody>

      {/* List edit modal */}
      <Modal open={!!listEdit} onClose={() => setListEdit(null)}>
        {listEdit && (
          <>
            <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {t('editList')}
            </h3>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {LIST_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setListEdit((d) => ({ ...d, emoji: e }))}
                  className={cx(
                    'cursor-pointer rounded-lg border p-1.75 text-2xl',
                    PRESS_SM,
                    listEdit.emoji === e
                      ? 'border-stone-900 bg-stone-100 dark:border-stone-100 dark:bg-stone-800'
                      : 'border-stone-200 bg-transparent dark:border-white/10',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
            <Label className="mb-1.5 text-xs">{t('listTitle')}</Label>
            <Input
              autoFocus
              value={listEdit.title}
              onChange={(e) => setListEdit((d) => ({ ...d, title: e.target.value }))}
              className="mb-3"
            />
            <Label className="mb-1.5 text-xs">{t('due')}</Label>
            <Input
              type="date"
              value={listEdit.due_date || ''}
              onChange={(e) => setListEdit((d) => ({ ...d, due_date: e.target.value }))}
              className="mb-5"
            />
            <ModalActions
              onSave={async () => {
                if (!listEdit.title.trim()) return;
                await onUpdateList(list.id, {
                  title: listEdit.title.trim(),
                  emoji: listEdit.emoji,
                  due_date: listEdit.due_date || null,
                });
                setListEdit(null);
              }}
              onCancel={() => setListEdit(null)}
            />
          </>
        )}
      </Modal>

      {/* Item detail modal */}
      <Modal open={!!itemDetail} onClose={() => setItemDetail(null)}>
        {itemDetail && (
          <>
            <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {t('editItem')}
            </h3>
            <Label className="mb-1.5 text-xs">{t('itemTitle')}</Label>
            <Input
              autoFocus
              value={itemDetail.title}
              onChange={(e) => setItemDetail((d) => ({ ...d, title: e.target.value }))}
              className="mb-3.5"
            />
            <div className="mb-3.5 flex items-end gap-3">
              <div className="flex-1">
                <Label className="mb-1.5 text-xs">{t('due')}</Label>
                <Input
                  type="date"
                  value={itemDetail.due_date || ''}
                  onChange={(e) => setItemDetail((d) => ({ ...d, due_date: e.target.value }))}
                />
              </div>
              <button
                onClick={() => setItemDetail((d) => ({ ...d, important: !d.important }))}
                aria-label={t('markImportant')}
                aria-pressed={!!itemDetail.important}
                className={cx(
                  'flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border',
                  PRESS_SM,
                  itemDetail.important
                    ? 'border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    : 'border-stone-300 bg-transparent text-stone-400 dark:border-stone-700 dark:text-stone-600',
                )}
              >
                <Star className={cx('size-5', itemDetail.important && 'fill-current')} />
              </button>
            </div>
            <Label className="mb-1.5 text-xs">{t('notes')}</Label>
            <textarea
              value={itemDetail.notes || ''}
              onChange={(e) => setItemDetail((d) => ({ ...d, notes: e.target.value }))}
              placeholder={t('notesPlaceholder')}
              rows={4}
              className="mb-5 box-border w-full resize-none rounded-xl border border-stone-300 bg-white px-3.5 py-3 text-base leading-normal font-medium text-stone-900 transition-colors outline-none focus:border-orange-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
            <ModalActions
              onSave={async () => {
                if (!itemDetail.title.trim()) return;
                await updateItem(itemDetail.id, {
                  title: itemDetail.title.trim(),
                  notes: itemDetail.notes || null,
                  due_date: itemDetail.due_date || null,
                  important: !!itemDetail.important,
                });
                setItemDetail(null);
              }}
              onCancel={() => setItemDetail(null)}
            />
          </>
        )}
      </Modal>
    </Screen>
  );
}

// ─── OPEN-ITEMS GROUP (drag-to-reorder) ───
// Wraps open items in a Reorder.Group — same shape as ShopGroup in
// ShoppingModule.js. Order lives in local state during the drag; sort_order
// is persisted once on drag end via onPersist. Done items don't get this —
// they're rendered as a plain list further down, no reordering needed.
function TodoItemGroup({ items, members, assignPicker, getMember, onPersist, onToggle, onDelete, onTap, onPickerOpen, onAssign }) {
  const [order, setOrder] = useState(items);
  const orderRef = useRef(items);
  const dragging = useRef(false);
  // True between "our drag ended" and "the persisted order came back via
  // realtime" — while set, stale props (pre-persist order, same id set) must
  // not snap the rows back.
  const pending = useRef(false);
  const adopt = (next) => {
    orderRef.current = next;
    setOrder(next);
  };
  useEffect(() => {
    if (dragging.current) return;
    const propSeq = items.map((i) => i.id).join(',');
    const localSeq = orderRef.current.map((i) => i.id).join(',');
    if (propSeq === localSeq) {
      pending.current = false;
      if (items.length === orderRef.current.length && items.every((it, i) => it === orderRef.current[i])) return;
    } else if (pending.current && propSeq.split(',').sort().join() === localSeq.split(',').sort().join()) return;
    adopt(items);
  }, [items]);
  const onRowDragStart = useCallback(() => (dragging.current = true), []);
  const onRowDragEnd = useCallback(() => {
    dragging.current = false;
    pending.current = true;
    onPersist(orderRef.current);
  }, [onPersist]);
  return (
    <Reorder.Group as="div" axis="y" values={order} onReorder={adopt} className="relative flex flex-col">
      <AnimatePresence initial={false} mode="popLayout">
        {order.map((item) => (
          <TodoItemRow
            key={item.id}
            item={item}
            reorderable
            member={getMember(item.assigned_to)}
            members={members}
            showPicker={assignPicker === item.id}
            onRowDragStart={onRowDragStart}
            onRowDragEnd={onRowDragEnd}
            onToggle={onToggle}
            onDelete={onDelete}
            onTap={onTap}
            onPickerOpen={onPickerOpen}
            onAssign={onAssign}
          />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}

// ─── ITEM ROW ───
// `ref` reaches the DOM node — required by AnimatePresence mode="popLayout".
// memo'd: parent passes stable handlers so untouched rows skip re-render on toggle.
// Reorderable open-item rows render as Reorder.Item (dragged by the ⠿ handle
// only, see ShopItemRow in ShoppingModule.js for the same pattern); done
// rows stay plain motion.div — finished items don't need manual ordering.
const TodoItemRow = memo(function TodoItemRow({
  item,
  member,
  members,
  showPicker,
  reorderable = false,
  onRowDragStart,
  onRowDragEnd,
  onToggle,
  onDelete,
  onTap,
  onPickerOpen,
  onAssign,
  ref,
}) {
  const t = useTranslations('Todo');
  const tc = useTranslations('Common');
  const ta = useTranslations('A11y');
  const format = useFormatter();
  const dragControls = useDragControls();

  const dueDate = item.due_date ? localDateFromStr(item.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const tone = dueTone(daysLeft);

  // Opaque bg matching the surrounding Card — Reorder.Item rows overlap
  // while dragging, so a transparent bg would show the row underneath.
  const rowClass = cx(
    'relative flex items-center gap-2.5 bg-white py-2.75 last:border-b-0 dark:bg-stone-900',
    'border-b border-dotted border-stone-300 dark:border-stone-700',
  );

  const inner = (
    <>
      {reorderable && (
        <span
          onPointerDown={(e) => {
            e.preventDefault();
            dragControls.start(e);
          }}
          className="-m-2 shrink-0 cursor-grab touch-none p-2 text-stone-400 select-none active:cursor-grabbing dark:text-stone-600"
        >
          <GripVertical className="size-4" />
        </span>
      )}
      <button
        onClick={() => onToggle(item.id)}
        className={cx(
          'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 text-sm text-white transition-colors duration-150',
          PRESS_SM,
          item.checked ? 'border-green-600 bg-green-600' : 'border-stone-300 bg-transparent dark:border-stone-700',
        )}
      >
        {item.checked && <motion.span {...POP}>✓</motion.span>}
      </button>

      <div onClick={() => onTap(item)} className="min-w-0 flex-1 cursor-pointer">
        <div
          className={cx(
            'flex items-center gap-1 text-base font-medium',
            item.checked ? 'text-stone-400 line-through dark:text-stone-500' : 'text-stone-900 dark:text-stone-100',
          )}
        >
          {item.important && (
            <Star
              aria-hidden="true"
              className="size-3 shrink-0 fill-current text-orange-600 dark:text-orange-400"
            />
          )}
          <span className="min-w-0 truncate">{item.title}</span>
        </div>
        {item.notes && (
          <div className="mt-0.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-stone-400 dark:text-stone-500">
            📝 {item.notes}
          </div>
        )}
      </div>

      {dueDate && !item.checked && (
        <span className={cx('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold', DUE_BADGE[tone])}>
          {isPast ? t('overdueBadge') : format.dateTime(dueDate, 'dayShort')}
        </span>
      )}

      {/* Assign picker */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPickerOpen(item.id);
          }}
          className={cx(
            'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none text-xs font-bold',
            PRESS_SM,
            member
              ? 'bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900'
              : 'bg-stone-200 text-stone-500 dark:bg-stone-800 dark:text-stone-400',
          )}
        >
          {member ? (member.display_name || '?')[0].toUpperCase() : '+'}
        </button>
        {showPicker && (
          <motion.div
            {...POPOVER_POP}
            onClick={(e) => e.stopPropagation()}
            className={cx(POPOVER, 'absolute top-8.5 right-0 z-20 min-w-37.5 origin-top-right p-1.5')}
          >
            <div
              onClick={() => onAssign(item.id, null)}
              className={cx('rounded-lg px-2.5 py-2 text-sm text-stone-400 dark:text-stone-500', ROW_PRESS)}
            >
              {t('nobody')}
            </div>
            {members.map((m) => (
              <div
                key={m.user_id || m.id}
                onClick={() => onAssign(item.id, m.user_id)}
                className={cx(
                  'rounded-lg px-2.5 py-2 text-sm font-medium text-stone-900 dark:text-stone-100',
                  ROW_PRESS,
                )}
              >
                {m.display_name || tc('user')}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <button
        aria-label={ta('delete')}
        onClick={() => onDelete(item.id)}
        className={cx(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-none bg-transparent text-stone-400 dark:text-stone-600',
          PRESS_SM,
        )}
      >
        <X className="size-4" />
      </button>
    </>
  );

  if (!reorderable)
    return (
      <motion.div ref={ref} {...LIST_ROW} className={rowClass}>
        {inner}
      </motion.div>
    );
  return (
    // No `layout` prop here — Reorder.Item is already a layout component
    // (same note as ShopItemRow).
    <Reorder.Item
      as="div"
      ref={ref}
      value={item}
      dragListener={false}
      dragControls={dragControls}
      whileDrag={{ scale: 1.01 }}
      onDragStart={onRowDragStart}
      onDragEnd={onRowDragEnd}
      initial={LIST_ROW.initial}
      animate={LIST_ROW.animate}
      exit={LIST_ROW.exit}
      transition={LIST_ROW.transition}
      className={rowClass}
    >
      {inner}
    </Reorder.Item>
  );
});
