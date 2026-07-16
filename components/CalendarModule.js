'use client';
import { useState } from 'react';
import { detectEventType, fmtTime } from '@/lib/utils';
import { INP } from '@/lib/styles';
import { Btn, Modal } from './ui';

const SL_DAYS = ['Ne', 'Po', 'To', 'Sr', 'Če', 'Pe', 'So'];
const SL_MONTHS = ['januar', 'februar', 'marec', 'april', 'maj', 'junij', 'julij', 'avgust', 'september', 'oktober', 'november', 'december'];

export default function CalendarModule({
  user, isDark, st,
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

  // Person colors — current user = indigo, partner = pink
  const myColor = '#6366F1';
  const partnerColor = '#EC4899';

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

  const EventBlock = ({ ev, color }) => (
    <div onClick={() => setCalEventDetail({ ...ev })} style={{ background: color + '18', border: `1px solid ${ev.is_important ? color + '80' : color + '40'}`, borderRadius: 10, padding: "6px 8px", marginBottom: 4, cursor: "pointer" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, lineHeight: 1.3 }}>{ev.is_important ? '⭐ ' : ''}{detectEventType(ev.title)} {ev.title}</div>
      {ev.label && <div style={{ fontSize: 10, color, fontWeight: 600, marginTop: 1 }}>{ev.label}</div>}
      {!ev.is_all_day && ev.start_time && (
        <div style={{ fontSize: 10, color: st.textMuted, marginTop: 2 }}>{fmtTime(ev.start_time)}{ev.end_time ? `–${fmtTime(ev.end_time)}` : ''}</div>
      )}
    </div>
  );

  return (
    <div style={st.A}><div style={st.F1} /><div style={st.F2} />
      <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📅 Koledar</h1>
            <div style={{ fontSize: 12, color: st.textSecondary, marginTop: 2, textTransform: "capitalize" }}>{SL_MONTHS[selDay.getMonth()]} {selDay.getFullYear()}</div>
          </div>
          <button onClick={onOpenSettings} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer" }}>⚙️</button>
        </div>

        {/* Week strip */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {days.map((d, i) => (
            <button key={i} onClick={() => setCalDate(new Date(d))} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              padding: "8px 2px", borderRadius: 12, border: "1px solid",
              borderColor: isSel(d) ? "rgba(99,102,241,0.5)" : "rgba(71,85,105,0.15)",
              background: isSel(d) ? "rgba(99,102,241,0.15)" : "transparent", cursor: "pointer",
            }}>
              <span style={{ fontSize: 9, fontWeight: 600, color: isToday(d) ? "#818CF8" : st.textMuted }}>{SL_DAYS[d.getDay()]}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: isSel(d) ? "#818CF8" : isToday(d) ? "#E2E8F0" : st.textSecondary }}>{d.getDate()}</span>
              {isToday(d) && <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#818CF8" }} />}
            </button>
          ))}
        </div>

        {/* Not connected CTA */}
        {!calConnected && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: st.textPrimary, marginBottom: 6 }}>Poveži Google Koledar</div>
            <div style={{ fontSize: 13, color: st.textSecondary, marginBottom: 20 }}>Poveži v nastavitvah</div>
            <button onClick={connectCalendar} style={{ padding: "13px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#6366F1,#818CF8)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Poveži Google Koledar</button>
          </div>
        )}

        {/* Two-lane view */}
        {calConnected && (
          <div>
            {/* Lane headers */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: "0 6px", marginBottom: 8 }}>
              <div />
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: myColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: st.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {calConnection?.google_email?.split('@')[0] || 'Ti'}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: partnerColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: st.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {partnerConn?.google_email?.split('@')[0] || 'Partner'}
                </span>
              </div>
            </div>

            {/* Loading — only block on Google API fetch, not DB */}
            {calLoading && <div style={{ textAlign: "center", padding: "24px 0", color: st.textSecondary, fontSize: 13 }}>Nalagam...</div>}

            {/* Hour grid */}
            {!calLoading && HOURS.map(hour => {
              const mine = eventsAtHour(myEvents, hour);
              const theirs = eventsAtHour(partnerEvents, hour);
              const bothFree = mine.length === 0 && theirs.length === 0;
              return (
                <div key={hour} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: "0 6px", minHeight: 36, background: bothFree ? "rgba(34,197,94,0.04)" : "transparent", borderRadius: 8, marginBottom: 2 }}>
                  <div style={{ fontSize: 10, color: bothFree ? "#22C55E" : st.textMuted, textAlign: "right", paddingTop: 10, paddingRight: 4, fontWeight: 500 }}>{hour}:00</div>
                  <div style={{ borderLeft: `2px solid ${myColor}25`, paddingLeft: 6, paddingTop: 4, paddingBottom: 4 }}>
                    {mine.map((ev, i) => <EventBlock key={ev.id || i} ev={ev} color={myColor} />)}
                  </div>
                  <div style={{ borderLeft: `2px solid ${partnerColor}25`, paddingLeft: 6, paddingTop: 4, paddingBottom: 4 }}>
                    {theirs.map((ev, i) => <EventBlock key={ev.id || i} ev={ev} color={partnerColor} />)}
                  </div>
                </div>
              );
            })}

            {/* Partner not connected note */}
            {calConnections.length > 1 && !partnerConn && (
              <div style={{ textAlign: "center", padding: "16px", fontSize: 12, color: st.textMuted, marginTop: 8 }}>
                Partner še ni povezal svojega koledarja
              </div>
            )}
          </div>
        )}
      </div>

      {/* Event detail modal */}
      {calEventDetail && (
        <Modal isDark={isDark} onClose={() => setCalEventDetail(null)}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>{detectEventType(calEventDetail.title)}</div>
          <h3 style={{ fontSize: 17, fontWeight: 800, margin: "0 0 4px" }}>{calEventDetail.title}</h3>
          {!calEventDetail.is_all_day && calEventDetail.start_time && (
            <div style={{ fontSize: 13, color: st.textSecondary, marginBottom: 16 }}>
              {fmtTime(calEventDetail.start_time)}{calEventDetail.end_time ? ` – ${fmtTime(calEventDetail.end_time)}` : ''}
            </div>
          )}
          <button onClick={() => setCalEventDetail(d => ({ ...d, is_important: !d.is_important }))} style={{ width: "100%", padding: "12px", borderRadius: 14, border: `1px solid ${calEventDetail.is_important ? "rgba(245,158,11,0.4)" : "rgba(71,85,105,0.25)"}`, background: calEventDetail.is_important ? "rgba(245,158,11,0.12)" : "rgba(30,41,59,0.4)", color: calEventDetail.is_important ? "#F59E0B" : "#64748B", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
            {calEventDetail.is_important ? "⭐ Pomemben" : "☆ Označi kot pomemben"}
          </button>
          <label style={st.LBL}>Oznaka</label>
          <input value={calEventDetail.label || ''} onChange={e => setCalEventDetail(d => ({ ...d, label: e.target.value }))} placeholder="Dodaj oznako..." style={{ ...INP, marginBottom: 16 }} />
          <Btn onClick={async () => { await updateCalEvent(calEventDetail.id, { label: calEventDetail.label || null, is_important: calEventDetail.is_important || false }); setCalEventDetail(null); }}>Shrani</Btn>
        </Modal>
      )}
    </div>
  );
}
