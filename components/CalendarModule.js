'use client';
import { useState } from 'react';
import { detectEventType, fmtTime, cx } from '@/lib/utils';
import { Screen, Btn, Modal, Input, Label, IconButton } from './ui';

const SL_DAYS = ['Ne', 'Po', 'To', 'Sr', 'Če', 'Pe', 'So'];
const SL_MONTHS = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];

// Person lane tones — current user = indigo, partner = pink.
// Full literal class strings for the Tailwind scanner.
const PERSON = {
  me:      { dot: "bg-indigo-500",      lane: "border-indigo-500/15",      block: "bg-indigo-500/9",      border: "border-indigo-500/25",      borderHi: "border-indigo-500/50",      text: "text-indigo-500" },
  partner: { dot: "bg-pink-500", lane: "border-pink-500/15", block: "bg-pink-500/9", border: "border-pink-500/25", borderHi: "border-pink-500/50", text: "text-pink-500" },
};

export default function CalendarModule({
  user,
  calDate, setCalDate,
  calConnections, calConnection, calConnected, connectCalendar,
  calLoading, myFetchedEvents, allCalEvents, updateCalEvent,
  onOpenSettings,
}) {
  const [calEventDetail, setCalEventDetail] = useState(null);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() - 3 + i); return d;
  });
  const selDay = new Date(calDate); selDay.setHours(0, 0, 0, 0);
  const isToday = (d) => d.toDateString() === today.toDateString();
  const isSel = (d) => d.toDateString() === selDay.toDateString();

  // Own events: directly from API (instant); partner events: from shared DB
  const myEvents = myFetchedEvents.map(ev => ({
    id: ev.id, title: ev.summary || 'Brez naslova',
    start_time: ev.start?.dateTime || ev.start?.date || null,
    end_time: ev.end?.dateTime || ev.end?.date || null,
    is_all_day: !!ev.start?.date, location: ev.location,
  }));
  const partnerConn = calConnections.find(c => c.user_id !== user.id);
  const partnerEvents = allCalEvents.filter(e => e.user_id !== user.id);

  // Hours 7–22
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 7);
  const eventsAtHour = (list, hour) =>
    list.filter(e => e.start_time && new Date(e.start_time).getHours() === hour);

  const EventBlock = ({ ev, person }) => {
    const p = PERSON[person];
    return (
      <div onClick={() => setCalEventDetail({ ...ev })} className={cx("border rounded-lg py-1.5 px-2 mb-1 cursor-pointer", p.block, ev.is_important ? p.borderHi : p.border)}>
        <div className={cx("text-xs font-bold leading-snug", p.text)}>{ev.is_important ? '⭐ ' : ''}{detectEventType(ev.title)} {ev.title}</div>
        {ev.label && <div className={cx("text-[10px] font-semibold mt-px", p.text)}>{ev.label}</div>}
        {!ev.is_all_day && ev.start_time && (
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{fmtTime(ev.start_time)}{ev.end_time ? `–${fmtTime(ev.end_time)}` : ''}</div>
        )}
      </div>
    );
  };

  return (
    <Screen>
      <div className="relative z-1 pt-4 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">

        {/* Header */}
        <div className="flex justify-between items-center pt-3 mb-4">
          <div>
            <h1 className="text-2xl font-extrabold">📅 Koledar</h1>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">{SL_MONTHS[selDay.getMonth()]} {selDay.getFullYear()}</div>
          </div>
          <IconButton onClick={onOpenSettings}>⚙️</IconButton>
        </div>

        {/* Week strip */}
        <div className="flex gap-1 mb-4">
          {days.map((d, i) => (
            <button key={i} onClick={() => setCalDate(new Date(d))} className={cx(
              "flex-1 flex flex-col items-center gap-0.75 py-2 px-0.5 rounded-xl border cursor-pointer",
              isSel(d) ? "border-indigo-500/50 bg-indigo-500/15" : "border-indigo-500/15 dark:border-slate-600/20 bg-transparent"
            )}>
              <span className={cx("text-[9px] font-semibold", isToday(d) ? "text-indigo-400" : "text-slate-400 dark:text-slate-500")}>{SL_DAYS[d.getDay()]}</span>
              <span className={cx("text-base font-extrabold", isSel(d) ? "text-indigo-400" : isToday(d) ? "text-slate-800 dark:text-slate-200" : "text-slate-500 dark:text-slate-400")}>{d.getDate()}</span>
              {isToday(d) && <span className="w-0.75 h-0.75 rounded-full bg-indigo-400" />}
            </button>
          ))}
        </div>

        {/* Not connected CTA */}
        {!calConnected && (
          <div className="text-center py-10 px-5">
            <div className="text-5xl mb-3">📅</div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1.5">Poveži Google Koledar</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-5">Poveži v nastavitvah</div>
            <button onClick={connectCalendar} className="py-3.25 px-6 rounded-xl border-none bg-linear-135 from-indigo-500 to-indigo-400 text-white text-sm font-bold cursor-pointer">Poveži Google Koledar</button>
          </div>
        )}

        {/* Two-lane view */}
        {calConnected && (
          <div>
            {/* Lane headers */}
            <div className="grid grid-cols-[40px_1fr_1fr] gap-x-1.5 mb-2">
              <div />
              <div className="flex items-center gap-1.5 pl-2">
                <div className={cx("w-2 h-2 rounded-full shrink-0", PERSON.me.dot)} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
                  {calConnection?.google_email?.split('@')[0] || 'Ti'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 pl-2">
                <div className={cx("w-2 h-2 rounded-full shrink-0", PERSON.partner.dot)} />
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap">
                  {partnerConn?.google_email?.split('@')[0] || 'Partner'}
                </span>
              </div>
            </div>

            {/* Loading — only block on Google API fetch, not DB */}
            {calLoading && <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">Nalagam...</div>}

            {/* Hour grid */}
            {!calLoading && HOURS.map(hour => {
              const mine = eventsAtHour(myEvents, hour);
              const theirs = eventsAtHour(partnerEvents, hour);
              const bothFree = mine.length === 0 && theirs.length === 0;
              return (
                <div key={hour} className={cx("grid grid-cols-[40px_1fr_1fr] gap-x-1.5 min-h-9 rounded-lg mb-0.5", bothFree ? "bg-green-500/4" : "bg-transparent")}>
                  <div className={cx("text-[10px] text-right pt-2.5 pr-1 font-medium", bothFree ? "text-green-500" : "text-slate-400 dark:text-slate-500")}>{hour}:00</div>
                  <div className={cx("border-l-2 pl-1.5 py-1", PERSON.me.lane)}>
                    {mine.map((ev, i) => <EventBlock key={ev.id || i} ev={ev} person="me" />)}
                  </div>
                  <div className={cx("border-l-2 pl-1.5 py-1", PERSON.partner.lane)}>
                    {theirs.map((ev, i) => <EventBlock key={ev.id || i} ev={ev} person="partner" />)}
                  </div>
                </div>
              );
            })}

            {/* Partner not connected note */}
            {calConnections.length > 1 && !partnerConn && (
              <div className="text-center p-4 text-xs text-slate-400 dark:text-slate-500 mt-2">
                Partner še ni povezal svojega koledarja
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event detail modal */}
      {calEventDetail && (
        <Modal onClose={() => setCalEventDetail(null)}>
          <div className="text-xl mb-1">{detectEventType(calEventDetail.title)}</div>
          <h3 className="text-lg font-extrabold mb-1">{calEventDetail.title}</h3>
          {!calEventDetail.is_all_day && calEventDetail.start_time && (
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              {fmtTime(calEventDetail.start_time)}{calEventDetail.end_time ? ` – ${fmtTime(calEventDetail.end_time)}` : ''}
            </div>
          )}
          <button onClick={() => setCalEventDetail(d => ({ ...d, is_important: !d.is_important }))} className={cx(
            "w-full p-3 rounded-xl border text-sm font-bold cursor-pointer mb-3",
            calEventDetail.is_important ? "border-amber-500/40 bg-amber-500/12 text-amber-500" : "border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500"
          )}>
            {calEventDetail.is_important ? "⭐ Pomemben" : "☆ Označi kot pomemben"}
          </button>
          <Label>Oznaka</Label>
          <Input value={calEventDetail.label || ''} onChange={e => setCalEventDetail(d => ({ ...d, label: e.target.value }))} placeholder="Dodaj oznako..." className="mb-4" />
          <Btn onClick={async () => { await updateCalEvent(calEventDetail.id, { label: calEventDetail.label || null, is_important: calEventDetail.is_important || false }); setCalEventDetail(null); }}>Shrani</Btn>
        </Modal>
      )}
    </Screen>
  );
}
