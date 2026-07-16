'use client';
import { useTodoItems } from '@/lib/hooks';
import { useTranslations, useFormatter } from 'next-intl';
import { getSt, cx, dueTone, DUE_BAR, DUE_BADGE } from '@/lib/utils';
import { eventTitle } from '@/lib/intl';
import { Screen, PageBody, Card, SectionHeader, IconButton } from './ui';
import HomeModule from './HomeModule';

// Calendar person tones
const EVENT_STRIP = { me: 'bg-indigo-500', partner: 'bg-pink-500' };
const EVENT_BORDER = { me: 'border-indigo-500/38', partner: 'border-pink-500/38' };
const EVENT_LABEL = { me: 'text-indigo-500', partner: 'text-pink-500' };

// ─── TODO HOME CARD (used in Home screen preview) ───
function TodoListHomeCard({ list, householdId, onNavigate }) {
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
    <Card onClick={onNavigate} className="mb-2 flex cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-3">
      <span className="shrink-0 text-xl">{list.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className={cx('text-sm font-bold text-slate-800 dark:text-slate-200', total > 0 && 'mb-1')}>
          {list.title}
        </div>
        {total > 0 && (
          <div className="h-0.75 rounded-xs bg-indigo-500/20 dark:bg-slate-600/30">
            <div
              className={cx('h-full rounded-xs transition-[width] duration-300', DUE_BAR[tone])}
              style={{ width: pct + '%' }}
            />
          </div>
        )}
      </div>
      {total > 0 && (
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
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

export default function HomeScreen({
  user,
  householdId,
  items,
  shopItems,
  todoLists,
  todayCalEvents,
  calConnected,
  navigate,
  onOpenSettings,
}) {
  const t = useTranslations('HomeScreen');
  const ta = useTranslations('A11y');
  const tCal = useTranslations('Calendar');
  const format = useFormatter();
  const fmtTime = (d) => format.dateTime(new Date(d), 'time');
  const expiredC = items.filter((i) => getSt(i) === 'expired').length;
  const warningC = items.filter((i) => getSt(i) === 'warning').length;
  const toBuyC = shopItems.filter((i) => !i.checked).length;
  const today = format.dateTime(new Date(), 'weekdayFull');

  return (
    <Screen>
      <PageBody>
        {/* Header */}
        <div className="mb-6 flex items-start justify-between pt-3">
          <div>
            <div className="text-3xl font-black">
              <span className="bg-linear-135 from-slate-800 to-violet-300 bg-clip-text text-transparent dark:from-slate-200">
                Cožy
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 capitalize dark:text-slate-400">{today}</div>
          </div>
          <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
            ⚙️
          </IconButton>
        </div>

        {/* Quick stats */}
        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <Card onClick={() => navigate('freezer')} className="cursor-pointer p-4">
            <div className="mb-2 text-3xl">❄️</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-200">{items.length}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('inFreezer')}</div>
            {(expiredC > 0 || warningC > 0) && (
              <div className={cx('mt-1.5 text-xs font-bold', expiredC > 0 ? 'text-red-500' : 'text-amber-500')}>
                {expiredC > 0 ? t('expired', { count: expiredC }) : t('expiringSoon', { count: warningC })}
              </div>
            )}
          </Card>
          <Card onClick={() => navigate('shopping')} className="cursor-pointer p-4">
            <div className="mb-2 text-3xl">🛒</div>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-slate-200">{toBuyC}</div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('toBuy')}</div>
            {toBuyC === 0 && <div className="mt-1.5 text-xs font-bold text-green-500">{t('allBought')}</div>}
          </Card>
        </div>

        {/* Today's calendar events */}
        {calConnected && todayCalEvents.length > 0 && (
          <div className="mb-5">
            <SectionHeader>{t('today')}</SectionHeader>
            {todayCalEvents
              .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
              .map((ev) => {
                const person = ev.user_id === user.id ? 'me' : 'partner';
                return (
                  <div
                    key={ev.id}
                    onClick={() => navigate('calendar')}
                    className={cx(
                      'mb-1.5 flex cursor-pointer items-center gap-2.5 rounded-xl border bg-white/80 px-3.5 py-2.5 dark:bg-slate-800/60',
                      ev.is_important ? EVENT_BORDER[person] : 'border-indigo-500/15 dark:border-slate-600/20',
                    )}
                  >
                    <div className={cx('h-9 w-0.75 shrink-0 rounded-xs', EVENT_STRIP[person])} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 text-sm font-bold text-slate-800 dark:text-slate-200">
                        {ev.is_important && <span className="text-xs">⭐</span>}
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                          {eventTitle(ev.title, tCal)}
                        </span>
                      </div>
                      {ev.label && (
                        <div className={cx('mt-px text-xs font-semibold', EVENT_LABEL[person])}>{ev.label}</div>
                      )}
                      {!ev.is_all_day && ev.start_time && (
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {fmtTime(ev.start_time)}
                          {ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
                        </div>
                      )}
                    </div>
                    {ev.is_all_day && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">{t('allDay')}</div>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {/* Active todo lists preview */}
        {todoLists.length > 0 && (
          <div className="mb-5">
            <SectionHeader>{t('todos')}</SectionHeader>
            {todoLists.slice(0, 3).map((list) => (
              <TodoListHomeCard
                key={list.id}
                list={list}
                householdId={householdId}
                onNavigate={() => navigate('todo')}
              />
            ))}
          </div>
        )}

        {/* Home module: traffic, shortcuts, bus, bikes */}
        <HomeModule user={user} householdId={householdId} />

        {/* Coming soon modules */}
        <SectionHeader>{t('comingSoon')}</SectionHeader>
        {[
          {
            icon: '🍽️',
            title: t('mealPlan'),
            desc: t('mealPlanDesc'),
            badgeClass: 'text-amber-500 bg-amber-500/9 border-amber-500/20',
          },
        ].map((m) => (
          <Card key={m.title} className="mb-2 flex items-center gap-3.5 px-4 py-3.5 opacity-65">
            <span className="text-3xl">{m.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{m.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{m.desc}</div>
            </div>
            <div className={cx('rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap', m.badgeClass)}>
              {t('soon')}
            </div>
          </Card>
        ))}
      </PageBody>
    </Screen>
  );
}
