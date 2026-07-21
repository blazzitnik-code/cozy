'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  useItems,
  useArchived,
  useFreezers,
  useCategories,
  useShoppingItems,
  useShoppingArchived,
  useShoppingFavourites,
  useShoppingStores,
  useCalendarConnections,
  useCalendarEvents,
  useTodoLists,
  useTodoItems,
  useHomeSettings,
  usePushSubscription,
  useBoardNotes,
  useWeather,
} from '@/lib/hooks';
import { useTranslations } from 'next-intl';
import { useLocaleSwitch } from './IntlProvider';
import { rpcErrorKey } from '@/lib/intl';
import { supabase } from '@/lib/supabase';
import { cx, localDateStr } from '@/lib/utils';
import { X } from 'lucide-react';
import {
  Modal,
  ConfirmModal,
  BottomNav,
  Toaster,
  Loader,
  Segmented,
  Avatar,
  Input,
  Label,
  ModalActions,
  PRESS,
  PRESS_SM,
  ROW_FLAT,
} from './ui';
import { notifyError } from '@/lib/notify';
import TodoApp from './TodoApp';
import HomeScreen from './HomeScreen';
import FreezerModule from './FreezerModule';
import ShoppingModule from './ShoppingModule';
import CalendarModule from './CalendarModule';

// ═══════════════════════════
// APP SHELL
// Owns all Supabase hooks, mode/theme, calendar connection
// orchestration and the settings modal; modules get data via props.
// Language lives in IntlProvider (next-intl); modules read it via hooks.
// ═══════════════════════════
const VALID_TABS = ['home', 'freezer', 'shopping', 'calendar', 'todo'];

// Member accent colours — stored as a token string in household_members.color
// (class names, not hex, to stay clear of the no-raw-hex audit).
const MEMBER_COLORS = [
  { t: 'indigo', c: 'bg-indigo-500' },
  { t: 'pink', c: 'bg-pink-500' },
  { t: 'emerald', c: 'bg-emerald-500' },
  { t: 'amber', c: 'bg-amber-500' },
  { t: 'sky', c: 'bg-sky-500' },
  { t: 'violet', c: 'bg-violet-500' },
  { t: 'rose', c: 'bg-rose-500' },
  { t: 'teal', c: 'bg-teal-500' },
];
const memberColorClass = (token) => MEMBER_COLORS.find((x) => x.t === token)?.c;

export default function AppShell({ user, household, members, signOut }) {
  const householdId = household?.id;

  // ─── MODE: home | freezer | shopping | calendar | todo ───
  // Initialized from the URL hash so notification deep-links (/#shopping)
  // land on the right tab even on a cold start.
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined' && VALID_TABS.includes(window.location.hash.slice(1))) {
      return window.location.hash.slice(1);
    }
    return 'home';
  });

  // Notification clicks in a running app arrive as hash changes
  // (sw.js → ServiceWorkerRegistrar → location.hash).
  useEffect(() => {
    const onHash = () => {
      const tab = window.location.hash.slice(1);
      if (VALID_TABS.includes(tab)) {
        setMode(tab);
        history.replaceState(null, '', window.location.pathname);
      }
    };
    onHash(); // consume (and clear) a cold-start hash
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // ─── THEME ───
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('zmrzko_theme') || 'dark';
    return 'dark';
  });
  const switchTheme = (th) => {
    setTheme(th);
    localStorage.setItem('zmrzko_theme', th);
    document.documentElement.dataset.theme = th;
  };

  // ─── SUPABASE HOOKS (household-scoped) ───
  const {
    items,
    loading: itemsLoading,
    addItem: dbAddItem,
    updateItem: dbUpdateItem,
    deleteItem: dbDeleteItem,
  } = useItems(householdId);
  const {
    archived,
    archiveItem: dbArchiveItem,
    updateArchived: dbUpdateArchived,
    deleteArchived: dbDeleteArchived,
    unarchiveItem: dbUnarchiveItem,
  } = useArchived(householdId);
  const {
    freezers,
    addFreezer: dbAddFreezer,
    updateFreezer: dbUpdateFreezer,
    deleteFreezer: dbDeleteFreezer,
  } = useFreezers(householdId);
  const { categories } = useCategories(householdId);
  const {
    items: shopItems,
    loading: shopLoading,
    addItem: dbShopAdd,
    updateItem: dbShopUpdate,
    deleteItem: dbShopDelete,
  } = useShoppingItems(householdId);
  const {
    archived: shopArchive,
    loading: shopArchiveLoading,
    archiveChecked: dbShopArchiveChecked,
  } = useShoppingArchived(householdId);
  const { favourites: shopFavourites, toggleFavourite: dbShopToggleFav } = useShoppingFavourites(householdId);
  const {
    stores: shopStores,
    addStore: dbAddStore,
    updateStore: dbUpdateStore,
    deleteStore: dbDeleteStore,
  } = useShoppingStores(householdId);
  const {
    lists: todoLists,
    archivedLists: todoArchivedLists,
    loading: todoListsLoading,
    addList: dbAddTodoList,
    updateList: dbUpdateTodoList,
    archiveList: dbArchiveTodoList,
    unarchiveList: dbUnarchiveTodoList,
    deleteList: dbDeleteTodoList,
  } = useTodoLists(householdId);
  const {
    itemsByList: todoItemsByList,
    addItem: dbAddTodoItem,
    updateItem: dbUpdateTodoItem,
    deleteItem: dbDeleteTodoItem,
    toggleItem: dbToggleTodoItem,
  } = useTodoItems(householdId);
  const {
    settings: homeSettings,
    loading: homeSettingsLoading,
    saveSettings: saveHomeSettings,
  } = useHomeSettings(householdId, user.id);

  // ─── HOME EXTRAS (board notes + weather) ───
  const {
    notes: boardNotes,
    addNote: dbAddNote,
    updateNote: dbUpdateNote,
    markDone: dbMarkNoteDone,
  } = useBoardNotes(householdId);
  const weather = useWeather(); // Ljubljana default; coords hardcoded for now

  // ─── WEB PUSH ───
  // locale is needed here (not just in SettingsModal) because the
  // subscription row stores it for server-side notification language.
  const { locale: pushLocale } = useLocaleSwitch();
  const push = usePushSubscription(householdId, user.id, pushLocale);

  // ─── CALENDAR STATE ───
  const [calDate, setCalDate] = useState(new Date());
  const [calLoading, setCalLoading] = useState(false);
  const {
    connections: calConnections,
    myConnection: calConnection,
    isConnected: calConnected,
    saveConnection: saveCalConnection,
    removeConnection: removeCalConnection,
    expireConnection: expireCalConnection,
    saveEvents: saveCalEvents,
  } = useCalendarConnections(householdId, user.id);
  const calDateStr = localDateStr(calDate);
  // "Today" must roll over at midnight — a PWA left open overnight would keep
  // querying yesterday's events (HomeScreen's header date, recomputed every
  // render, would move on without it and the two would disagree).
  const [todayStr, setTodayStr] = useState(() => localDateStr());
  const homeSyncDone = useRef(false);
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const t = setTimeout(() => {
      homeSyncDone.current = false; // re-sync Google events for the new day
      setTodayStr(localDateStr());
    }, nextMidnight - now);
    return () => clearTimeout(t);
  }, [todayStr]);
  const {
    events: allCalEvents,
    refetch: refetchCalEvents,
    updateEvent: updateViewedCalEvent,
  } = useCalendarEvents(householdId, calDateStr);
  const { events: todayCalEvents, refetch: refetchTodayCalEvents } = useCalendarEvents(householdId, todayStr);
  // The detail modal edits events on the *viewed* date — write through that
  // hook instance (it refetches the viewed lanes) and refresh the today
  // instance too for HomeScreen's "Today" list.
  const updateCalEvent = useCallback(
    async (id, updates) => {
      await updateViewedCalEvent(id, updates);
      refetchTodayCalEvents();
    },
    [updateViewedCalEvent, refetchTodayCalEvents],
  );
  const [myFetchedEvents, setMyFetchedEvents] = useState([]);

  // ─── SETTINGS ───
  const [showSettings, setShowSettings] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  // ─── NAVIGATION ───
  const navigate = useCallback((tab) => setMode(tab), []);
  const openSettings = useCallback(() => setShowSettings(true), []);

  // Best-effort hygiene before signing out on a shared browser: drop this
  // device's push subscription and the cached Supabase REST responses.
  const handleSignOut = async () => {
    try {
      if (push.subscribed) await push.disable();
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith('cozy-data')).map((k) => caches.delete(k)));
      }
    } catch (e) {
      console.error('sign-out cleanup failed', e);
    }
    signOut();
  };

  // ─── CALENDAR LOGIC ───
  // Responses only apply while the fetched date is still the viewed one:
  // the once-per-session home sync fetches *today* and out-of-order
  // responses when flipping dates would clobber the lane otherwise.
  const calDateStrRef = useRef(calDateStr);
  calDateStrRef.current = calDateStr;

  // Set on a 403 (config-side failure: disabled Calendar API, missing scope —
  // reconnecting can't fix it): one toast per session, then stop hammering.
  const calSyncBroken = useRef(false);

  const fetchCalEvents = useCallback(
    async (date, token) => {
      if (!token || calSyncBroken.current) return;
      setCalLoading(true);
      try {
        const dateStr = date instanceof Date ? localDateStr(date) : date;
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          if (dateStr === calDateStrRef.current) setMyFetchedEvents(items); // show immediately, no DB dependency
          await saveCalEvents(items, dateStr); // save for partner to see
          refetchCalEvents();
        } else if (res.status === 401) {
          // Token revoked/invalid despite a future expires_at — expire the row
          // so the UI falls back to the connect button.
          expireCalConnection();
        } else if (res.status === 403) {
          calSyncBroken.current = true;
          console.error('Calendar sync failed:', await res.json().catch(() => res.statusText));
          notifyError('Errors.calendarSync');
        } else {
          console.error('Calendar fetch failed:', res.status, res.statusText);
        }
      } catch (e) {
        console.error('Calendar fetch error:', e);
      }
      setCalLoading(false);
    },
    [saveCalEvents, expireCalConnection],
  );

  // Clear the lane only when the viewed date changes — re-entering the tab
  // keeps the previous events visible while the refetch below runs behind them.
  useEffect(() => {
    setMyFetchedEvents([]);
  }, [calDateStr]);

  useEffect(() => {
    if (mode === 'calendar' && calConnected && calConnection?.access_token) {
      fetchCalEvents(calDate, calConnection.access_token);
    }
  }, [mode, calDate, calConnected, calConnection?.access_token, fetchCalEvents]);

  // Sync today's events once per session (and again after a midnight
  // rollover — the timer resets homeSyncDone and bumps todayStr).
  useEffect(() => {
    if (calConnected && calConnection?.access_token && !homeSyncDone.current) {
      homeSyncDone.current = true;
      fetchCalEvents(new Date(), calConnection.access_token);
    }
  }, [calConnected, calConnection?.access_token, fetchCalEvents, todayStr]);

  const connectCalendar = useCallback(
    (silent = false) => {
      const init = () => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          scope: 'https://www.googleapis.com/auth/calendar.readonly',
          callback: async (resp) => {
            if (resp.error || !resp.access_token) return;
            const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${resp.access_token}` },
            }).then((r) => r.json());
            calSyncBroken.current = false; // fresh grant — give sync another go
            await saveCalConnection({ accessToken: resp.access_token, expiresIn: resp.expires_in, email: info.email });
          },
        });
        // silent = no popup, uses existing Google browser session
        tokenClient.requestAccessToken(silent ? { prompt: '' } : {});
      };
      if (window.google?.accounts?.oauth2) {
        init();
      } else {
        // layout.js already loads the GSI script (afterInteractive) — attach
        // to the existing tag while it loads instead of injecting a duplicate.
        const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
        if (existing) {
          existing.addEventListener('load', init, { once: true });
        } else {
          const s = document.createElement('script');
          s.src = 'https://accounts.google.com/gsi/client';
          s.onload = init;
          document.head.appendChild(s);
        }
      }
    },
    [saveCalConnection],
  );

  // Auto-refresh token 5 min before expiry; silent so no popup appears
  // Only schedule if token is still valid (not already expired)
  useEffect(() => {
    if (!calConnection?.expires_at) return;
    const msLeft = new Date(calConnection.expires_at) - Date.now();
    if (msLeft <= 0) return; // already expired — user must reconnect manually
    const delay = Math.max(0, msLeft - 5 * 60 * 1000);
    const t = setTimeout(() => connectCalendar(true), delay);
    return () => clearTimeout(t);
  }, [calConnection?.expires_at, connectCalendar]);

  // ─── LOADING GATE (global categories are required for the app to work) ───
  const hasCats = Object.keys(categories).length > 0;

  if (itemsLoading || !hasCats) return <Loader />;

  // ─── SHELL CHROME (nav + settings + settings-confirm), rendered once per mode ───
  const chrome = (
    <>
      <BottomNav mode={mode} onNavigate={navigate} />
      <Modal open={showSettings} onClose={() => setShowSettings(false)}>
        <SettingsBody
          user={user}
          household={household}
          members={members}
          theme={theme}
          switchTheme={switchTheme}
          push={push}
          calConnected={calConnected}
          calConnection={calConnection}
          removeCalConnection={removeCalConnection}
          connectCalendar={connectCalendar}
          setShowSettings={setShowSettings}
          setConfirmAction={setConfirmAction}
          handleSignOut={handleSignOut}
        />
      </Modal>
      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
      <Toaster />
    </>
  );

  // Single return with per-mode branches: BottomNav (and the rest of the
  // chrome) stays mounted across tab switches, so its layoutId nav dot can
  // slide between tabs while modules unmount/remount around it.
  return (
    <>
      {mode === 'home' && (
        <HomeScreen
          user={user}
          members={members}
          items={items}
          shopItems={shopItems}
          todoLists={todoLists}
          todoItemsByList={todoItemsByList}
          todayCalEvents={todayCalEvents}
          calConnected={calConnected}
          homeSettings={homeSettings}
          homeSettingsLoading={homeSettingsLoading}
          saveHomeSettings={saveHomeSettings}
          boardNotes={boardNotes}
          addNote={dbAddNote}
          updateNote={dbUpdateNote}
          markNoteDone={dbMarkNoteDone}
          weather={weather}
          navigate={navigate}
          onOpenSettings={openSettings}
        />
      )}
      {mode === 'calendar' && (
        <CalendarModule
          user={user}
          calDate={calDate}
          setCalDate={setCalDate}
          calConnections={calConnections}
          calConnection={calConnection}
          calConnected={calConnected}
          connectCalendar={connectCalendar}
          calLoading={calLoading}
          myFetchedEvents={myFetchedEvents}
          allCalEvents={allCalEvents}
          updateCalEvent={updateCalEvent}
          onOpenSettings={openSettings}
          onGoHome={() => navigate('home')}
        />
      )}
      {mode === 'todo' && (
        <TodoApp
          user={user}
          members={members}
          lists={todoLists}
          listsLoading={todoListsLoading}
          archivedLists={todoArchivedLists}
          addList={dbAddTodoList}
          updateList={dbUpdateTodoList}
          archiveList={dbArchiveTodoList}
          unarchiveList={dbUnarchiveTodoList}
          deleteList={dbDeleteTodoList}
          itemsByList={todoItemsByList}
          addItem={dbAddTodoItem}
          updateItem={dbUpdateTodoItem}
          deleteItem={dbDeleteTodoItem}
          toggleItem={dbToggleTodoItem}
          onOpenSettings={openSettings}
          onGoHome={() => navigate('home')}
        />
      )}
      {mode === 'shopping' && (
        <ShoppingModule
          shopItems={shopItems}
          shopLoading={shopLoading}
          shopArchiveLoading={shopArchiveLoading}
          dbShopAdd={dbShopAdd}
          dbShopUpdate={dbShopUpdate}
          dbShopDelete={dbShopDelete}
          shopArchive={shopArchive}
          dbShopArchiveChecked={dbShopArchiveChecked}
          shopFavourites={shopFavourites}
          dbShopToggleFav={dbShopToggleFav}
          shopStores={shopStores}
          dbAddStore={dbAddStore}
          dbUpdateStore={dbUpdateStore}
          dbDeleteStore={dbDeleteStore}
          onGoHome={() => navigate('home')}
          onOpenSettings={openSettings}
        />
      )}
      {mode === 'freezer' && (
        <FreezerModule
          items={items}
          dbAddItem={dbAddItem}
          dbUpdateItem={dbUpdateItem}
          dbDeleteItem={dbDeleteItem}
          archived={archived}
          dbArchiveItem={dbArchiveItem}
          dbUpdateArchived={dbUpdateArchived}
          dbDeleteArchived={dbDeleteArchived}
          dbUnarchiveItem={dbUnarchiveItem}
          freezers={freezers}
          dbAddFreezer={dbAddFreezer}
          dbUpdateFreezer={dbUpdateFreezer}
          dbDeleteFreezer={dbDeleteFreezer}
          categories={categories}
          onGoHome={() => navigate('home')}
          onOpenSettings={openSettings}
        />
      )}
      {chrome}
    </>
  );
}

// Settings sheet body — hoisted to module level so the open sheet's subtree
// survives AppShell re-renders (every realtime update) instead of being
// remounted each render (which also re-registered the Segmented layoutId
// thumbs). Its Modal shell stays inside `chrome` with a stable element type.
function SettingsBody({
  user,
  household,
  members,
  theme,
  switchTheme,
  push,
  calConnected,
  calConnection,
  removeCalConnection,
  connectCalendar,
  setShowSettings,
  setConfirmAction,
  handleSignOut,
}) {
  const t = useTranslations('Settings');
  const tc = useTranslations('Common');
  const ta = useTranslations('A11y');
  const { locale, switchLocale } = useLocaleSwitch();

  // Member profile (birthday + colour). members is a prop that doesn't refetch
  // here, so saved values are mirrored into a local overlay for instant feedback.
  const [editMember, setEditMember] = useState(null);
  const [mBirthday, setMBirthday] = useState('');
  const [mColor, setMColor] = useState('');
  const [overrides, setOverrides] = useState({});
  const openMember = (m) => {
    const o = overrides[m.id] || {};
    setEditMember(m);
    setMBirthday(o.birthday ?? m.birthday ?? '');
    setMColor(o.color ?? m.color ?? '');
  };
  const saveMember = async () => {
    const patch = { birthday: mBirthday || null, color: mColor || null };
    setOverrides((prev) => ({ ...prev, [editMember.id]: patch }));
    setEditMember(null);
    const { error } = await supabase.from('household_members').update(patch).eq('id', editMember.id);
    if (error) notifyError('Errors.settingsSaveFailed');
  };
  const memberColor = (m) => overrides[m.id]?.color ?? m.color;

  return (
    <>
      <div className="mb-5 text-center">
        <div className="mb-2 text-5xl">🏠</div>
        <h2 className="mb-1 font-serif text-2xl font-semibold tracking-tight">{household.name}</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {t('signedInAs', { name: user.user_metadata?.full_name || user.email })}
        </p>
      </div>

      {/* LANGUAGE SWITCHER — labels stay in their native language on purpose */}
      <Segmented
        className="mb-3"
        value={locale}
        onChange={switchLocale}
        options={[
          { value: 'sl', label: '🇸🇮 Slovenščina' },
          { value: 'en', label: '🇬🇧 English' },
        ]}
      />

      {/* THEME SWITCHER */}
      <Segmented
        className="mb-5"
        value={theme}
        onChange={switchTheme}
        options={[
          { value: 'dark', label: t('themeDark') },
          { value: 'light', label: t('themeLight') },
        ]}
      />

      {/* Join code */}
      <div className="mb-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-center dark:border-white/10 dark:bg-stone-950/60">
        <div className="mb-1.5 text-xs font-bold tracking-[1px] text-orange-600 uppercase dark:text-orange-400">
          {t('inviteCode')}
        </div>
        <div className="text-4xl font-black tracking-[8px] text-stone-900 dark:text-stone-100">
          {household.join_code}
        </div>
        <div className="mt-1 text-xs text-stone-400 dark:text-stone-500">{t('shareCode')}</div>
      </div>

      {/* Members */}
      <div className="mb-5">
        <div className="mb-1 text-sm font-bold text-stone-500 dark:text-stone-400">
          {t('members')} ({members.length})
        </div>
        {members.map((m) => (
          <div key={m.id} className={ROW_FLAT}>
            <button
              onClick={() => openMember(m)}
              aria-label={t('editMember')}
              className={cx('flex flex-1 items-center gap-3 border-none bg-transparent p-0 text-left', PRESS_SM)}
            >
              <div className="relative">
                <Avatar name={m.display_name} />
                {memberColor(m) && (
                  <span
                    className={cx(
                      'absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white dark:border-stone-900',
                      memberColorClass(memberColor(m)),
                    )}
                  />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {m.display_name || tc('user')}
                </div>
                <div className="text-xs text-stone-400 dark:text-stone-500">
                  {m.role === 'owner' ? t('owner') : t('member')}
                </div>
              </div>
            </button>
            {m.user_id === user.id ? (
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">{t('you')}</span>
            ) : (
              members.find((x) => x.user_id === user.id)?.role === 'owner' && (
                <button
                  aria-label={ta('removeMember')}
                  onClick={() =>
                    setConfirmAction({
                      message: t('removeMember', { name: m.display_name || t('memberFallback') }),
                      onConfirm: async () => {
                        const { error } = await supabase.rpc('remove_household_member', { p_member_id: m.id });
                        if (error) notifyError(rpcErrorKey(error.message) ?? error.message);
                      },
                    })
                  }
                  className={cx(
                    'flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-none bg-red-500/10 text-red-600 dark:text-red-400',
                    PRESS_SM,
                  )}
                >
                  <X className="size-3.5" />
                </button>
              )
            )}
          </div>
        ))}
      </div>

      {/* Member profile editor */}
      <Modal open={!!editMember} onClose={() => setEditMember(null)}>
        {editMember && (
          <>
            <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              {editMember.display_name || tc('user')}
            </h3>
            <Label>{t('birthday')}</Label>
            <Input
              type="date"
              value={mBirthday || ''}
              onChange={(e) => setMBirthday(e.target.value)}
              className="mb-4"
            />
            <Label>{t('color')}</Label>
            <div className="mb-5 flex flex-wrap gap-2">
              {MEMBER_COLORS.map((mc) => (
                <button
                  key={mc.t}
                  aria-label={mc.t}
                  onClick={() => setMColor(mc.t)}
                  className={cx(
                    'size-8 cursor-pointer rounded-full border-2',
                    mc.c,
                    mColor === mc.t ? 'border-stone-900 dark:border-stone-100' : 'border-transparent',
                    PRESS_SM,
                  )}
                />
              ))}
            </div>
            <ModalActions onSave={saveMember} onCancel={() => setEditMember(null)} />
          </>
        )}
      </Modal>

      {/* Google Calendar */}
      <div className="mb-5">
        <div className="mb-2.5 text-sm font-bold text-stone-500 dark:text-stone-400">{t('googleCalendar')}</div>
        {calConnected ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-green-600/20 bg-green-600/8 px-3.5 py-3 dark:border-green-500/20 dark:bg-green-500/10">
            <div className="flex-1">
              <div className="text-sm font-bold text-green-700 dark:text-green-400">{t('connected')}</div>
              <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{calConnection?.google_email}</div>
            </div>
            <button
              onClick={() =>
                setConfirmAction({
                  message: t('disconnectConfirm'),
                  onConfirm: () => removeCalConnection(calConnection.id),
                })
              }
              className={cx(
                'cursor-pointer rounded-full border-none bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400',
                PRESS_SM,
              )}
            >
              {t('disconnect')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setShowSettings(false);
              connectCalendar();
            }}
            className={cx(
              'w-full cursor-pointer rounded-full border-none bg-stone-900 p-3.5 text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900',
              PRESS,
            )}
          >
            {t('connectCalendar')}
          </button>
        )}
      </div>

      {/* Notifications */}
      <div className="mb-5">
        <div className="mb-2.5 text-sm font-bold text-stone-500 dark:text-stone-400">{t('notifications')}</div>
        {push.needsInstall ? (
          <p className="text-xs text-stone-400 dark:text-stone-500">{t('notificationsIosHint')}</p>
        ) : !push.supported ? (
          <p className="text-xs text-stone-400 dark:text-stone-500">{t('notificationsUnsupported')}</p>
        ) : push.permission === 'denied' ? (
          <p className="text-xs text-stone-400 dark:text-stone-500">{t('notificationsDenied')}</p>
        ) : push.subscribed ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-green-600/20 bg-green-600/8 px-3.5 py-3 dark:border-green-500/20 dark:bg-green-500/10">
            <div className="flex-1 text-sm font-bold text-green-700 dark:text-green-400">
              {t('notificationsEnabled')}
            </div>
            <button
              onClick={push.disable}
              disabled={push.busy}
              className={cx(
                PRESS_SM,
                'cursor-pointer rounded-full border-none bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400',
              )}
            >
              {t('notificationsDisable')}
            </button>
          </div>
        ) : (
          <button
            onClick={push.enable}
            disabled={push.busy}
            className={cx(
              PRESS,
              'w-full cursor-pointer rounded-full border-none bg-stone-900 p-3.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900',
            )}
          >
            {t('notificationsEnable')}
          </button>
        )}
      </div>

      <button
        onClick={handleSignOut}
        className={cx(
          'w-full cursor-pointer rounded-full border border-red-500/25 bg-red-500/10 p-3.5 text-base font-bold text-red-600 dark:text-red-400',
          PRESS,
        )}
      >
        {tc('signOut')}
      </button>
    </>
  );
}
