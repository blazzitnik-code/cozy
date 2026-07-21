'use client';
import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Settings, ChevronRight } from 'lucide-react';
import { getSt, cx, dueTone, DUE_BAR, DUE_BADGE, weatherInfo, relativeDay } from '@/lib/utils';
import { eventTitle } from '@/lib/intl';
import {
  Screen,
  PageBody,
  Card,
  SectionHeader,
  IconButton,
  TickNum,
  Wordmark,
  Modal,
  ModalActions,
  ROW_PRESS,
  PRESS,
  PRESS_SM,
} from './ui';
import HomeModule from './HomeModule';

// ─── WEATHER CARD (Open-Meteo) ───
function WeatherCard({ weather }) {
  const tw = useTranslations('Weather');
  if (!weather?.current) return null;
  const { emoji, key } = weatherInfo(weather.current.weather_code);
  const temp = Math.round(weather.current.temperature_2m);
  const max = Math.round(weather.daily?.temperature_2m_max?.[0]);
  const min = Math.round(weather.daily?.temperature_2m_min?.[0]);
  const precip = weather.daily?.precipitation_probability_max?.[0];
  return (
    <Card className="mb-2.5 flex items-center justify-between rounded-2xl px-3.5 py-3">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            {temp}°
          </span>
          <span className="text-sm font-semibold text-stone-500 capitalize dark:text-stone-400">{tw(key)}</span>
        </div>
        <div className="mt-0.5 text-xs font-semibold text-stone-400 dark:text-stone-500">
          {precip != null && (
            <span className="text-orange-600 dark:text-orange-400">{tw('precip', { p: precip })} · </span>
          )}
          H {max}° · L {min}°
        </div>
      </div>
      <span className="text-4xl">{emoji}</span>
    </Card>
  );
}

// ─── UP-NEXT (calendar) CARD ───
// Real next event today when the calendar is connected; otherwise a connect
// prompt. Structure is ready to swap in richer data once Koledarko grows.
function UpNextCard({ todayCalEvents, calConnected, navigate }) {
  const t = useTranslations('HomeScreen');
  const tCal = useTranslations('Calendar');
  const format = useFormatter();
  const fmt = (d) => format.dateTime(new Date(d), 'time');

  if (!calConnected) {
    return (
      <Card
        onClick={() => navigate('calendar')}
        className="mb-2.5 flex items-center gap-3 rounded-2xl border-orange-500/20 bg-orange-500/5 px-4 py-3.5"
      >
        <span className="text-2xl">📅</span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('connectCalendar')}</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">{t('connectCalendarHint')}</div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-orange-600 dark:text-orange-400" />
      </Card>
    );
  }

  const now = Date.now();
  const upcoming = [...todayCalEvents]
    .filter((ev) => ev.start_time && !ev.is_all_day && new Date(ev.start_time).getTime() > now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  if (upcoming.length === 0) return null;

  const next = upcoming[0];
  const after = upcoming[1];
  const msTo = new Date(next.start_time).getTime() - now;
  const h = Math.floor(msTo / 3600000);
  const m = Math.round((msTo % 3600000) / 60000);
  const badge = h > 0 ? t('inHours', { h, m }) : t('inMinutes', { m });

  return (
    <Card onClick={() => navigate('calendar')} className="mb-2.5 rounded-2xl border-orange-500/20 bg-orange-500/5 p-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[1px] text-orange-600 uppercase dark:text-orange-400">
          {t('upNext')}
        </span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
          {badge}
        </span>
      </div>
      <div className="text-base font-bold text-stone-900 dark:text-stone-100">{eventTitle(next.title, tCal)}</div>
      <div className="text-xs text-stone-500 dark:text-stone-400">
        {fmt(next.start_time)}
        {next.end_time ? ` – ${fmt(next.end_time)}` : ''}
      </div>
      {after && (
        <div className="mt-2 flex items-center justify-between border-t border-dotted border-stone-300 pt-2 dark:border-stone-700">
          <span className="min-w-0 truncate text-xs text-stone-500 dark:text-stone-400">
            {fmt(after.start_time)} · {eventTitle(after.title, tCal)}
          </span>
          <span className="shrink-0 pl-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
            {t('viewAll')}
          </span>
        </div>
      )}
    </Card>
  );
}

// ─── COMPACT MODULE CARD (freezer / shopping stat) ───
function ModuleStat({ icon, count, sub, subTone, onClick }) {
  return (
    <Card onClick={onClick} className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5">
      <span className="text-xl">{icon}</span>
      <div className="min-w-0">
        <TickNum value={count} className="text-lg font-bold text-stone-900 dark:text-stone-100" />
        <div className={cx('truncate text-[10px] font-semibold', subTone)}>{sub}</div>
      </div>
    </Card>
  );
}

// ─── TODO (LISTKO) PREVIEW CARD ───
function TodoListHomeCard({ list, items, onNavigate }) {
  const format = useFormatter();
  const done = items.filter((i) => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? new Date(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const tone = dueTone(daysLeft);
  return (
    <Card onClick={onNavigate} className="mb-2 flex items-center gap-2.5 rounded-xl px-3.5 py-3">
      <span className="shrink-0 text-xl">{list.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className={cx('text-sm font-bold text-stone-900 dark:text-stone-100', total > 0 && 'mb-1')}>
          {list.title}
        </div>
        {total > 0 && (
          <div className="h-0.75 rounded-xs bg-stone-200 dark:bg-stone-800">
            <div
              className={cx('h-full rounded-xs transition-[width] duration-300', DUE_BAR[tone])}
              style={{ width: pct + '%' }}
            />
          </div>
        )}
      </div>
      {total > 0 && (
        <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
          {done}/{total}
        </span>
      )}
      {dueDate && (
        <span className={cx('shrink-0 rounded-lg px-1.75 py-0.5 text-xs font-bold', DUE_BADGE[tone])}>
          {isPast ? '🔴' : format.dateTime(dueDate, 'dayShort')}
        </span>
      )}
    </Card>
  );
}

// ─── BOARD (DESKA) ───
const NOTE_INPUT =
  'box-border min-h-24 w-full resize-none rounded-xl border border-stone-300 bg-white px-4 py-3 text-base font-medium text-stone-900 outline-none transition-colors placeholder:text-stone-400 focus:border-orange-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100';

function NoteRow({ note, onClick, last }) {
  const tb = useTranslations('Board');
  const rel = relativeDay(note.created_at);
  const initial = (note.author_name || '?')[0].toUpperCase();
  return (
    <div
      onClick={onClick}
      className={cx('py-2.5', ROW_PRESS, !last && 'border-b border-dotted border-stone-300 dark:border-stone-700')}
    >
      <div className="text-sm text-stone-900 dark:text-stone-100">{note.text}</div>
      <div className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">
        {initial} · {tb(rel.key, rel.params)}
      </div>
    </div>
  );
}

function BoardSection({ notes, addNote, updateNote, markNoteDone, authorName, userId }) {
  const tb = useTranslations('Board');
  const tc = useTranslations('Common');
  const [showNew, setShowNew] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [activeNote, setActiveNote] = useState(null);
  const [draft, setDraft] = useState('');

  const openNote = (note) => {
    setActiveNote(note);
    setDraft(note.text);
  };

  return (
    <div className="mb-5">
      <div className="mb-2.5 flex items-center justify-between">
        <SectionHeader className="mb-0">{tb('title')}</SectionHeader>
        <button
          onClick={() => {
            setDraft('');
            setShowNew(true);
          }}
          className={cx(
            'cursor-pointer rounded-full border-none bg-stone-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-stone-100 dark:text-stone-900',
            PRESS_SM,
          )}
        >
          {tb('new')}
        </button>
      </div>

      <Card className="px-3.5 py-1">
        {notes.length === 0 ? (
          <div className="py-4 text-center text-xs text-stone-400 dark:text-stone-500">{tb('empty')}</div>
        ) : (
          notes
            .slice(0, 3)
            .map((note, i, arr) => (
              <NoteRow
                key={note.id}
                note={note}
                onClick={() => openNote(note)}
                last={i === arr.length - 1 && notes.length <= 3}
              />
            ))
        )}
        {notes.length > 3 && (
          <button
            onClick={() => setShowAll(true)}
            className={cx(
              'w-full cursor-pointer border-none bg-transparent py-2.5 text-right text-xs font-semibold text-orange-600 dark:text-orange-400',
              PRESS_SM,
            )}
          >
            {tb('more')}
          </button>
        )}
      </Card>

      {/* New note */}
      <Modal open={showNew} onClose={() => setShowNew(false)}>
        <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {tb('title')}
        </h3>
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={tb('placeholder')}
          className={cx(NOTE_INPUT, 'mb-4')}
        />
        <ModalActions
          disabled={!draft.trim()}
          onSave={() => {
            addNote(draft.trim(), userId, authorName);
            setShowNew(false);
          }}
          onCancel={() => setShowNew(false)}
        />
      </Modal>

      {/* View / edit note */}
      <Modal open={!!activeNote} onClose={() => setActiveNote(null)}>
        {activeNote && (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={tb('placeholder')}
              className={cx(NOTE_INPUT, 'mb-4')}
            />
            <ModalActions
              saveLabel={tc('save')}
              disabled={!draft.trim()}
              onSave={() => {
                if (draft.trim() !== activeNote.text) updateNote(activeNote.id, draft.trim());
                setActiveNote(null);
              }}
              onCancel={() => setActiveNote(null)}
              className="mb-2"
            />
            <button
              onClick={() => {
                markNoteDone(activeNote.id);
                setActiveNote(null);
              }}
              className={cx(
                'w-full cursor-pointer rounded-full border border-green-600/25 bg-green-600/10 p-3.5 text-base font-bold text-green-700 dark:text-green-400',
                PRESS,
              )}
            >
              ✓ {tb('markDone')}
            </button>
          </>
        )}
      </Modal>

      {/* All active notes */}
      <Modal open={showAll} onClose={() => setShowAll(false)}>
        <h3 className="mb-3 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          {tb('allNotes')}
        </h3>
        {notes.map((note, i, arr) => (
          <NoteRow
            key={note.id}
            note={note}
            last={i === arr.length - 1}
            onClick={() => {
              setShowAll(false);
              openNote(note);
            }}
          />
        ))}
      </Modal>
    </div>
  );
}

export default function HomeScreen({
  user,
  members,
  items,
  shopItems,
  todoLists,
  todoItemsByList,
  todayCalEvents,
  calConnected,
  homeSettings,
  homeSettingsLoading,
  saveHomeSettings,
  boardNotes,
  addNote,
  updateNote,
  markNoteDone,
  weather,
  navigate,
  onOpenSettings,
}) {
  const t = useTranslations('HomeScreen');
  const ta = useTranslations('A11y');
  const format = useFormatter();
  const expiredC = items.filter((i) => getSt(i) === 'expired').length;
  const warningC = items.filter((i) => getSt(i) === 'warning').length;
  const toBuyC = shopItems.filter((i) => !i.checked).length;
  const today = format.dateTime(new Date(), 'weekdayFull');
  const me = members.find((m) => m.user_id === user.id);
  const authorName = me?.display_name || user.user_metadata?.full_name?.split(' ')[0] || '?';

  return (
    <Screen>
      <PageBody>
        {/* Header */}
        <div className="mb-3.5 flex items-start justify-between pt-3">
          <div>
            <Wordmark className="text-4xl text-orange-600 dark:text-orange-400" />
            <div className="mt-0.5 text-xs text-stone-500 capitalize dark:text-stone-400">{today}</div>
          </div>
          <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
            <Settings className="size-4.5" />
          </IconButton>
        </div>

        {/* Weather */}
        <WeatherCard weather={weather} />

        {/* Up next (calendar) */}
        <UpNextCard todayCalEvents={todayCalEvents} calConnected={calConnected} navigate={navigate} />

        {/* Home module: consolidated "Domov" ETA card */}
        <HomeModule settings={homeSettings} loading={homeSettingsLoading} saveSettings={saveHomeSettings} />

        {/* Compact module stats */}
        <div className="mb-2 grid grid-cols-2 gap-2">
          <ModuleStat
            icon="❄️"
            count={items.length}
            onClick={() => navigate('freezer')}
            sub={
              expiredC > 0
                ? t('expired', { count: expiredC })
                : warningC > 0
                  ? t('expiringSoon', { count: warningC })
                  : t('inFreezer')
            }
            subTone={
              expiredC > 0
                ? 'text-red-600 dark:text-red-400'
                : warningC > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-stone-500 dark:text-stone-400'
            }
          />
          <ModuleStat
            icon="🛒"
            count={toBuyC}
            onClick={() => navigate('shopping')}
            sub={toBuyC === 0 ? t('allBought') : t('toBuy')}
            subTone={toBuyC === 0 ? 'text-green-600 dark:text-green-400' : 'text-stone-500 dark:text-stone-400'}
          />
        </div>

        {/* Listko preview */}
        {todoLists.length > 0 && (
          <div className="mb-5">
            <SectionHeader>{t('todos')}</SectionHeader>
            {todoLists.slice(0, 3).map((list) => (
              <TodoListHomeCard
                key={list.id}
                list={list}
                items={todoItemsByList[list.id] || []}
                onNavigate={() => navigate('todo')}
              />
            ))}
          </div>
        )}

        {/* Deska */}
        <BoardSection
          notes={boardNotes}
          addNote={addNote}
          updateNote={updateNote}
          markNoteDone={markNoteDone}
          authorName={authorName}
          userId={user.id}
        />

        {/* Coming soon modules */}
        <SectionHeader>{t('comingSoon')}</SectionHeader>
        <Card className="mb-2 flex items-center gap-3.5 px-4 py-3.5 opacity-65">
          <span className="text-3xl">🍽️</span>
          <div className="flex-1">
            <div className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('mealPlan')}</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">{t('mealPlanDesc')}</div>
          </div>
          <div className="rounded-full border border-stone-300 bg-stone-200/60 px-2.5 py-1 text-xs font-bold whitespace-nowrap text-stone-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
            {t('soon')}
          </div>
        </Card>
      </PageBody>
    </Screen>
  );
}
