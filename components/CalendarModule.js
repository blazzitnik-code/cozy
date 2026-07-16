'use client';
import { useState } from 'react';
import { detectEventType, fmtTime, cx } from '@/lib/utils';
import { Screen, Btn, Modal, Input, Label, IconButton } from './ui';

const SL_DAYS = ['Ne', 'Po', 'To', 'Sr', 'Če', 'Pe', 'So'];
const SL_MONTHS = [
  'januar',
  'februar',
  'marec',
  'april',
  'maj',
  'junij',
  'julij',
  'avgust',
  'september',
  'oktober',
  'november',
  'december',
];

// Person lane tones — current user = indigo, partner = pink.
// Full literal class strings for the Tailwind scanner.
const PERSON = {
  me: {
    dot: 'bg-indigo-500',
    lane: 'border-indigo-500/15',
    block: 'bg-indigo-500/9',
    border: 'border-indigo-500/25',
    borderHi: 'border-indigo-500/50',
    text: 'text-indigo-500',
  },
  partner: {
    dot: 'bg-pink-500',
    lane: 'border-pink-500/15',
    block: 'bg-pink-500/9',
    border: 'border-pink-500/25',
    borderHi: 'border-pink-500/50',
    text: 'text-pink-500',
  },
};

export default function CalendarModule({
  user,
  calDate,
  setCalDate,
  calConnections,
  calConnection,
  calConnected,
  connectCalendar,
  calLoading,
  myFetchedEvents,
  allCalEvents,
  updateCalEvent,
  onOpenSettings,
}) {
  const [calEventDetail, setCalEventDetail] = useState(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });
  const selDay = new Date(calDate);
  selDay.setHours(0, 0, 0, 0);
  const isToday = (d) => d.toDateString() === today.toDateString();
  const isSel = (d) => d.toDateString() === selDay.toDateString();

  // Own events: directly from API (instant); partner events: from shared DB
  const myEvents = myFetchedEvents.map((ev) => ({
    id: ev.id,
    title: ev.summary || 'Brez naslova',
    start_time: ev.start?.dateTime || ev.start?.date || null,
    end_time: ev.end?.dateTime || ev.end?.date || null,
    is_all_day: !!ev.start?.date,
    location: ev.location,
  }));
  const partnerConn = calConnections.find((c) => c.user_id !== user.id);
  const partnerEvents = allCalEvents.filter((e) => e.user_id !== user.id);

  // Hours 7–22
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
  const eventsAtHour = (list, hour) => list.filter((e) => e.start_time && new Date(e.start_time).getHours() === hour);

  const EventBlock = ({ ev, person }) => {
    const p = PERSON[person];
    return (
      <div
        onClick={() => setCalEventDetail({ ...ev })}
        className={cx(
          'mb-1 cursor-pointer rounded-lg border px-2 py-1.5',
          p.block,
          ev.is_important ? p.borderHi : p.border,
        )}
      >
        <div className={cx('text-xs leading-snug font-bold', p.text)}>
          {ev.is_important ? '⭐ ' : ''}
          {detectEventType(ev.title)} {ev.title}
        </div>
        {ev.label && <div className={cx('mt-px text-[10px] font-semibold', p.text)}>{ev.label}</div>}
        {!ev.is_all_day && ev.start_time && (
          <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
            {fmtTime(ev.start_time)}
            {ev.end_time ? `–${fmtTime(ev.end_time)}` : ''}
          </div>
        )}
      </div>
    );
  };

  return (
    <Screen>
      <div className="relative z-1 px-4 pt-4 pb-[calc(100px+env(safe-area-inset-bottom))]">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between pt-3">
          <div>
            <h1 className="text-2xl font-extrabold">📅 Koledar</h1>
            <div className="mt-0.5 text-xs text-slate-500 capitalize dark:text-slate-400">
              {SL_MONTHS[selDay.getMonth()]} {selDay.getFullYear()}
            </div>
          </div>
          <IconButton onClick={onOpenSettings}>⚙️</IconButton>
        </div>

        {/* Week strip */}
        <div className="mb-4 flex gap-1">
          {days.map((d, i) => (
            <button
              key={i}
              onClick={() => setCalDate(new Date(d))}
              className={cx(
                'flex flex-1 cursor-pointer flex-col items-center gap-0.75 rounded-xl border px-0.5 py-2',
                isSel(d)
                  ? 'border-indigo-500/50 bg-indigo-500/15'
                  : 'border-indigo-500/15 bg-transparent dark:border-slate-600/20',
              )}
            >
              <span
                className={cx(
                  'text-[9px] font-semibold',
                  isToday(d) ? 'text-indigo-400' : 'text-slate-400 dark:text-slate-500',
                )}
              >
                {SL_DAYS[d.getDay()]}
              </span>
              <span
                className={cx(
                  'text-base font-extrabold',
                  isSel(d)
                    ? 'text-indigo-400'
                    : isToday(d)
                      ? 'text-slate-800 dark:text-slate-200'
                      : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {d.getDate()}
              </span>
              {isToday(d) && <span className="h-0.75 w-0.75 rounded-full bg-indigo-400" />}
            </button>
          ))}
        </div>

        {/* Not connected CTA */}
        {!calConnected && (
          <div className="px-5 py-10 text-center">
            <div className="mb-3 text-5xl">📅</div>
            <div className="mb-1.5 text-base font-bold text-slate-800 dark:text-slate-200">Poveži Google Koledar</div>
            <div className="mb-5 text-sm text-slate-500 dark:text-slate-400">Poveži v nastavitvah</div>
            <button
              onClick={connectCalendar}
              className="cursor-pointer rounded-xl border-none bg-linear-135 from-indigo-500 to-indigo-400 px-6 py-3.25 text-sm font-bold text-white"
            >
              Poveži Google Koledar
            </button>
          </div>
        )}

        {/* Two-lane view */}
        {calConnected && (
          <div>
            {/* Lane headers */}
            <div className="mb-2 grid grid-cols-[40px_1fr_1fr] gap-x-1.5">
              <div />
              <div className="flex items-center gap-1.5 pl-2">
                <div className={cx('h-2 w-2 shrink-0 rounded-full', PERSON.me.dot)} />
                <span className="overflow-hidden text-xs font-bold text-ellipsis whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {calConnection?.google_email?.split('@')[0] || 'Ti'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 pl-2">
                <div className={cx('h-2 w-2 shrink-0 rounded-full', PERSON.partner.dot)} />
                <span className="overflow-hidden text-xs font-bold text-ellipsis whitespace-nowrap text-slate-500 dark:text-slate-400">
                  {partnerConn?.google_email?.split('@')[0] || 'Partner'}
                </span>
              </div>
            </div>

            {/* Loading — only block on Google API fetch, not DB */}
            {calLoading && (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Nalagam...</div>
            )}

            {/* Hour grid */}
            {!calLoading &&
              HOURS.map((hour) => {
                const mine = eventsAtHour(myEvents, hour);
                const theirs = eventsAtHour(partnerEvents, hour);
                const bothFree = mine.length === 0 && theirs.length === 0;
                return (
                  <div
                    key={hour}
                    className={cx(
                      'mb-0.5 grid min-h-9 grid-cols-[40px_1fr_1fr] gap-x-1.5 rounded-lg',
                      bothFree ? 'bg-green-500/4' : 'bg-transparent',
                    )}
                  >
                    <div
                      className={cx(
                        'pt-2.5 pr-1 text-right text-[10px] font-medium',
                        bothFree ? 'text-green-500' : 'text-slate-400 dark:text-slate-500',
                      )}
                    >
                      {hour}:00
                    </div>
                    <div className={cx('border-l-2 py-1 pl-1.5', PERSON.me.lane)}>
                      {mine.map((ev, i) => (
                        <EventBlock key={ev.id || i} ev={ev} person="me" />
                      ))}
                    </div>
                    <div className={cx('border-l-2 py-1 pl-1.5', PERSON.partner.lane)}>
                      {theirs.map((ev, i) => (
                        <EventBlock key={ev.id || i} ev={ev} person="partner" />
                      ))}
                    </div>
                  </div>
                );
              })}

            {/* Partner not connected note */}
            {calConnections.length > 1 && !partnerConn && (
              <div className="mt-2 p-4 text-center text-xs text-slate-400 dark:text-slate-500">
                Partner še ni povezal svojega koledarja
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event detail modal */}
      {calEventDetail && (
        <Modal onClose={() => setCalEventDetail(null)}>
          <div className="mb-1 text-xl">{detectEventType(calEventDetail.title)}</div>
          <h3 className="mb-1 text-lg font-extrabold">{calEventDetail.title}</h3>
          {!calEventDetail.is_all_day && calEventDetail.start_time && (
            <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">
              {fmtTime(calEventDetail.start_time)}
              {calEventDetail.end_time ? ` – ${fmtTime(calEventDetail.end_time)}` : ''}
            </div>
          )}
          <button
            onClick={() => setCalEventDetail((d) => ({ ...d, is_important: !d.is_important }))}
            className={cx(
              'mb-3 w-full cursor-pointer rounded-xl border p-3 text-sm font-bold',
              calEventDetail.is_important
                ? 'border-amber-500/40 bg-amber-500/12 text-amber-500'
                : 'border-indigo-500/20 bg-white/70 text-slate-400 dark:border-slate-600/30 dark:bg-slate-800/50 dark:text-slate-500',
            )}
          >
            {calEventDetail.is_important ? '⭐ Pomemben' : '☆ Označi kot pomemben'}
          </button>
          <Label>Oznaka</Label>
          <Input
            value={calEventDetail.label || ''}
            onChange={(e) => setCalEventDetail((d) => ({ ...d, label: e.target.value }))}
            placeholder="Dodaj oznako..."
            className="mb-4"
          />
          <Btn
            onClick={async () => {
              await updateCalEvent(calEventDetail.id, {
                label: calEventDetail.label || null,
                is_important: calEventDetail.is_important || false,
              });
              setCalEventDetail(null);
            }}
          >
            Shrani
          </Btn>
        </Modal>
      )}
    </Screen>
  );
}
