'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useItems, useArchived, useFreezers, useCategories, useShoppingItems, useShoppingArchived, useShoppingFavourites, useShoppingStores, useCalendarConnections, useCalendarEvents, useTodoLists } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { getStyles } from '@/lib/styles';
import { localDateStr } from '@/lib/utils';
import { Modal, ConfirmModal, BottomNav, Toaster, Loader, Segmented, Avatar } from './ui';
import { notifyError } from '@/lib/notify';
import TodoApp from './TodoApp';
import HomeScreen from './HomeScreen';
import FreezerModule from './FreezerModule';
import ShoppingModule from './ShoppingModule';
import CalendarModule from './CalendarModule';

// ═══════════════════════════
// APP SHELL
// Owns all Supabase hooks, mode/lang/theme, calendar connection
// orchestration and the settings modal; modules get data via props.
// ═══════════════════════════
export default function AppShell({ user, household, members, signOut }) {
  const householdId = household?.id;

  // ─── MODE: home | freezer | shopping | calendar | todo ───
  const [mode, setMode] = useState("home");

  // ─── LANGUAGE ───
  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('zmrzko_lang') || 'sl';
    return 'sl';
  });
  const t = useT(lang);
  const switchLang = (l) => { setLang(l); localStorage.setItem('zmrzko_lang', l); };

  // ─── THEME ───
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('zmrzko_theme') || 'dark';
    return 'dark';
  });
  const switchTheme = (th) => { setTheme(th); localStorage.setItem('zmrzko_theme', th); document.documentElement.dataset.theme = th; };
  const isDark = theme === 'dark';
  const st = getStyles(isDark);

  // ─── SUPABASE HOOKS (household-scoped) ───
  const { items, loading: itemsLoading, addItem: dbAddItem, updateItem: dbUpdateItem, deleteItem: dbDeleteItem } = useItems(householdId);
  const { archived, archiveItem: dbArchiveItem, updateArchived: dbUpdateArchived, deleteArchived: dbDeleteArchived, unarchiveItem: dbUnarchiveItem } = useArchived(householdId);
  const { freezers, addFreezer: dbAddFreezer } = useFreezers(householdId);
  const { categories } = useCategories(householdId);
  const { items: shopItems, addItem: dbShopAdd, updateItem: dbShopUpdate, deleteItem: dbShopDelete } = useShoppingItems(householdId);
  const { archived: shopArchive, archiveChecked: dbShopArchiveChecked } = useShoppingArchived(householdId);
  const { favourites: shopFavourites, toggleFavourite: dbShopToggleFav } = useShoppingFavourites(householdId);
  const { stores: shopStores, addStore: dbAddStore, updateStore: dbUpdateStore, deleteStore: dbDeleteStore } = useShoppingStores(householdId);
  const { lists: todoLists } = useTodoLists(householdId);

  // ─── CALENDAR STATE ───
  const [calDate, setCalDate] = useState(new Date());
  const [calLoading, setCalLoading] = useState(false);
  const { connections: calConnections, myConnection: calConnection, isConnected: calConnected, saveConnection: saveCalConnection, removeConnection: removeCalConnection, saveEvents: saveCalEvents } = useCalendarConnections(householdId, user.id);
  const calDateStr = localDateStr(calDate);
  const todayStr = useMemo(() => localDateStr(), []);
  const { events: allCalEvents, refetch: refetchCalEvents } = useCalendarEvents(householdId, calDateStr);
  const { events: todayCalEvents, updateEvent: updateCalEvent } = useCalendarEvents(householdId, todayStr);
  const [myFetchedEvents, setMyFetchedEvents] = useState([]);

  // ─── SETTINGS ───
  const [showSettings, setShowSettings] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // { message, onConfirm }

  // ─── NAVIGATION ───
  const navigate = useCallback((tab) => setMode(tab), []);
  const openSettings = useCallback(() => setShowSettings(true), []);

  // ─── CALENDAR LOGIC ───
  const fetchCalEvents = useCallback(async (date, token) => {
    if (!token) return;
    setCalLoading(true);
    try {
      const dateStr = date instanceof Date ? localDateStr(date) : date;
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${start.toISOString()}&timeMax=${end.toISOString()}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setMyFetchedEvents(items); // show immediately, no DB dependency
        await saveCalEvents(items, dateStr); // save for partner to see
        refetchCalEvents();
      }
    } catch (e) { console.error('Calendar fetch error:', e); }
    setCalLoading(false);
  }, [saveCalEvents]);

  useEffect(() => {
    setMyFetchedEvents([]);
    if (mode === 'calendar' && calConnected && calConnection?.access_token) {
      fetchCalEvents(calDate, calConnection.access_token);
    }
  }, [mode, calDate, calConnected, calConnection?.access_token, fetchCalEvents]);

  // Sync today's events once per session for home screen display
  const homeSyncDone = useRef(false);
  useEffect(() => {
    if (calConnected && calConnection?.access_token && !homeSyncDone.current) {
      homeSyncDone.current = true;
      fetchCalEvents(new Date(), calConnection.access_token);
    }
  }, [calConnected, calConnection?.access_token, fetchCalEvents]);

  const connectCalendar = useCallback((silent = false) => {
    const init = () => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: async (resp) => {
          if (resp.error || !resp.access_token) return;
          const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          }).then(r => r.json());
          await saveCalConnection({ accessToken: resp.access_token, expiresIn: resp.expires_in, email: info.email });
        },
      });
      // silent = no popup, uses existing Google browser session
      tokenClient.requestAccessToken(silent ? { prompt: '' } : {});
    };
    if (window.google?.accounts?.oauth2) { init(); }
    else {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = init;
      document.head.appendChild(s);
    }
  }, [saveCalConnection]);

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

  function SettingsModal() {
    if (!showSettings) return null;
    return (
      <Modal onClose={() => setShowSettings(false)}>
        <div className="text-center mb-5">
          <div className="text-48 mb-2">🏠</div>
          <h2 className="text-20 font-extrabold mb-1">{household.name}</h2>
          <p className="text-ink-3 text-13">Prijavljen kot {user.user_metadata?.full_name || user.email}</p>
        </div>

        {/* LANGUAGE SWITCHER */}
        <Segmented
          className="mb-3" value={lang} onChange={switchLang}
          options={[{ value: 'sl', label: '🇸🇮 Slovenščina' }, { value: 'en', label: '🇬🇧 English' }]}
        />

        {/* THEME SWITCHER */}
        <Segmented
          className="mb-5" tone="indigo" value={theme} onChange={switchTheme}
          options={[{ value: 'dark', label: '🌙 Temna' }, { value: 'light', label: '☀️ Svetla' }]}
        />

        {/* Join code */}
        <div className="p-4 bg-accent/6 border border-accent/20 rounded-14 mb-4 text-center">
          <div className="text-11 text-accent uppercase tracking-[1px] font-bold mb-1.5">{t('kodaZaPovabilo')}</div>
          <div className="text-32 font-black tracking-[8px] text-ink">{household.join_code}</div>
          <div className="text-12 text-ink-dim mt-1">Deli to kodo z družino ali partnerjem</div>
        </div>

        {/* Members */}
        <div className="mb-5">
          <div className="text-13 font-bold text-ink-2 mb-2">{t('člani')} ({members.length})</div>
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-2.5 py-2.5 px-3 bg-surface-2 rounded-12 mb-1 border border-line">
              <Avatar name={m.display_name} />
              <div className="flex-1">
                <div className="text-14 font-semibold text-ink">{m.display_name || "Uporabnik"}</div>
                <div className="text-11 text-ink-dim">{m.role === "owner" ? t('lastnik') : t('član')}</div>
              </div>
              {m.user_id === user.id
                ? <span className="text-11 text-accent font-semibold">Ti</span>
                : members.find(x => x.user_id === user.id)?.role === "owner" && (
                  <button onClick={() => setConfirmAction({
                    message: `Odstrani ${m.display_name || "člana"} iz gospodinjstva?`,
                    onConfirm: async () => {
                      const { error } = await supabase.rpc('remove_household_member', { p_member_id: m.id });
                      if (error) notifyError(error.message);
                    },
                  })} className="w-7 h-7 rounded-8 bg-danger/12 border border-danger/20 text-danger text-14 cursor-pointer flex items-center justify-center">✕</button>
                )
              }
            </div>
          ))}
        </div>

        {/* Google Calendar */}
        <div className="mb-5">
          <div className="text-13 font-bold text-ink-2 mb-2.5">📅 Google Koledar</div>
          {calConnected ? (
            <div className="flex items-center gap-2.5 py-3 px-3.5 bg-success/6 border border-success/20 rounded-14">
              <div className="flex-1">
                <div className="text-13 font-bold text-success">✓ Povezan</div>
                <div className="text-11 text-ink-3 mt-0.5">{calConnection?.google_email}</div>
              </div>
              <button onClick={() => setConfirmAction({ message: "Odklopi Google Koledar?", onConfirm: () => removeCalConnection(calConnection.id) })} className="text-12 text-danger bg-danger/8 border border-danger/20 rounded-10 py-1.5 px-2.5 cursor-pointer font-semibold">Odklopi</button>
            </div>
          ) : (
            <button onClick={() => { setShowSettings(false); connectCalendar(); }} className="w-full p-3.5 rounded-14 border border-accent-2/30 bg-accent-2/8 text-accent-3 text-14 font-bold cursor-pointer">
              📅 Poveži Google Koledar
            </button>
          )}
        </div>

        <button onClick={signOut} className="w-full p-3.5 rounded-14 border border-danger/20 bg-danger/5 text-danger text-15 font-bold cursor-pointer">{t('odjava')}</button>
      </Modal>
    );
  }

  // ─── SHELL CHROME (nav + settings + settings-confirm), rendered once per mode ───
  const chrome = (
    <>
      <BottomNav mode={mode} onNavigate={navigate} />
      <SettingsModal />
      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} />
      <Toaster />
    </>
  );

  if (mode === "home") {
    return (
      <>
        <HomeScreen
          user={user} householdId={householdId}
          items={items} shopItems={shopItems} todoLists={todoLists}
          todayCalEvents={todayCalEvents} calConnected={calConnected}
          navigate={navigate} onOpenSettings={openSettings}
        />
        {chrome}
      </>
    );
  }

  if (mode === "calendar") {
    return (
      <>
        <CalendarModule
          user={user}
          calDate={calDate} setCalDate={setCalDate}
          calConnections={calConnections} calConnection={calConnection} calConnected={calConnected}
          connectCalendar={connectCalendar} calLoading={calLoading}
          myFetchedEvents={myFetchedEvents} allCalEvents={allCalEvents}
          updateCalEvent={updateCalEvent} onOpenSettings={openSettings}
        />
        {chrome}
      </>
    );
  }

  if (mode === "todo") {
    return (
      <div className="relative">
        <TodoApp user={user} householdId={householdId} members={members} lang={lang} />
        <BottomNav mode={mode} onNavigate={navigate} />
        <Toaster />
      </div>
    );
  }

  if (mode === "shopping") {
    return (
      <>
        <ShoppingModule
          shopItems={shopItems} dbShopAdd={dbShopAdd} dbShopUpdate={dbShopUpdate} dbShopDelete={dbShopDelete}
          shopArchive={shopArchive} dbShopArchiveChecked={dbShopArchiveChecked}
          shopFavourites={shopFavourites} dbShopToggleFav={dbShopToggleFav}
          shopStores={shopStores} dbAddStore={dbAddStore} dbUpdateStore={dbUpdateStore} dbDeleteStore={dbDeleteStore}
          onToggleMode={() => setMode("freezer")} onOpenSettings={openSettings}
        />
        {chrome}
      </>
    );
  }

  // ─── FREEZER (default mode) ───
  return (
    <>
      <FreezerModule
        isDark={isDark} st={st} lang={lang}
        items={items} dbAddItem={dbAddItem} dbUpdateItem={dbUpdateItem} dbDeleteItem={dbDeleteItem}
        archived={archived} dbArchiveItem={dbArchiveItem} dbUpdateArchived={dbUpdateArchived} dbDeleteArchived={dbDeleteArchived} dbUnarchiveItem={dbUnarchiveItem}
        freezers={freezers} dbAddFreezer={dbAddFreezer} categories={categories}
        onToggleMode={() => setMode("shopping")} onOpenSettings={openSettings}
      />
      {chrome}
    </>
  );
}
