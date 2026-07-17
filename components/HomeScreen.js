'use client';
import { useTodoItems } from '@/lib/hooks';
import { useTranslations, useFormatter } from 'next-intl';
import { Settings } from 'lucide-react';
import { getSt, cx, dueTone, DUE_BAR, DUE_BADGE, PERSON } from '@/lib/utils';
import { eventTitle } from '@/lib/intl';
import { Screen, PageBody, Card, SectionHeader, IconButton, Wordmark, ROW_FLAT } from './ui';
import HomeModule from './HomeModule';

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
            <Wordmark className="text-4xl" />
            <div className="mt-0.5 text-xs text-stone-500 capitalize dark:text-stone-400">{today}</div>
          </div>
          <IconButton onClick={onOpenSettings} aria-label={ta('settings')}>
            <Settings className="size-4.5" />
          </IconButton>
        </div>

        {/* Quick stats */}
        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <Card onClick={() => navigate('freezer')} className="cursor-pointer rounded-3xl p-5">
            <div className="mb-2 text-3xl">❄️</div>
            <div className="font-serif text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {items.length}
            </div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('inFreezer')}</div>
            {(expiredC > 0 || warningC > 0) && (
              <div
                className={cx(
                  'mt-1.5 text-xs font-bold',
                  expiredC > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
                )}
              >
                {expiredC > 0 ? t('expired', { count: expiredC }) : t('expiringSoon', { count: warningC })}
              </div>
            )}
          </Card>
          <Card onClick={() => navigate('shopping')} className="cursor-pointer rounded-3xl p-5">
            <div className="mb-2 text-3xl">🛒</div>
            <div className="font-serif text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {toBuyC}
            </div>
            <div className="text-xs font-semibold text-stone-500 dark:text-stone-400">{t('toBuy')}</div>
            {toBuyC === 0 && (
              <div className="mt-1.5 text-xs font-bold text-green-600 dark:text-green-400">{t('allBought')}</div>
            )}
          </Card>
        </div>

        {/* Today's calendar events — flat rows with person dots (ref-2 style) */}
        {calConnected && todayCalEvents.length > 0 && (
          <div className="mb-5">
            <SectionHeader>{t('today')}</SectionHeader>
            <Card className="px-3.5 py-1">
              {todayCalEvents
                .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
                .map((ev) => {
                  const person = ev.user_id === user.id ? 'me' : 'partner';
                  return (
                    <div
                      key={ev.id}
                      onClick={() => navigate('calendar')}
                      className={cx(ROW_FLAT, 'cursor-pointer gap-2.5 py-2.5')}
                    >
                      <div className={cx('h-9 w-0.75 shrink-0 rounded-xs', PERSON[person].dot)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-sm font-bold text-stone-900 dark:text-stone-100">
                          {ev.is_important && <span className="text-xs">⭐</span>}
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                            {eventTitle(ev.title, tCal)}
                          </span>
                        </div>
                        {ev.label && (
                          <div className={cx('mt-px text-xs font-semibold', PERSON[person].text)}>{ev.label}</div>
                        )}
                        {!ev.is_all_day && ev.start_time && (
                          <div className="text-xs text-stone-400 dark:text-stone-500">
                            {fmtTime(ev.start_time)}
                            {ev.end_time ? ` – ${fmtTime(ev.end_time)}` : ''}
                          </div>
                        )}
                      </div>
                      {ev.is_all_day && (
                        <div className="text-[10px] text-stone-400 dark:text-stone-500">{t('allDay')}</div>
                      )}
                    </div>
                  );
                })}
            </Card>
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
            badgeClass:
              'text-stone-500 bg-stone-200/60 border-stone-300 dark:text-stone-400 dark:bg-stone-800 dark:border-stone-700',
          },
        ].map((m) => (
          <Card key={m.title} className="mb-2 flex items-center gap-3.5 px-4 py-3.5 opacity-65">
            <span className="text-3xl">{m.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-stone-900 dark:text-stone-100">{m.title}</div>
              <div className="text-xs text-stone-500 dark:text-stone-400">{m.desc}</div>
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
