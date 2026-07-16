'use client';
import { useTodoItems } from '@/lib/hooks';
import { getSt, fmtTime } from '@/lib/utils';
import HomeModule from './HomeModule';

// ─── TODO HOME CARD (used in Home screen preview) ───
function TodoListHomeCard({ list, householdId, st, isDark, onNavigate }) {
  const { items } = useTodoItems(householdId, list.id);
  const done = items.filter(i => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? new Date(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  const accent = isPast ? '#EF4444' : isUrgent ? '#F59E0B' : '#A855F7';
  return (
    <div onClick={onNavigate} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: st.cardBg, border: st.cardBorder, borderRadius: 14, marginBottom: 8, cursor: "pointer" }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{list.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: st.textPrimary, marginBottom: total > 0 ? 4 : 0 }}>{list.title}</div>
        {total > 0 && (
          <div style={{ height: 3, background: isDark ? 'rgba(71,85,105,0.3)' : 'rgba(99,102,241,0.1)', borderRadius: 2 }}>
            <div style={{ height: '100%', borderRadius: 2, width: pct + '%', background: accent, transition: 'width 0.3s' }} />
          </div>
        )}
      </div>
      {total > 0 && <span style={{ fontSize: 11, color: st.textSecondary, flexShrink: 0 }}>{done}/{total}</span>}
      {dueDate && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 7, background: accent + '20', color: accent, flexShrink: 0 }}>{isPast ? '🔴' : dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}</span>}
    </div>
  );
}

export default function HomeScreen({
  user, householdId, isDark, st,
  items, shopItems, todoLists, todayCalEvents, calConnected,
  navigate, onOpenSettings,
}) {
  const expiredC = items.filter(i => getSt(i) === "expired").length;
  const warningC = items.filter(i => getSt(i) === "warning").length;
  const toBuyC = shopItems.filter(i => !i.checked).length;
  const today = new Date().toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={st.A}><div style={st.F1} /><div style={st.F2} />
      <div style={{ position: "relative", zIndex: 1, padding: "16px 16px calc(100px + env(safe-area-inset-bottom))" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingTop: 12, marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>
              <span style={{ background: "linear-gradient(135deg,#E2E8F0,#C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cožy</span>
            </div>
            <div style={{ fontSize: 12, color: st.textSecondary, marginTop: 2, textTransform: "capitalize" }}>{today}</div>
          </div>
          <button onClick={onOpenSettings} style={{ background: "rgba(30,41,59,0.6)", border: "1px solid rgba(71,85,105,0.2)", borderRadius: 10, padding: "8px 10px", color: "#64748B", fontSize: 14, cursor: "pointer", fontWeight: 600, lineHeight: 1 }}>⚙️</button>
        </div>

        {/* Quick stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          <div onClick={() => navigate("freezer")} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 18, padding: "16px", cursor: "pointer" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>❄️</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: st.textPrimary }}>{items.length}</div>
            <div style={{ fontSize: 12, color: st.textSecondary, fontWeight: 600 }}>v zamrzovalniku</div>
            {(expiredC > 0 || warningC > 0) && (
              <div style={{ marginTop: 6, fontSize: 11, color: expiredC > 0 ? "#EF4444" : "#F59E0B", fontWeight: 700 }}>
                {expiredC > 0 ? `${expiredC} poteklo` : `${warningC} kmalu poteče`}
              </div>
            )}
          </div>
          <div onClick={() => navigate("shopping")} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 18, padding: "16px", cursor: "pointer" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🛒</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: st.textPrimary }}>{toBuyC}</div>
            <div style={{ fontSize: 12, color: st.textSecondary, fontWeight: 600 }}>za kupiti</div>
            {toBuyC === 0 && <div style={{ marginTop: 6, fontSize: 11, color: "#22C55E", fontWeight: 700 }}>Vse kupljeno ✓</div>}
          </div>
        </div>

        {/* Today's calendar events */}
        {calConnected && todayCalEvents.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: st.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Danes</div>
            {todayCalEvents.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(ev => {
              const isMe = ev.user_id === user.id;
              const color = isMe ? '#6366F1' : '#EC4899';
              return (
                <div key={ev.id} onClick={() => navigate('calendar')} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: st.cardBg, border: `1px solid ${ev.is_important ? color + '60' : st.cardBorder.replace('1px solid ', '')}`, borderRadius: 14, marginBottom: 6, cursor: "pointer" }}>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: st.textPrimary, display: "flex", alignItems: "center", gap: 4 }}>
                      {ev.is_important && <span style={{ fontSize: 11 }}>⭐</span>}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</span>
                    </div>
                    {ev.label && <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 1 }}>{ev.label}</div>}
                    {!ev.is_all_day && ev.start_time && <div style={{ fontSize: 11, color: st.textMuted }}>{fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}</div>}
                  </div>
                  {ev.is_all_day && <div style={{ fontSize: 10, color: st.textMuted }}>Ves dan</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Active todo lists preview */}
        {todoLists.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: st.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Opravila</div>
            {todoLists.slice(0, 3).map(list => (
              <TodoListHomeCard key={list.id} list={list} householdId={householdId} st={st} isDark={isDark} onNavigate={() => navigate("todo")} />
            ))}
          </div>
        )}

        {/* Home module: traffic, shortcuts, bus, bikes */}
        <HomeModule user={user} householdId={householdId} isDark={isDark} />

        {/* Coming soon modules */}
        <div style={{ fontSize: 11, fontWeight: 700, color: st.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Prihaja kmalu</div>
        {[
          { icon: "🍽️", title: "Jedilnik", desc: "Tedenski jedilnik & recepti", color: "#F59E0B" },
        ].map(m => (
          <div key={m.title} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: st.cardBg, border: st.cardBorder, borderRadius: 16, marginBottom: 8, opacity: 0.65 }}>
            <span style={{ fontSize: 26 }}>{m.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: st.textPrimary }}>{m.title}</div>
              <div style={{ fontSize: 12, color: st.textSecondary }}>{m.desc}</div>
            </div>
            <div style={{ fontSize: 11, color: m.color, fontWeight: 700, background: m.color + "18", padding: "4px 10px", borderRadius: 20, border: `1px solid ${m.color}35`, whiteSpace: "nowrap" }}>Kmalu</div>
          </div>
        ))}
      </div>
    </div>
  );
}
