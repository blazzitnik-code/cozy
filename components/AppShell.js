'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  useItems,
  useArchived,
  useFreezers,
  useCategories,
  useShoppingItems,
  useShoppingArchived,
  useShoppingFavourites,
  useShoppingStores,
  useShoppingSections,
  useCalendarConnections,
  useCalendarEvents,
  useFreebusySources,
  useBusyBlocks,
  useHomeDevices,
  useProviderConnection,
  useTodoLists,
  useTodoItems,
  useHomeSettings,
  usePushSubscription,
  useBoardNotes,
  useWeather,
} from '@/lib/hooks';
import { useTranslations, useFormatter } from 'next-intl';
import { useLocaleSwitch } from './IntlProvider';
import { rpcErrorKey } from '@/lib/intl';
import { supabase } from '@/lib/supabase';
import { cx, MEMBER_COLORS, memberColorClass, weatherLocationsOf } from '@/lib/utils';
import { X, Plus, Trash2, ChevronDown, ChevronUp, ChevronRight, Pencil, RefreshCw } from 'lucide-react';
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
  BackBtn,
  PRESS,
  PRESS_SM,
  ROW_FLAT,
} from './ui';
import { notifyError } from '@/lib/notify';
import TodoApp from './TodoApp';
import DevicesModule from './DevicesModule';
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
const VALID_TABS = ['home', 'freezer', 'shopping', 'calendar', 'todo', 'devices'];

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
    updatePurchaseAmount: dbUpdatePurchaseAmount,
  } = useShoppingArchived(householdId);
  const { favourites: shopFavourites, toggleFavourite: dbShopToggleFav } = useShoppingFavourites(householdId);
  const {
    stores: shopStores,
    addStore: dbAddStore,
    updateStore: dbUpdateStore,
    deleteStore: dbDeleteStore,
  } = useShoppingStores(householdId);
  const { sections: shopSections, reorderSections: dbReorderSections } = useShoppingSections(householdId);
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
    archived: boardArchived,
    loading: boardLoading,
    addNote: dbAddNote,
    updateNote: dbUpdateNote,
    markDone: dbMarkNoteDone,
    unarchiveNote: dbUnarchiveNote,
    deleteNote: dbDeleteNote,
  } = useBoardNotes(householdId);
  // The home card always shows the "main" (first) saved location; other
  // locations are fetched on demand inside the weather modal itself.
  const mainWeatherLoc = weatherLocationsOf(homeSettings)[0];
  const weather = useWeather(mainWeatherLoc.lat, mainWeatherLoc.lng);

  // ─── WEB PUSH ───
  // locale is needed here (not just in SettingsModal) because the
  // subscription row stores it for server-side notification language.
  const { locale: pushLocale } = useLocaleSwitch();
  const push = usePushSubscription(householdId, user.id, pushLocale);

  // ─── CALENDAR STATE (manual Koledarko; Google connect stays in settings for phase 2) ───
  const {
    connections: calConnections,
    myConnection: calConnection,
    isConnected: calConnected,
    loading: calConnLoading,
    saveConnection: saveCalConnection,
    removeConnection: removeCalConnection,
  } = useCalendarConnections(householdId, user.id);
  const {
    events: calEvents,
    loading: calEventsLoading,
    addEvent: addCalEvent,
    updateEvent: updateCalEvent,
    deleteEvent: deleteCalEvent,
    skipOccurrence: skipCalOccurrence,
  } = useCalendarEvents(householdId);

  // ─── FREEBUSY (Koledarko phase 2: ICS-sourced busy blocks) ───
  // Sources = own private ICS URLs (Settings). Busy blocks = the synced
  // result, household-wide, range-limited to what CalendarModule can show
  // (matches the edge function's WINDOW_DAYS — see supabase/functions/sync-freebusy).
  const {
    sources: freebusySources,
    loading: freebusySourcesLoading,
    addSource: addFreebusySource,
    removeSource: removeFreebusySource,
    updateSourceLabel: updateFreebusySourceLabel,
    syncNow: syncFreebusyNow,
    syncing: freebusySyncing,
  } = useFreebusySources(householdId, user.id);
  const busyBlocksRange = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 86_400_000);
    return { start: now.toISOString(), end: end.toISOString() };
  }, []);
  const { blocks: busyBlocks, loading: busyBlocksLoading } = useBusyBlocks(
    householdId,
    busyBlocksRange.start,
    busyBlocksRange.end,
  );

  // ─── NAPRAVE (home devices — Mitsubishi AC via MELCloud Home) ───
  const {
    devices: homeDevices,
    loading: homeDevicesLoading,
    sendCommand: sendDeviceCommand,
    refreshDevice,
  } = useHomeDevices(householdId);
  const {
    connection: melcloudConnection,
    loading: melcloudConnLoading,
    busy: melcloudBusy,
    connect: connectMelcloud,
    disconnect: disconnectMelcloud,
  } = useProviderConnection(householdId, 'melcloud_home');
  const {
    connection: vaillantConnection,
    loading: vaillantConnLoading,
    busy: vaillantBusy,
    connect: connectVaillant,
    disconnect: disconnectVaillant,
  } = useProviderConnection(householdId, 'vaillant');

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

  // ─── CALENDAR LOGIC (Google connect only; event sync is phase 2) ───
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
            await saveCalConnection({ accessToken: resp.access_token, expiresIn: resp.expires_in, email: info.email });
          },
        });
        // silent = no popup, uses existing Google browser session
        tokenClient.requestAccessToken(silent ? { prompt: '' } : {});
      };
      if (window.google?.accounts?.oauth2) {
        init();
      } else {
        // GSI is lazy-loaded (not in layout.js) — inject it on first use, or
        // attach to an in-flight injected tag instead of duplicating it.
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
  // Gate only on the global categories (a small, required table — the app is
  // misconfigured without them, see seed.sql). Per-table fetches (freezer
  // items, shopping, todos, calendar, board, weather) are NOT blocked here:
  // Home and the other tabs render immediately and fill in progressively as
  // each hook resolves, instead of the whole app waiting on one fetch.
  const hasCats = Object.keys(categories).length > 0;

  if (!hasCats) return <Loader />;

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
          melcloudConnection={melcloudConnection}
          melcloudBusy={melcloudBusy}
          connectMelcloud={connectMelcloud}
          disconnectMelcloud={disconnectMelcloud}
          vaillantConnection={vaillantConnection}
          vaillantBusy={vaillantBusy}
          connectVaillant={connectVaillant}
          disconnectVaillant={disconnectVaillant}
          freebusySources={freebusySources}
          freebusySourcesLoading={freebusySourcesLoading}
          addFreebusySource={addFreebusySource}
          removeFreebusySource={removeFreebusySource}
          updateFreebusySourceLabel={updateFreebusySourceLabel}
          syncFreebusyNow={syncFreebusyNow}
          freebusySyncing={freebusySyncing}
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
          todoListsLoading={todoListsLoading}
          todoItemsByList={todoItemsByList}
          calEvents={calEvents}
          homeSettings={homeSettings}
          homeSettingsLoading={homeSettingsLoading}
          saveHomeSettings={saveHomeSettings}
          boardNotes={boardNotes}
          boardArchived={boardArchived}
          boardLoading={boardLoading}
          addNote={dbAddNote}
          updateNote={dbUpdateNote}
          markNoteDone={dbMarkNoteDone}
          unarchiveNote={dbUnarchiveNote}
          deleteNote={dbDeleteNote}
          weather={weather}
          navigate={navigate}
          onOpenSettings={openSettings}
        />
      )}
      {mode === 'calendar' && (
        <CalendarModule
          user={user}
          members={members}
          events={calEvents}
          loading={calEventsLoading}
          addEvent={addCalEvent}
          updateEvent={updateCalEvent}
          deleteEvent={deleteCalEvent}
          skipOccurrence={skipCalOccurrence}
          busyBlocks={busyBlocks}
          busyBlocksLoading={busyBlocksLoading}
          onGoHome={() => navigate('home')}
          onOpenSettings={openSettings}
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
      {mode === 'devices' && (
        <DevicesModule
          devices={homeDevices}
          loading={homeDevicesLoading}
          sendCommand={sendDeviceCommand}
          refreshDevice={refreshDevice}
          connections={[melcloudConnection, vaillantConnection]}
          connectionsLoading={melcloudConnLoading || vaillantConnLoading}
          onGoHome={() => navigate('home')}
          onOpenSettings={openSettings}
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
          dbUpdatePurchaseAmount={dbUpdatePurchaseAmount}
          shopFavourites={shopFavourites}
          dbShopToggleFav={dbShopToggleFav}
          shopStores={shopStores}
          dbAddStore={dbAddStore}
          dbUpdateStore={dbUpdateStore}
          dbDeleteStore={dbDeleteStore}
          shopSections={shopSections}
          dbReorderSections={dbReorderSections}
          onGoHome={() => navigate('home')}
          onOpenSettings={openSettings}
        />
      )}
      {mode === 'freezer' && (
        <FreezerModule
          items={items}
          itemsLoading={itemsLoading}
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
// Household-level MELCloud Home connect/disconnect form — no OAuth popup is
// possible here (see providers/melcloud-home/index.js's header comment: the
// provider has no third-party app registration), so this collects the
// household's own MELCloud email+password once and posts it straight to
// /api/home-devices/connect, which performs the real Cognito login
// server-side and returns only success/failure — the password itself never
// comes back to the client and is never written to our DB.
function MelcloudConnectForm({ connection, busy, connect, disconnect, setConfirmAction, t, te }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const ERROR_KEYS = {
    invalid_credentials: 'melcloudInvalidCredentials',
    unavailable: 'melcloudUnavailable',
    reauth_needed: 'melcloudReauthNeeded',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const result = await connect(email, password);
    if (result.ok) {
      setEmail('');
      setPassword('');
    } else {
      const known = ERROR_KEYS[result.error];
      // Unmapped codes ('unknown', a raw HTTP failure, ...) have no good
      // translated copy — show the server's own message too so a real
      // MELCloud/Cognito failure is diagnosable from the UI itself instead
      // of requiring a trip through Vercel logs every time.
      const detail = !known && result.message ? ` (${result.message})` : '';
      setError(te(known || 'melcloudConnectFailed') + detail);
    }
  };

  const isConnected = connection?.status === 'connected';
  const needsReauth = connection?.status === 'error';

  if (isConnected) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-green-600/20 bg-green-600/8 px-3.5 py-3 dark:border-green-500/20 dark:bg-green-500/10">
        <div className="flex-1">
          <div className="text-sm font-bold text-green-700 dark:text-green-400">{t('connected')}</div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{connection?.account_email}</div>
        </div>
        <button
          onClick={() =>
            setConfirmAction({
              message: t('melcloudDisconnectConfirm'),
              onConfirm: () => disconnect(),
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
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      {needsReauth && (
        <div className="rounded-xl border border-amber-600/20 bg-amber-600/8 px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          {t('melcloudNeedsReauth')}
        </div>
      )}
      <div>
        <Label>{t('melcloudEmailLabel')}</Label>
        <Input
          type="email"
          size="xs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('melcloudEmailPlaceholder')}
          required
          autoComplete="username"
        />
      </div>
      <div>
        <Label>{t('melcloudPasswordLabel')}</Label>
        <Input
          type="password"
          size="xs"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('melcloudPasswordPlaceholder')}
          required
          autoComplete="current-password"
        />
      </div>
      {error && <div className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</div>}
      <p className="text-xs text-stone-400 dark:text-stone-500">{t('melcloudHelp')}</p>
      <button
        type="submit"
        disabled={busy}
        className={cx(
          'w-full cursor-pointer rounded-full border-none bg-stone-900 p-3.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900',
          PRESS,
        )}
      >
        {busy ? t('melcloudConnecting') : t('connectMelcloud')}
      </button>
    </form>
  );
}

// Household-level Vaillant (myVAILLANT) connect/disconnect form — same
// shape as MelcloudConnectForm above (see providers/vaillant/index.js's
// header comment: myVAILLANT has no third-party OAuth app registration
// either), just against /api/home-devices/connect with provider:'vaillant'.
function VaillantConnectForm({ connection, busy, connect, disconnect, setConfirmAction, t, te }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const ERROR_KEYS = {
    invalid_credentials: 'vaillantInvalidCredentials',
    unavailable: 'vaillantUnavailable',
    reauth_needed: 'vaillantReauthNeeded',
    unsupported_controller: 'vaillantUnsupportedController',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const result = await connect(email, password);
    if (result.ok) {
      setEmail('');
      setPassword('');
    } else {
      const known = ERROR_KEYS[result.error];
      const detail = !known && result.message ? ` (${result.message})` : '';
      setError(te(known || 'vaillantConnectFailed') + detail);
    }
  };

  const isConnected = connection?.status === 'connected';
  const needsReauth = connection?.status === 'error';

  if (isConnected) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-green-600/20 bg-green-600/8 px-3.5 py-3 dark:border-green-500/20 dark:bg-green-500/10">
        <div className="flex-1">
          <div className="text-sm font-bold text-green-700 dark:text-green-400">{t('connected')}</div>
          <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{connection?.account_email}</div>
        </div>
        <button
          onClick={() =>
            setConfirmAction({
              message: t('vaillantDisconnectConfirm'),
              onConfirm: () => disconnect(),
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
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      {needsReauth && (
        <div className="rounded-xl border border-amber-600/20 bg-amber-600/8 px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          {t('vaillantNeedsReauth')}
        </div>
      )}
      <div>
        <Label>{t('vaillantEmailLabel')}</Label>
        <Input
          type="email"
          size="xs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('vaillantEmailPlaceholder')}
          required
          autoComplete="username"
        />
      </div>
      <div>
        <Label>{t('vaillantPasswordLabel')}</Label>
        <Input
          type="password"
          size="xs"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('vaillantPasswordPlaceholder')}
          required
          autoComplete="current-password"
        />
      </div>
      {error && <div className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</div>}
      <p className="text-xs text-stone-400 dark:text-stone-500">{t('vaillantHelp')}</p>
      <button
        type="submit"
        disabled={busy}
        className={cx(
          'w-full cursor-pointer rounded-full border-none bg-stone-900 p-3.5 text-sm font-bold text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900',
          PRESS,
        )}
      >
        {busy ? t('vaillantConnecting') : t('connectVaillant')}
      </button>
    </form>
  );
}

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
  melcloudConnection,
  melcloudBusy,
  connectMelcloud,
  disconnectMelcloud,
  vaillantConnection,
  vaillantBusy,
  connectVaillant,
  disconnectVaillant,
  freebusySources,
  freebusySourcesLoading,
  addFreebusySource,
  removeFreebusySource,
  updateFreebusySourceLabel,
  syncFreebusyNow,
  freebusySyncing,
  setShowSettings,
  setConfirmAction,
  handleSignOut,
}) {
  const t = useTranslations('Settings');
  const tc = useTranslations('Common');
  const ta = useTranslations('A11y');
  const te = useTranslations('Errors');
  const format = useFormatter();
  const { locale, switchLocale } = useLocaleSwitch();

  // Freebusy ICS source form — add/collapse state lives here, not in a hook,
  // since it's pure UI state scoped to this modal render.
  const [showFreebusyForm, setShowFreebusyForm] = useState(false);
  const [showFreebusyHelp, setShowFreebusyHelp] = useState(false);
  const [fbLabel, setFbLabel] = useState('');
  const [fbUrl, setFbUrl] = useState('');
  const [fbSaving, setFbSaving] = useState(false);
  const saveFreebusySource = async () => {
    if (!fbUrl.trim()) return;
    setFbSaving(true);
    await addFreebusySource({ label: fbLabel.trim(), icsUrl: fbUrl.trim() });
    setFbSaving(false);
    setFbLabel('');
    setFbUrl('');
    setShowFreebusyForm(false);
  };

  // Rename an existing freebusy source (label only — the ICS URL itself is
  // immutable once added, matching cozy's "delete + re-add" pattern for
  // anything more than a rename).
  const [editFreebusySource, setEditFreebusySource] = useState(null);
  const [efLabel, setEfLabel] = useState('');
  const saveFreebusyLabel = async () => {
    await updateFreebusySourceLabel(editFreebusySource.id, efLabel.trim());
    setEditFreebusySource(null);
  };

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
  const [showConnections, setShowConnections] = useState(false);

  return (
    <>
      {!showConnections && (
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

          <div className="mb-5">
            <button
              onClick={() => setShowConnections(true)}
              className={cx(ROW_FLAT, 'w-full cursor-pointer border-none bg-transparent p-0 text-left', PRESS_SM)}
            >
              <div className="flex-1">
                <div className="text-sm font-bold text-stone-900 dark:text-stone-100">{t('connectionsRow')}</div>
                <div className="text-xs text-stone-400 dark:text-stone-500">{t('connectionsRowHint')}</div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-stone-400 dark:text-stone-600" />
            </button>
          </div>
        </>
      )}

      {showConnections && (
        <>
          <div className="mb-5 flex items-center gap-3 pt-1">
            <BackBtn onClick={() => setShowConnections(false)} />
            <h2 className="font-serif text-2xl font-semibold tracking-tight">{t('connectionsTitle')}</h2>
          </div>

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

          {/* Naprave / MELCloud Home — household-shared, no owner/member split
          (see providers/melcloud-home + the provider_connections migration) */}
          <div className="mb-5">
            <div className="mb-2.5 text-sm font-bold text-stone-500 dark:text-stone-400">
              {t('devicesSectionTitle')}
            </div>
            <MelcloudConnectForm
              connection={melcloudConnection}
              busy={melcloudBusy}
              connect={connectMelcloud}
              disconnect={disconnectMelcloud}
              setConfirmAction={setConfirmAction}
              t={t}
              te={te}
            />
          </div>

          {/* Naprave / Vaillant myVAILLANT — same shape as MELCloud above,
          see providers/vaillant + the provider_connections migration */}
          <div className="mb-5">
            <div className="mb-2.5 text-sm font-bold text-stone-500 dark:text-stone-400">
              {t('vaillantSectionTitle')}
            </div>
            <VaillantConnectForm
              connection={vaillantConnection}
              busy={vaillantBusy}
              connect={connectVaillant}
              disconnect={disconnectVaillant}
              setConfirmAction={setConfirmAction}
              t={t}
              te={te}
            />
          </div>

          {/* Freebusy sharing (Koledarko phase 2) */}
          <div className="mb-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="text-sm font-bold text-stone-500 dark:text-stone-400">{t('freebusyTitle')}</div>
              <button
                onClick={syncFreebusyNow}
                disabled={freebusySyncing}
                className={cx(
                  'flex cursor-pointer items-center gap-1.5 rounded-full border-none bg-stone-900/5 px-3 py-1.5 text-xs font-semibold text-stone-600 disabled:opacity-50 dark:bg-white/10 dark:text-stone-300',
                  PRESS_SM,
                )}
              >
                <RefreshCw className={cx('size-3.5', freebusySyncing && 'animate-spin')} />
                {t('syncNow')}
              </button>
            </div>
            <p className="mb-2.5 text-xs text-stone-400 dark:text-stone-500">{t('freebusyDescription')}</p>

            {!freebusySourcesLoading && freebusySources.length > 0 && (
              <div className="mb-2.5 space-y-2">
                {freebusySources.map((src) => (
                  <div
                    key={src.id}
                    className="flex items-center gap-2.5 rounded-xl border border-stone-200/70 bg-white px-3.5 py-3 dark:border-white/10 dark:bg-stone-900"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold">{src.label || t('icsSource')}</div>
                      <div className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                        {src.last_error
                          ? t('freebusyError', { error: src.last_error })
                          : src.last_synced_at
                            ? t('freebusySyncedAt', {
                                date: format.dateTime(new Date(src.last_synced_at), 'dayShort'),
                                time: format.dateTime(new Date(src.last_synced_at), 'time'),
                              })
                            : t('freebusyNotSyncedYet')}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditFreebusySource(src);
                        setEfLabel(src.label || '');
                      }}
                      aria-label={ta('edit')}
                      className={cx(
                        'cursor-pointer rounded-full border-none bg-stone-900/5 p-2 text-stone-600 dark:bg-white/10 dark:text-stone-300',
                        PRESS_SM,
                      )}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => removeFreebusySource(src.id)}
                      aria-label={ta('remove')}
                      className={cx(
                        'cursor-pointer rounded-full border-none bg-red-500/10 p-2 text-red-600 dark:text-red-400',
                        PRESS_SM,
                      )}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showFreebusyForm ? (
              <div className="rounded-xl border border-stone-200/70 bg-white p-3.5 dark:border-white/10 dark:bg-stone-900">
                <Label>{t('freebusyLabel')}</Label>
                <Input
                  size="xs"
                  className="mb-2.5"
                  value={fbLabel}
                  onChange={(e) => setFbLabel(e.target.value)}
                  placeholder={t('freebusyLabelPlaceholder')}
                />
                <Label>{t('icsAddress')}</Label>
                <Input
                  size="xs"
                  className="mb-3"
                  value={fbUrl}
                  onChange={(e) => setFbUrl(e.target.value)}
                  placeholder="https://…"
                  inputMode="url"
                />
                <ModalActions
                  onSave={saveFreebusySource}
                  onCancel={() => {
                    setShowFreebusyForm(false);
                    setFbLabel('');
                    setFbUrl('');
                  }}
                  disabled={!fbUrl.trim() || fbSaving}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowFreebusyForm(true)}
                className={cx(
                  'flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-stone-300 bg-transparent p-3 text-sm font-bold text-stone-700 dark:border-stone-700 dark:text-stone-300',
                  PRESS,
                )}
              >
                <Plus size={16} />
                {t('addFreebusySource')}
              </button>
            )}

            <button
              onClick={() => setShowFreebusyHelp((v) => !v)}
              className="mt-2.5 flex items-center gap-1 text-xs font-semibold text-stone-500 dark:text-stone-400"
            >
              {showFreebusyHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {t('freebusyHelpToggle')}
            </button>
            {showFreebusyHelp && (
              <div className="mt-2 space-y-1.5 rounded-xl bg-stone-100 p-3 text-xs text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                <p>{t('freebusyHelpGoogle')}</p>
                <p>{t('freebusyHelpOutlook')}</p>
              </div>
            )}
          </div>

          {/* Rename a freebusy source (label only) */}
          <Modal open={!!editFreebusySource} onClose={() => setEditFreebusySource(null)}>
            {editFreebusySource && (
              <>
                <h3 className="mb-4 font-serif text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
                  {t('renameFreebusySource')}
                </h3>
                <Label>{t('freebusyLabel')}</Label>
                <Input
                  className="mb-4"
                  value={efLabel}
                  onChange={(e) => setEfLabel(e.target.value)}
                  placeholder={t('freebusyLabelPlaceholder')}
                  autoFocus
                />
                <ModalActions onSave={saveFreebusyLabel} onCancel={() => setEditFreebusySource(null)} />
              </>
            )}
          </Modal>
        </>
      )}

      {!showConnections && (
        <>
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
      )}
    </>
  );
}
