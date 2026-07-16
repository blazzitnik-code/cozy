'use client';
import { useTodoItems } from '@/lib/hooks';
import { getSt, fmtTime, cx, dueTone, DUE_BAR, DUE_BADGE } from '@/lib/utils';
import { Screen, SectionHeader, IconButton } from './ui';
import HomeModule from './HomeModule';

// Calendar person tones
const EVENT_STRIP = { me: "bg-me", partner: "bg-partner" };
const EVENT_BORDER = { me: "border-me/38", partner: "border-partner/38" };
const EVENT_LABEL = { me: "text-me", partner: "text-partner" };

// ─── TODO HOME CARD (used in Home screen preview) ───
function TodoListHomeCard({ list, householdId, onNavigate }) {
  const { items } = useTodoItems(householdId, list.id);
  const done = items.filter(i => i.checked).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const dueDate = list.due_date ? new Date(list.due_date) : null;
  const daysLeft = dueDate ? Math.ceil((dueDate - new Date()) / 864e5) : null;
  const isPast = daysLeft !== null && daysLeft < 0;
  const tone = dueTone(daysLeft);
  return (
    <div onClick={onNavigate} className="flex items-center gap-2.5 py-3 px-3.5 bg-surface border border-line rounded-14 mb-2 cursor-pointer">
      <span className="text-20 shrink-0">{list.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className={cx("text-13 font-bold text-ink", total > 0 && "mb-1")}>{list.title}</div>
        {total > 0 && (
          <div className="h-[3px] bg-line-strong rounded-2">
            <div className={cx("h-full rounded-2 transition-[width] duration-300", DUE_BAR[tone])} style={{ width: pct + '%' }} />
          </div>
        )}
      </div>
      {total > 0 && <span className="text-11 text-ink-2 shrink-0">{done}/{total}</span>}
      {dueDate && <span className={cx("text-11 font-bold px-[7px] py-0.5 rounded-8 shrink-0", DUE_BADGE[tone])}>{isPast ? '🔴' : dueDate.toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}</span>}
    </div>
  );
}

export default function HomeScreen({
  user, householdId,
  items, shopItems, todoLists, todayCalEvents, calConnected,
  navigate, onOpenSettings,
}) {
  const expiredC = items.filter(i => getSt(i) === "expired").length;
  const warningC = items.filter(i => getSt(i) === "warning").length;
  const toBuyC = shopItems.filter(i => !i.checked).length;
  const today = new Date().toLocaleDateString("sl-SI", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Screen>
      <div className="relative z-1 pt-4 px-4 pb-[calc(100px+env(safe-area-inset-bottom))]">

        {/* Header */}
        <div className="flex justify-between items-start pt-3 mb-6">
          <div>
            <div className="text-28 font-black">
              <span className="bg-grad-brand-app text-gradient">Cožy</span>
            </div>
            <div className="text-12 text-ink-2 mt-0.5 capitalize">{today}</div>
          </div>
          <IconButton onClick={onOpenSettings}>⚙️</IconButton>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div onClick={() => navigate("freezer")} className="bg-surface border border-line rounded-18 p-4 cursor-pointer">
            <div className="text-28 mb-2">❄️</div>
            <div className="text-26 font-extrabold text-ink">{items.length}</div>
            <div className="text-12 text-ink-2 font-semibold">v zamrzovalniku</div>
            {(expiredC > 0 || warningC > 0) && (
              <div className={cx("mt-1.5 text-11 font-bold", expiredC > 0 ? "text-danger" : "text-amber")}>
                {expiredC > 0 ? `${expiredC} poteklo` : `${warningC} kmalu poteče`}
              </div>
            )}
          </div>
          <div onClick={() => navigate("shopping")} className="bg-surface border border-line rounded-18 p-4 cursor-pointer">
            <div className="text-28 mb-2">🛒</div>
            <div className="text-26 font-extrabold text-ink">{toBuyC}</div>
            <div className="text-12 text-ink-2 font-semibold">za kupiti</div>
            {toBuyC === 0 && <div className="mt-1.5 text-11 text-success font-bold">Vse kupljeno ✓</div>}
          </div>
        </div>

        {/* Today's calendar events */}
        {calConnected && todayCalEvents.length > 0 && (
          <div className="mb-5">
            <SectionHeader>Danes</SectionHeader>
            {todayCalEvents.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(ev => {
              const person = ev.user_id === user.id ? 'me' : 'partner';
              return (
                <div key={ev.id} onClick={() => navigate('calendar')} className={cx("flex items-center gap-2.5 py-2.5 px-3.5 bg-surface border rounded-14 mb-1.5 cursor-pointer", ev.is_important ? EVENT_BORDER[person] : "border-line")}>
                  <div className={cx("w-[3px] h-9 rounded-2 shrink-0", EVENT_STRIP[person])} />
                  <div className="flex-1 min-w-0">
                    <div className="text-13 font-bold text-ink flex items-center gap-1">
                      {ev.is_important && <span className="text-11">⭐</span>}
                      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{ev.title}</span>
                    </div>
                    {ev.label && <div className={cx("text-11 font-semibold mt-px", EVENT_LABEL[person])}>{ev.label}</div>}
                    {!ev.is_all_day && ev.start_time && <div className="text-11 text-ink-3">{fmtTime(ev.start_time)}{ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}</div>}
                  </div>
                  {ev.is_all_day && <div className="text-10 text-ink-3">Ves dan</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Active todo lists preview */}
        {todoLists.length > 0 && (
          <div className="mb-5">
            <SectionHeader>Opravila</SectionHeader>
            {todoLists.slice(0, 3).map(list => (
              <TodoListHomeCard key={list.id} list={list} householdId={householdId} onNavigate={() => navigate("todo")} />
            ))}
          </div>
        )}

        {/* Home module: traffic, shortcuts, bus, bikes */}
        <HomeModule user={user} householdId={householdId} />

        {/* Coming soon modules */}
        <SectionHeader>Prihaja kmalu</SectionHeader>
        {[
          { icon: "🍽️", title: "Jedilnik", desc: "Tedenski jedilnik & recepti", badgeClass: "text-amber bg-amber/9 border-amber/20" },
        ].map(m => (
          <div key={m.title} className="flex items-center gap-3.5 py-3.5 px-4 bg-surface border border-line rounded-16 mb-2 opacity-65">
            <span className="text-26">{m.icon}</span>
            <div className="flex-1">
              <div className="text-14 font-bold text-ink">{m.title}</div>
              <div className="text-12 text-ink-2">{m.desc}</div>
            </div>
            <div className={cx("text-11 font-bold py-1 px-2.5 rounded-20 border whitespace-nowrap", m.badgeClass)}>Kmalu</div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
