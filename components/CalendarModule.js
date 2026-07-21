'use client';
import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { useTranslations, useFormatter } from 'next-intl';
import { Filter, Settings, ChevronLeft, ChevronRight, Plus, Repeat } from 'lucide-react';
import { cx, localDateStr, memberColorClass } from '@/lib/utils';
import { EVENT_TYPES, EVENT_TYPE_KEYS, RECURRENCE_KEYS, expandEvents } from '@/lib/calendar';
import {
  Screen,
  PageBody,
  ScreenEnter,
  ModuleHeader,
  IconButton,
  Fab,
  Card,
  Modal,
  ConfirmModal,
  Input,
  Label,
  Btn,
  EmptyState,
  CHIP_ON,
  CHIP_OFF,
  PRESS_SM,
  SPRING_FAST,
} from './ui';

const NOTE_INPUT =
  'box-border min-h-16 w-full resize-none rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-medium text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-orange-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100';

// Monday of the week containing d (local midnight).
const startOfWeek = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const chipCx = (selected) =>
  cx('cursor-pointer rounded-full border px-3 py-1.5 text-sm font-semibold', PRESS_SM, selected ? CHIP_ON : CHIP_OFF);

// Add/edit form. Rendered only while the Modal is open, so it remounts per open
// with fresh state seeded from `event`. Editing writes the WHOLE series.
function EventForm({ event, members, user, onSave, onDelete, onSkip }) {
  const t = useTranslations('Calendar');
  const tc = useTranslations('Common');
  const isNew = !event.id;
  const [title, setTitle] = useState(event.title || '');
  const [type, setType] = useState(event.event_type || 'other');
  const [date, setDate] = useState(event.event_date || localDateStr());
  const [allDay, setAllDay] = useState(!!event.all_day);
  const [start, setStart] = useState((event.start_time || '').slice(0, 5));
  const [end, setEnd] = useState((event.end_time || '').slice(0, 5));
  const [person, setPerson] = useState(event.assigned_to ?? null);
  const [recurrence, setRecurrence] = useState(event.recurrence || 'once');
  const [intervalN, setIntervalN] = useState(event.recurrence_interval || 2);
  const [note, setNote] = useState(event.note || '');

  const save = () => {
    if (!title.trim()) return;
    onSave(
      {
        title: title.trim(),
        event_type: type,
        event_date: date,
        all_day: allDay,
        start_time: allDay ? null : start || null,
        end_time: allDay ? null : end || null,
        assigned_to: person,
        note: note.trim() || null,
        recurrence,
        recurrence_interval: recurrence === 'custom' ? Math.max(2, Number(intervalN) || 2) : 1,
      },
      isNew,
      event,
    );
  };

  return (
    <>
      <h3 className="mb-4 text-center font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
        {isNew ? t('newEvent') : t('editEvent')}
      </h3>

      <Label>{t('titleField')}</Label>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('titlePlaceholder')}
        className="mb-4"
        autoFocus={isNew}
      />

      <Label>{t('typeField')}</Label>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {EVENT_TYPE_KEYS.map((k) => (
          <button key={k} onClick={() => setType(k)} className={chipCx(type === k)}>
            {EVENT_TYPES[k].emoji} {t('types.' + k)}
          </button>
        ))}
      </div>

      <Label>{t('dateField')}</Label>
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mb-3" />

      <button
        onClick={() => setAllDay((a) => !a)}
        className={cx(
          'mb-3 flex w-full items-center justify-between rounded-xl border px-4 py-3',
          PRESS_SM,
          allDay ? CHIP_ON : CHIP_OFF,
        )}
      >
        <span className="text-sm font-semibold">{t('allDay')}</span>
        <span className="text-sm">{allDay ? '✓' : ''}</span>
      </button>

      {!allDay && (
        <div className="mb-4 flex gap-2">
          <div className="flex-1">
            <Label>{t('from')}</Label>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label>{t('to')}</Label>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
      )}

      <Label>{t('personField')}</Label>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <button onClick={() => setPerson(null)} className={chipCx(person == null)}>
          {t('everyone')}
        </button>
        {members.map((m) => (
          <button
            key={m.user_id}
            onClick={() => setPerson(m.user_id)}
            className={cx(chipCx(person === m.user_id), 'flex items-center gap-1.5')}
          >
            <span className={cx('h-2 w-2 rounded-full', memberColorClass(m.color) || 'bg-stone-400')} />
            {m.display_name || tc('user')}
          </button>
        ))}
      </div>

      <Label>{t('repeatField')}</Label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {RECURRENCE_KEYS.map((r) => (
          <button key={r} onClick={() => setRecurrence(r)} className={chipCx(recurrence === r)}>
            {t('recurrence.' + r)}
          </button>
        ))}
      </div>
      {recurrence === 'custom' && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-stone-500 dark:text-stone-400">{t('everyNWeeks')}</span>
          <Input
            type="number"
            min="2"
            value={intervalN}
            onChange={(e) => setIntervalN(e.target.value)}
            className="w-20"
          />
        </div>
      )}

      <Label>{t('noteField')}</Label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('notePlaceholder')}
        rows={2}
        className={cx(NOTE_INPUT, 'mb-4')}
      />

      <Btn onClick={save} disabled={!title.trim()}>
        {isNew ? t('addEvent') : tc('save')}
      </Btn>

      {!isNew && (
        <div className="mt-2 flex gap-2">
          {recurrence !== 'once' && event._date && (
            <Btn v="ghost" onClick={() => onSkip(event.id, event._date)}>
              {t('skipDay')}
            </Btn>
          )}
          <Btn v="danger" onClick={() => onDelete(event.id)}>
            {tc('delete')}
          </Btn>
        </div>
      )}
    </>
  );
}

export default function CalendarModule({
  user,
  members,
  events,
  loading,
  addEvent,
  updateEvent,
  deleteEvent,
  skipOccurrence,
  onGoHome,
  onOpenSettings,
}) {
  const t = useTranslations('Calendar');
  const ta = useTranslations('A11y');
  const tMod = useTranslations('Modules');
  const format = useFormatter();
  const dow = t.raw('dow'); // two-letter weekday labels, indexed by getDay()

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [activeTypes, setActiveTypes] = useState(() => new Set(EVENT_TYPE_KEYS));
  const [showFilter, setShowFilter] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const weekMon = startOfWeek(selectedDate);
  const weekMonStr = localDateStr(weekMon);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekMon, i));
  const selStr = localDateStr(selectedDate);
  const todayStr = localDateStr(today);

  const memberByUid = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);
  const colorFor = (uid) =>
    uid
      ? memberColorClass(memberByUid.get(uid)?.color) || 'bg-stone-400 dark:bg-stone-500'
      : 'bg-stone-400 dark:bg-stone-500';
  const nameFor = (uid) => (uid ? memberByUid.get(uid)?.display_name || '?' : t('everyone'));
  const fmtTime = (tm) => (tm ? format.dateTime(new Date('1970-01-01T' + tm), 'time') : '');

  const filterActive = activeTypes.size < EVENT_TYPE_KEYS.length;

  const weekEvents = useMemo(
    () => expandEvents(events, weekMon, addDays(weekMon, 6)).filter((e) => activeTypes.has(e.event_type)),
    // weekMonStr keeps the memo keyed on the week without a fresh Date identity each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, weekMonStr, activeTypes],
  );
  const dotsByDate = useMemo(() => {
    const map = {};
    for (const e of weekEvents) (map[e._date] ||= new Set()).add(e.assigned_to || 'all');
    return map;
  }, [weekEvents]);
  const dayEvents = weekEvents.filter((e) => e._date === selStr);

  const toggleType = (k) =>
    setActiveTypes((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const openAdd = () =>
    setEditing({
      event_date: selStr,
      all_day: false,
      event_type: 'other',
      recurrence: 'once',
      recurrence_interval: 2,
      assigned_to: null,
      title: '',
      start_time: '',
      end_time: '',
      note: '',
    });

  const handleSave = async (payload, isNew, ev) => {
    if (isNew) await addEvent({ ...payload, created_by: user.id });
    else await updateEvent(ev.id, payload);
    setEditing(null);
  };
  const handleDelete = (id) => {
    setEditing(null);
    setConfirmDel(id);
  };
  const handleSkip = async (id, dateStr) => {
    await skipOccurrence(id, dateStr);
    setEditing(null);
  };

  return (
    <Screen>
      <PageBody key="cal-week">
        <ModuleHeader title={tMod('calendar')} emoji="📅" onHome={onGoHome}>
          <IconButton
            onClick={() => setShowFilter((s) => !s)}
            aria-label={ta('filter')}
            className={filterActive ? 'text-orange-600 dark:text-orange-400' : undefined}
          >
            <Filter className="size-4.5" />
          </IconButton>
          <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
            <Settings className="size-4.5" />
          </IconButton>
        </ModuleHeader>

        {showFilter && (
          <Card className="mb-3 flex flex-wrap gap-1.5 p-3">
            {EVENT_TYPE_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => toggleType(k)}
                className={cx(
                  'cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold',
                  PRESS_SM,
                  activeTypes.has(k) ? CHIP_ON : CHIP_OFF,
                )}
              >
                {EVENT_TYPES[k].emoji} {t('types.' + k)}
              </button>
            ))}
          </Card>
        )}

        {/* Week nav */}
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-bold text-stone-500 capitalize dark:text-stone-400">
            {format.dateTime(weekMon, 'monthYear')}
          </div>
          <div className="flex gap-1">
            <button
              aria-label={ta('prevWeek')}
              onClick={() => setSelectedDate((d) => addDays(d, -7))}
              className={cx(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-stone-400 dark:text-stone-500',
                PRESS_SM,
              )}
            >
              <ChevronLeft className="size-4.5" />
            </button>
            <button
              aria-label={ta('nextWeek')}
              onClick={() => setSelectedDate((d) => addDays(d, 7))}
              className={cx(
                'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-stone-400 dark:text-stone-500',
                PRESS_SM,
              )}
            >
              <ChevronRight className="size-4.5" />
            </button>
          </div>
        </div>

        {/* Swipeable day strip */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) setSelectedDate((d) => addDays(d, 7));
            else if (info.offset.x > 50) setSelectedDate((d) => addDays(d, -7));
          }}
          className="mb-4 flex gap-1"
        >
          {days.map((d, i) => {
            const ds = localDateStr(d);
            const isSel = ds === selStr;
            const isToday = ds === todayStr;
            const dots = [...(dotsByDate[ds] || [])].slice(0, 3);
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(d)}
                className={cx(
                  'relative flex flex-1 cursor-pointer touch-pan-y flex-col items-center gap-0.75 rounded-xl border px-0.5 py-2',
                  PRESS_SM,
                  isSel ? 'border-transparent' : 'border-stone-200 bg-transparent dark:border-white/10',
                )}
              >
                {isSel && (
                  <motion.span
                    layoutId="cal-day"
                    transition={SPRING_FAST}
                    aria-hidden
                    className="absolute inset-0 rounded-xl border border-stone-900 bg-stone-900 dark:border-stone-100 dark:bg-stone-100"
                  />
                )}
                <span
                  className={cx(
                    'relative z-1 text-[9px] font-semibold',
                    isSel
                      ? 'text-white/70 dark:text-stone-900/70'
                      : isToday
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-stone-400 dark:text-stone-500',
                  )}
                >
                  {dow[d.getDay()]}
                </span>
                <span
                  className={cx(
                    'relative z-1 text-base font-extrabold',
                    isSel
                      ? 'text-white dark:text-stone-900'
                      : isToday
                        ? 'text-orange-600 dark:text-orange-400'
                        : 'text-stone-500 dark:text-stone-400',
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="relative z-1 flex h-1.5 items-center gap-0.5">
                  {dots.map((uid, j) => (
                    <span
                      key={j}
                      className={cx(
                        'h-1 w-1 rounded-full',
                        isSel ? 'bg-white/70 dark:bg-stone-900/70' : colorFor(uid === 'all' ? null : uid),
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Selected-day events */}
        <ScreenEnter key={selStr}>
          <div className="mb-2 text-sm font-bold text-stone-500 capitalize dark:text-stone-400">
            {format.dateTime(selectedDate, 'weekdayFull')}
          </div>
          {dayEvents.length === 0 ? (
            <EmptyState icon="📅">{loading ? '' : t('noEvents')}</EmptyState>
          ) : (
            <div className="flex flex-col gap-2">
              {dayEvents.map((ev) => (
                <Card
                  key={ev.id + ev._date}
                  onClick={() => setEditing({ ...ev })}
                  className="flex items-stretch gap-3 rounded-2xl px-3.5 py-3"
                >
                  <span className={cx('w-1 shrink-0 rounded-full', colorFor(ev.assigned_to))} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
                      <span className="text-sm">{EVENT_TYPES[ev.event_type]?.emoji || '📌'}</span>
                      <span className="shrink-0">
                        {ev.all_day
                          ? t('allDay')
                          : fmtTime(ev.start_time) + (ev.end_time ? '–' + fmtTime(ev.end_time) : '')}
                      </span>
                      <span className="truncate">· {nameFor(ev.assigned_to)}</span>
                      {ev.recurrence !== 'once' && (
                        <Repeat className="size-3 shrink-0 text-stone-400 dark:text-stone-500" />
                      )}
                    </div>
                    <div className="text-base font-semibold text-stone-900 dark:text-stone-100">{ev.title}</div>
                    {ev.note && (
                      <div className="mt-0.5 truncate text-xs text-stone-400 dark:text-stone-500">📝 {ev.note}</div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScreenEnter>
      </PageBody>

      <Fab onClick={openAdd} aria-label={ta('add')}>
        <Plus className="size-6" />
      </Fab>

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <EventForm
            event={editing}
            members={members}
            user={user}
            onSave={handleSave}
            onDelete={handleDelete}
            onSkip={handleSkip}
          />
        )}
      </Modal>

      <ConfirmModal
        action={
          confirmDel
            ? {
                message: t('deleteConfirm'),
                onConfirm: async () => {
                  await deleteEvent(confirmDel);
                },
              }
            : null
        }
        onClose={() => setConfirmDel(null)}
      />
    </Screen>
  );
}
