'use client';
import { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations, useFormatter } from 'next-intl';
import { Archive, Pencil, Plus, X } from 'lucide-react';
import { useTodoLists, useTodoArchivedLists, useTodoItems } from '@/lib/hooks';
import { cx, dueTone, DUE_TEXT, DUE_BAR, DUE_BADGE } from '@/lib/utils';
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
  IconButton,
  EmptyState,
  POPOVER,
  POPOVER_POP,
  POP,
  LIST_ROW,
} from './ui';

const LIST_EMOJIS = ['📋', '🏖️', '🏠', '🛒', '🎉', '🪴', '🛠️', '✈️', '📚', '🥗', '🌾', '🎸', '🐶', '🌱', '💼'];

// ─── MAIN TODO APP ───
export default function TodoApp({ user, householdId, members }) {
  const t = useTranslations('Todo');
  const ta = useTranslations('A11y');
  const format = useFormatter();
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
  };

  // ─── ARCHIVED LIST VIEW (read-only) ───
  if (screen === 'archivedList' && activeArchivedList)
    return (
      <TodoListScreen
        list={activeArchivedList}
        householdId={householdId}
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
        householdId={householdId}
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
        <PageBody>
          <div className="mb-6 flex items-center gap-2.5">
            <BackBtn onClick={() => setScreen('home')} />
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {t('archiveTitle')}
            </h2>
          </div>
          {archivedLists.length === 0 ? (
            <EmptyState icon="😭">{t('noArchived')}</EmptyState>
          ) : (
            archivedLists.map((list) => (
              <Card
                key={list.id}
                onClick={() => {
                  setActiveArchivedList(list);
                  setScreen('archivedList');
                }}
                className="mb-2 cursor-pointer px-4 py-3.5"
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
                    className="h-9 flex-1 cursor-pointer rounded-full border-none bg-stone-900 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900"
                  >
                    {t('restore')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteList(list.id);
                    }}
                    className="h-9 flex-1 cursor-pointer rounded-full border border-red-500/25 bg-red-500/10 text-sm font-bold text-red-600 dark:text-red-400"
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
      <PageBody>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <IconButton onClick={() => setScreen('archive')} aria-label={ta('archive')}>
            <Archive className="size-4.5" />
          </IconButton>
        </div>

        {lists.length === 0 ? (
          <EmptyState icon="📋">
            <p className="mb-2 text-base font-semibold text-stone-900 dark:text-stone-100">{t('noLists')}</p>
            <p>{t('createFirst')}</p>
          </EmptyState>
        ) : (
          <div className="relative flex flex-col gap-2.5">
            <AnimatePresence initial={false} mode="popLayout">
              {lists.map((list) => (
                <motion.div {...LIST_ROW} key={list.id}>
                  <TodoListCard
                    list={list}
                    householdId={householdId}
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

      {/* FAB (shared primitive, repositioned via twMerge overrides) */}
      <Fab
        onClick={() => setShowNewList(true)}
        className="right-5 bottom-[calc(88px+env(safe-area-inset-bottom))] left-auto h-14 w-14 translate-x-0"
      />

      {/* New list modal */}
      {showNewList && (
        <Modal onClose={() => setShowNewList(false)}>
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
            size="sm"
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
          <Input
            size="sm"
            type="date"
            value={newListDue}
            onChange={(e) => setNewListDue(e.target.value)}
            className="mb-5"
          />
          <ModalActions
            saveLabel={t('createList')}
            disabled={!newListTitle.trim()}
            onSave={handleAddList}
            onCancel={() => setShowNewList(false)}
          />
        </Modal>
      )}
    </Screen>
  );
}

// ─── LIST CARD (home screen) ───
function TodoListCard({ list, householdId, onClick }) {
  const t = useTranslations('Todo');
  const format = useFormatter();
  const { items } = useTodoItems(householdId, list.id);
  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? new Date(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const tone = dueTone(daysLeft);

  return (
    <Card onClick={onClick} className="cursor-pointer px-4 py-3.5">
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
function TodoListScreen({ list, householdId, members, user, onBack, onArchive, onUpdateList, onUnarchive, readOnly }) {
  const t = useTranslations('Todo');
  const ta = useTranslations('A11y');
  const format = useFormatter();
  const { items, addItem, toggleItem, deleteItem, updateItem } = useTodoItems(householdId, list.id);
  const [newItem, setNewItem] = useState('');
  const [assignPicker, setAssignPicker] = useState(null); // item id
  const [itemDetail, setItemDetail] = useState(null); // item being edited
  const [listEdit, setListEdit] = useState(null); // { title, emoji, due_date }
  const inputRef = useRef(null);

  const done = items.filter((i) => i.checked).length;
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

  const openItems = items.filter((i) => !i.checked).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const doneItems = items.filter((i) => i.checked).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const getMember = (userId) => members.find((m) => m.user_id === userId);

  return (
    <Screen onClick={() => assignPicker && setAssignPicker(null)}>
      <PageBody>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <BackBtn onClick={onBack} />
          {!readOnly && (
            <BackBtn onClick={onArchive} className="px-3.5">
              {t('finish')}
            </BackBtn>
          )}
          {readOnly && (
            <button
              onClick={onUnarchive}
              className="cursor-pointer rounded-full border-none bg-stone-900 px-3.5 py-2.5 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900"
            >
              {t('restoreList')}
            </button>
          )}
        </div>

        {/* List info */}
        <div className="mb-5 text-center">
          <div
            onClick={() => setListEdit({ title: list.title, emoji: list.emoji, due_date: list.due_date || '' })}
            className="mb-1.5 cursor-pointer text-5xl"
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
                className="cursor-pointer border-none bg-transparent p-1 text-stone-400 dark:text-stone-500"
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
              size="sm"
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
                newItem.trim()
                  ? 'cursor-pointer bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                  : 'cursor-default bg-stone-200 text-stone-400 dark:bg-stone-800 dark:text-stone-600',
              )}
            >
              <Plus className="size-5.5" />
            </button>
          </div>
        )}

        {/* Open items */}
        {openItems.length > 0 && (
          <>
            <SectionHeader>{t('open', { count: openItems.length })}</SectionHeader>
            <Card className="relative mb-4 px-3 py-1">
              <AnimatePresence initial={false} mode="popLayout">
                {openItems.map((item, idx) => (
                  <TodoItemRow
                    key={item.id}
                    item={item}
                    isLast={idx === openItems.length - 1}
                    member={getMember(item.assigned_to)}
                    members={members}
                    showPicker={assignPicker === item.id}
                    onToggle={() => toggleItem(item.id)}
                    onDelete={() => deleteItem(item.id)}
                    onTap={() => setItemDetail({ ...item })}
                    onPickerOpen={(e) => {
                      e.stopPropagation();
                      setAssignPicker(item.id);
                    }}
                    onAssign={(userId) => {
                      updateItem(item.id, { assigned_to: userId });
                      setAssignPicker(null);
                    }}
                  />
                ))}
              </AnimatePresence>
            </Card>
          </>
        )}

        {/* Done items */}
        {doneItems.length > 0 && (
          <>
            <SectionHeader>{t('doneSection', { count: doneItems.length })}</SectionHeader>
            <Card className="relative mb-5 px-3 py-1 opacity-65">
              <AnimatePresence initial={false} mode="popLayout">
                {doneItems.map((item, idx) => (
                  <TodoItemRow
                    key={item.id}
                    item={item}
                    isLast={idx === doneItems.length - 1}
                    member={getMember(item.assigned_to)}
                    members={members}
                    showPicker={assignPicker === item.id}
                    onToggle={() => toggleItem(item.id)}
                    onDelete={() => deleteItem(item.id)}
                    onTap={() => setItemDetail({ ...item })}
                    onPickerOpen={(e) => {
                      e.stopPropagation();
                      setAssignPicker(item.id);
                    }}
                    onAssign={(userId) => {
                      updateItem(item.id, { assigned_to: userId });
                      setAssignPicker(null);
                    }}
                  />
                ))}
              </AnimatePresence>
            </Card>
          </>
        )}
      </PageBody>

      {/* List edit modal */}
      {listEdit && (
        <Modal onClose={() => setListEdit(null)}>
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
            size="sm"
            autoFocus
            value={listEdit.title}
            onChange={(e) => setListEdit((d) => ({ ...d, title: e.target.value }))}
            className="mb-3"
          />
          <Label className="mb-1.5 text-xs">{t('due')}</Label>
          <Input
            size="sm"
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
        </Modal>
      )}

      {/* Item detail modal */}
      {itemDetail && (
        <Modal onClose={() => setItemDetail(null)}>
          <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            {t('editItem')}
          </h3>
          <Label className="mb-1.5 text-xs">{t('itemTitle')}</Label>
          <Input
            size="sm"
            autoFocus
            value={itemDetail.title}
            onChange={(e) => setItemDetail((d) => ({ ...d, title: e.target.value }))}
            className="mb-3.5"
          />
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
              await updateItem(itemDetail.id, { title: itemDetail.title.trim(), notes: itemDetail.notes || null });
              setItemDetail(null);
            }}
            onCancel={() => setItemDetail(null)}
          />
        </Modal>
      )}
    </Screen>
  );
}

// ─── ITEM ROW ───
// `ref` reaches the DOM node — required by AnimatePresence mode="popLayout".
function TodoItemRow({
  item,
  isLast,
  member,
  members,
  showPicker,
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
  return (
    <motion.div
      ref={ref}
      {...LIST_ROW}
      className={cx(
        'flex items-center gap-2.5 py-2.75',
        !isLast && 'border-b border-dotted border-stone-300 dark:border-stone-700',
      )}
    >
      <button
        onClick={onToggle}
        className={cx(
          'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 text-sm text-white transition-colors duration-150',
          item.checked ? 'border-green-600 bg-green-600' : 'border-stone-300 bg-transparent dark:border-stone-700',
        )}
      >
        {item.checked && <motion.span {...POP}>✓</motion.span>}
      </button>

      <div onClick={onTap} className="min-w-0 flex-1 cursor-pointer">
        <div
          className={cx(
            'text-base font-medium',
            item.checked ? 'text-stone-400 line-through dark:text-stone-500' : 'text-stone-900 dark:text-stone-100',
          )}
        >
          {item.title}
        </div>
        {item.notes && (
          <div className="mt-0.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-stone-400 dark:text-stone-500">
            📝 {item.notes}
          </div>
        )}
      </div>

      {/* Assign picker */}
      <div className="relative shrink-0">
        <button
          onClick={onPickerOpen}
          className={cx(
            'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none text-xs font-bold',
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
              onClick={() => onAssign(null)}
              className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-stone-400 dark:text-stone-500"
            >
              {t('nobody')}
            </div>
            {members.map((m) => (
              <div
                key={m.user_id || m.id}
                onClick={() => onAssign(m.user_id)}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-sm font-medium text-stone-900 dark:text-stone-100"
              >
                {m.display_name || tc('user')}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <button
        aria-label={ta('delete')}
        onClick={onDelete}
        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-stone-400 dark:text-stone-600"
      >
        <X className="size-4" />
      </button>
    </motion.div>
  );
}
