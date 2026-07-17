'use client';
import { useState } from 'react';
import { useTranslations, useFormatter } from 'next-intl';
import { Settings } from 'lucide-react';
import { detectEventType, cx, PERSON } from '@/lib/utils';
import { eventTitle } from '@/lib/intl';
import { Screen, PageBody, Btn, Modal, Input, Label, IconButton, PRESS } from './ui';

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
  const t = useTranslations('Calendar');
  const tc = useTranslations('Common');
  const ta = useTranslations('A11y');
  const format = useFormatter();
  const fmtTime = (d) => format.dateTime(new Date(d), 'time');
  // Two-letter day-of-week strip labels (no CLDR equivalent — kept in messages)
  const dow = t.raw('dow');

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
    // Keep the raw (possibly empty) title — eventTitle() translates at render
    title: ev.summary || '',
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
          {detectEventType(ev.title)} {eventTitle(ev.title, t)}
        </div>
        {ev.label && <div className={cx('mt-px text-[10px] font-semibold', p.text)}>{ev.label}</div>}
        {!ev.is_all_day && ev.start_time && (
          <div className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">
            {fmtTime(ev.start_time)}
            {ev.end_time ? `–${fmtTime(ev.end_time)}` : ''}
          </div>
        )}
      </div>
    );
  };

  return (
    <Screen>
      <PageBody>
        {/* Header */}
        <div className="mb-4 flex items-center justify-between pt-3">
          <div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{t('title')}</h1>
            <div className="mt-0.5 text-xs text-stone-500 capitalize dark:text-stone-400">
              {format.dateTime(selDay, 'monthYear')}
            </div>
          </div>
          <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
            <Settings className="size-4.5" />
          </IconButton>
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
                  ? 'border-stone-900 bg-stone-900 dark:border-stone-100 dark:bg-stone-100'
                  : 'border-stone-200 bg-transparent dark:border-white/10',
              )}
            >
              <span
                className={cx(
                  'text-[9px] font-semibold',
                  isSel(d)
                    ? 'text-white/70 dark:text-stone-900/70'
                    : isToday(d)
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-stone-400 dark:text-stone-500',
                )}
              >
                {dow[d.getDay()]}
              </span>
              <span
                className={cx(
                  'text-base font-extrabold',
                  isSel(d)
                    ? 'text-white dark:text-stone-900'
                    : isToday(d)
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-stone-500 dark:text-stone-400',
                )}
              >
                {d.getDate()}
              </span>
              {isToday(d) && <span className="h-0.75 w-0.75 rounded-full bg-orange-500" />}
            </button>
          ))}
        </div>

        {/* Not connected CTA */}
        {!calConnected && (
          <div className="px-5 py-10 text-center">
            <div className="mb-3 text-5xl">📅</div>
            <div className="mb-1.5 text-base font-bold text-stone-900 dark:text-stone-100">{t('connectTitle')}</div>
            <div className="mb-5 text-sm text-stone-500 dark:text-stone-400">{t('connectHint')}</div>
            <button
              onClick={connectCalendar}
              className={cx(
                'cursor-pointer rounded-full border-none bg-stone-900 px-6 py-3.25 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900',
                PRESS,
              )}
            >
              {t('connectBtn')}
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
                <span className="overflow-hidden text-xs font-bold text-ellipsis whitespace-nowrap text-stone-500 dark:text-stone-400">
                  {calConnection?.google_email?.split('@')[0] || t('you')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 pl-2">
                <div className={cx('h-2 w-2 shrink-0 rounded-full', PERSON.partner.dot)} />
                <span className="overflow-hidden text-xs font-bold text-ellipsis whitespace-nowrap text-stone-500 dark:text-stone-400">
                  {partnerConn?.google_email?.split('@')[0] || t('partner')}
                </span>
              </div>
            </div>

            {/* Loading — only block on Google API fetch, not DB */}
            {calLoading && (
              <div className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">{tc('loading')}</div>
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
                        bothFree ? 'text-green-600 dark:text-green-400' : 'text-stone-400 dark:text-stone-500',
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
              <div className="mt-2 p-4 text-center text-xs text-stone-400 dark:text-stone-500">
                {t('partnerNotConnected')}
              </div>
            )}
          </div>
        )}
      </PageBody>

      {/* Event detail modal */}
      {calEventDetail && (
        <Modal onClose={() => setCalEventDetail(null)}>
          <div className="mb-1 text-xl">{detectEventType(calEventDetail.title)}</div>
          <h3 className="mb-1 font-serif text-xl font-semibold tracking-tight">
            {eventTitle(calEventDetail.title, t)}
          </h3>
          {!calEventDetail.is_all_day && calEventDetail.start_time && (
            <div className="mb-4 text-sm text-stone-500 dark:text-stone-400">
              {fmtTime(calEventDetail.start_time)}
              {calEventDetail.end_time ? ` – ${fmtTime(calEventDetail.end_time)}` : ''}
            </div>
          )}
          <button
            onClick={() => setCalEventDetail((d) => ({ ...d, is_important: !d.is_important }))}
            className={cx(
              'mb-3 w-full cursor-pointer rounded-full border p-3 text-sm font-bold',
              PRESS,
              calEventDetail.is_important
                ? 'border-amber-500/40 bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                : 'border-stone-300 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400',
            )}
          >
            {calEventDetail.is_important ? t('important') : t('markImportant')}
          </button>
          <Label>{t('labelField')}</Label>
          <Input
            value={calEventDetail.label || ''}
            onChange={(e) => setCalEventDetail((d) => ({ ...d, label: e.target.value }))}
            placeholder={t('labelPlaceholder')}
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
            {tc('save')}
          </Btn>
        </Modal>
      )}
    </Screen>
  );
}
