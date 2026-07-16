'use client';
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useItems, useArchived, useFreezers, useCategories, useShoppingItems, useShoppingArchived, useShoppingFavourites, useShoppingStores, useCalendarConnections, useCalendarEvents, useTodoLists } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { getStyles, A } from '@/lib/styles';
import { Modal, ConfirmModal, BottomNav } from './ui';
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
export default function ZmrzkoApp({ user, household, members, signOut }) {
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
  const switchTheme = (th) => { setTheme(th); localStorage.setItem('zmrzko_theme', th); };
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
  const calDateStr = calDate.toISOString().split('T')[0];
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
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
      const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
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

  if (itemsLoading || !hasCats) {
    return (
      <div style={{ ...A, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            <span style={{ background: "linear-gradient(135deg,#E2E8F0,#C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cožy</span>
          </div>
          <div style={{ color: "#475569", marginTop: 8, fontSize: 14 }}>Nalagam...</div>
        </div>
      </div>
    );
  }

  function SettingsModal() {
    if (!showSettings) return null;
    return (
      <Modal isDark={isDark} onClose={() => setShowSettings(false)}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏠</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>{household.name}</h2>
          <p style={{ color: "#64748B", fontSize: 13, margin: 0 }}>Prijavljen kot {user.user_metadata?.full_name || user.email}</p>
        </div>

        {/* LANGUAGE SWITCHER */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {['sl', 'en'].map(l => (
            <button key={l} onClick={() => switchLang(l)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1px solid " + (lang === l ? "rgba(56,189,248,0.5)" : isDark ? "rgba(71,85,105,0.3)" : "rgba(99,102,241,0.2)"), background: lang === l ? "rgba(56,189,248,0.12)" : isDark ? "rgba(30,41,59,0.6)" : "rgba(255,255,255,0.8)", color: lang === l ? "#38BDF8" : isDark ? "#94A3B8" : "#64748B", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {l === 'sl' ? '🇸🇮 Slovenščina' : '🇬🇧 English'}
            </button>
          ))}
        </div>

        {/* THEME SWITCHER */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[['dark', '🌙 Temna'], ['light', '☀️ Svetla']].map(([th, label]) => (
            <button key={th} onClick={() => switchTheme(th)} style={{ flex: 1, padding: "10px", borderRadius: 12, border: "1px solid " + (theme === th ? "rgba(99,102,241,0.5)" : isDark ? "rgba(71,85,105,0.3)" : "rgba(99,102,241,0.2)"), background: theme === th ? "rgba(99,102,241,0.15)" : isDark ? "rgba(30,41,59,0.6)" : "rgba(255,255,255,0.8)", color: theme === th ? "#818CF8" : isDark ? "#94A3B8" : "#64748B", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Join code */}
        <div style={{ padding: "16px", background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", borderRadius: 14, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#38BDF8", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700, marginBottom: 6 }}>{t('kodaZaPovabilo')}</div>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 8, color: "#E2E8F0" }}>{household.join_code}</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Deli to kodo z družino ali partnerjem</div>
        </div>

        {/* Members */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 8 }}>{t('člani')} ({members.length})</div>
          {members.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(30,41,59,0.4)", borderRadius: 12, marginBottom: 4, border: "1px solid rgba(71,85,105,0.15)" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#0EA5E9,#6366F1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff" }}>
                {(m.display_name || "?")[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0" }}>{m.display_name || "Uporabnik"}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{m.role === "owner" ? t('lastnik') : t('član')}</div>
              </div>
              {m.user_id === user.id
                ? <span style={{ fontSize: 11, color: "#38BDF8", fontWeight: 600 }}>Ti</span>
                : members.find(x => x.user_id === user.id)?.role === "owner" && (
                  <button onClick={() => setConfirmAction({
                    message: `Odstrani ${m.display_name || "člana"} iz gospodinjstva?`,
                    onConfirm: async () => {
                      const { error } = await supabase.rpc('remove_household_member', { p_member_id: m.id });
                      if (error) alert('Napaka: ' + error.message);
                    },
                  })} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                )
              }
            </div>
          ))}
        </div>

        {/* Google Calendar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", marginBottom: 10 }}>📅 Google Koledar</div>
          {calConnected ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>✓ Povezan</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{calConnection?.google_email}</div>
              </div>
              <button onClick={() => setConfirmAction({ message: "Odklopi Google Koledar?", onConfirm: () => removeCalConnection(calConnection.id) })} style={{ fontSize: 12, color: "#EF4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", fontWeight: 600 }}>Odklopi</button>
            </div>
          ) : (
            <button onClick={() => { setShowSettings(false); connectCalendar(); }} style={{ width: "100%", padding: "14px", borderRadius: 14, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#818CF8", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              📅 Poveži Google Koledar
            </button>
          )}
        </div>

        <button onClick={signOut} style={{
          width: "100%", padding: "14px", borderRadius: 14, border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.05)", color: "#EF4444", fontSize: 15, fontWeight: 700,
          cursor: "pointer",
        }}>{t('odjava')}</button>
      </Modal>
    );
  }

  // ─── SHELL CHROME (nav + settings + settings-confirm), rendered once per mode ───
  const chrome = (
    <>
      <BottomNav mode={mode} onNavigate={navigate} />
      <SettingsModal />
      <ConfirmModal action={confirmAction} onClose={() => setConfirmAction(null)} isDark={isDark} />
    </>
  );

  if (mode === "home") {
    return (
      <>
        <HomeScreen
          user={user} householdId={householdId} isDark={isDark} st={st}
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
          user={user} isDark={isDark} st={st}
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
      <div style={{ position: "relative" }}>
        <TodoApp user={user} householdId={householdId} members={members} lang={lang} isDark={isDark} />
        <BottomNav mode={mode} onNavigate={navigate} />
      </div>
    );
  }

  if (mode === "shopping") {
    return (
      <>
        <ShoppingModule
          isDark={isDark} st={st}
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
