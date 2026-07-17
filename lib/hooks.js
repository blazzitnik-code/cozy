'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabase';
import { notifyError } from './notify';

// Reports failed writes to the user via toast (see <Toaster /> in ui.js).
// `msg` is an Errors.* message key — Toaster translates it at render time.
// Returns whether the write succeeded — two-step "moves" (insert then delete)
// must abort the delete when the insert failed, or the row is lost.
// Reads keep their per-hook handling.
const run = async (query, msg) => {
  const { error } = await query;
  if (error) {
    console.error(msg, error);
    notifyError(msg);
  }
  return !error;
};

// ─── SEARCH NORMALIZATION ───
export const normalizujNiz = (niz) => {
  if (!niz) return '';
  return niz
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[šŝ]/g, 's')
    .replace(/[čć]/g, 'c')
    .replace(/[žź]/g, 'z');
};

// ─── AUTH ───
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = typeof window !== 'undefined' ? window.location.origin : '';
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    });
  };

  // Dev-only path for LAN-device testing (Google OAuth can't round-trip to a
  // private-IP local stack); the login form gates itself on NODE_ENV.
  const signInWithPassword = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signInWithGoogle, signInWithPassword, signOut };
}

// ─── HOUSEHOLD ───
export function useHousehold(user) {
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  // Which user the current household/members state was resolved for:
  // undefined until the first fetch settles, then user.id or null.
  const [fetchedFor, setFetchedFor] = useState();
  const retryTimer = useRef(null);

  const fetch = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setFetchedFor(null);
      return;
    }

    // One embedded select instead of three sequential round trips; RLS
    // (is_household_member) scopes both tables to the user's household.
    const { data, error } = await supabase
      .from('households')
      .select('id, name, join_code, household_members(*)')
      .limit(1)
      .maybeSingle();

    // A transient fetch error must not read as "no household" — page.js would
    // flash the create-household screen for an existing member. Stay loading
    // (fetchedFor untouched) and retry.
    if (error) {
      console.error('household fetch failed', error);
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(fetch, 4000);
      return;
    }

    if (data) {
      const { household_members: allMembers, ...hh } = data;
      setHousehold(hh);
      setMembers(allMembers ?? []);
    } else {
      setHousehold(null);
    }
    setFetchedFor(user.id);
  }, [user]);

  // Derived during render, not stored: the hook first runs with user=null
  // (auth still resolving) and a stored flag would report loading=false for
  // one frame after the user arrives (effects run post-paint) — page.js
  // would flash the create-household screen while the query is in flight.
  const loading = fetchedFor === undefined || fetchedFor !== (user?.id ?? null);

  useEffect(() => {
    fetch();
    return () => clearTimeout(retryTimer.current);
  }, [fetch]);

  const createHousehold = async (name, displayName) => {
    const { data, error } = await supabase.rpc('create_household', {
      p_name: name,
      p_user_id: user.id,
      p_display_name: displayName,
    });
    if (error) throw error;
    await fetch();
    return data;
  };

  const joinHousehold = async (code, displayName) => {
    const { data, error } = await supabase.rpc('join_household', {
      p_code: code.toUpperCase(),
      p_user_id: user.id,
      p_display_name: displayName,
    });
    if (error) throw error;
    await fetch();
    return data;
  };

  return { household, members, loading, createHousehold, joinHousehold, refetch: fetch };
}

// ─── GENERIC HOUSEHOLD-SCOPED TABLE HOOK ───
function useHouseholdTable(tableName, householdId, orderBy, ascending) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    const { data: rows } = await supabase
      .from(tableName)
      .select('*')
      .eq('household_id', householdId)
      .order(orderBy, { ascending });
    if (rows) setData(rows);
    setLoading(false);
  }, [householdId, tableName, orderBy, ascending]);

  useEffect(() => {
    fetch();
    // Bulk writes arrive as one realtime message per row — coalesce the burst
    // into a single trailing refetch instead of N full-table fetches.
    let debounce;
    const ch = supabase
      .channel(tableName + '-' + householdId)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(fetch, 200);
      })
      .subscribe();
    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(ch);
    };
  }, [fetch, tableName, householdId]);

  return { data, loading, refetch: fetch };
}

// ─── FREEZER ITEMS ───
export function useItems(householdId) {
  const { data: items, loading, refetch } = useHouseholdTable('items', householdId, 'expiry', true);

  const addItem = async (item) => {
    await run(supabase.from('items').insert([{ ...item, household_id: householdId }]), 'Errors.addFailed');
  };
  const updateItem = async (id, updates) => {
    await run(supabase.from('items').update(updates).eq('id', id), 'Errors.saveFailed');
  };
  const deleteItem = async (id) => {
    await run(supabase.from('items').delete().eq('id', id), 'Errors.deleteFailed');
  };

  return { items, loading, addItem, updateItem, deleteItem, refetch };
}

// ─── ARCHIVED ───
export function useArchived(householdId) {
  const { data: archived, loading, refetch } = useHouseholdTable('archived', householdId, 'archived_at', false);

  const archiveItem = async (item, wasted = false) => {
    const ok = await run(
      supabase.from('archived').insert([
        {
          name: item.name,
          cat: item.cat,
          qty: item.qty,
          packets: item.packets,
          label: item.label,
          frozen: item.frozen,
          expiry: item.expiry,
          freezer: item.freezer,
          wasted,
          household_id: householdId,
        },
      ]),
      'Errors.archiveFailed',
    );
    if (!ok) return;
    await run(supabase.from('items').delete().eq('id', item.id), 'Errors.archiveFailed');
  };

  const updateArchived = async (id, updates) => {
    await run(supabase.from('archived').update(updates).eq('id', id), 'Errors.saveFailed');
  };

  const deleteArchived = async (id) => {
    await run(supabase.from('archived').delete().eq('id', id), 'Errors.deleteFailed');
  };

  const unarchiveItem = async (archivedItem) => {
    const ok = await run(
      supabase.from('items').insert([
        {
          name: archivedItem.name,
          cat: archivedItem.cat,
          qty: archivedItem.qty,
          packets: archivedItem.packets,
          label: archivedItem.label,
          frozen: archivedItem.frozen,
          expiry: archivedItem.expiry,
          freezer: archivedItem.freezer,
          sticky: false,
          household_id: householdId,
        },
      ]),
      'Errors.restoreFailed',
    );
    if (!ok) return;
    await run(supabase.from('archived').delete().eq('id', archivedItem.id), 'Errors.restoreFailed');
  };

  return { archived, loading, archiveItem, updateArchived, deleteArchived, unarchiveItem, refetch };
}

// ─── FREEZERS ───
export function useFreezers(householdId) {
  const { data: freezers, loading, refetch } = useHouseholdTable('freezers', householdId, 'sort_order', true);

  const addFreezer = async (freezer) => {
    const id = freezer.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    await run(
      supabase.from('freezers').insert([
        {
          id,
          name: freezer.name,
          icon: freezer.icon,
          sort_order: freezers.length,
          household_id: householdId,
        },
      ]),
      'Errors.addFailed',
    );
  };

  return { freezers, addFreezer, refetch };
}

// ─── CATEGORIES ───
export function useCategories(householdId) {
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('categories')
      .select('*')
      .or('household_id.eq.' + householdId + ',household_id.is.null');
    if (data) {
      const map = {};
      data.forEach((c) => {
        map[c.id] = { label: c.label, icon: c.icon, color: c.color, months: c.months };
      });
      setCategories(map);
    }
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetch();
    let debounce;
    const ch = supabase
      .channel('categories-' + householdId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(fetch, 200);
      })
      .subscribe();
    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(ch);
    };
  }, [fetch, householdId]);

  const addCategory = async (cat) => {
    const id = cat.label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    await run(
      supabase.from('categories').insert([
        {
          id,
          label: cat.label,
          icon: cat.icon,
          color: cat.color,
          months: cat.months,
          household_id: householdId,
        },
      ]),
      'Errors.addFailed',
    );
  };

  return { categories, loading, addCategory, refetch: fetch };
}

// ─── SHOPPING ITEMS ───
export function useShoppingItems(householdId) {
  const { data: items, loading, refetch } = useHouseholdTable('shopping_items', householdId, 'created_at', false);

  const addItem = async (item) => {
    await run(supabase.from('shopping_items').insert([{ ...item, household_id: householdId }]), 'Errors.addFailed');
  };
  const updateItem = async (id, updates) => {
    await run(supabase.from('shopping_items').update(updates).eq('id', id), 'Errors.saveFailed');
  };
  const deleteItem = async (id) => {
    await run(supabase.from('shopping_items').delete().eq('id', id), 'Errors.deleteFailed');
  };

  return { items, loading, addItem, updateItem, deleteItem, refetch };
}

// ─── SHOPPING ARCHIVED ───
export function useShoppingArchived(householdId) {
  const {
    data: archived,
    loading,
    refetch,
  } = useHouseholdTable('shopping_archived', householdId, 'completed_at', false);

  const archiveChecked = async (checkedItems) => {
    const toArchive = checkedItems.map((i) => ({
      name: i.name,
      qty: i.qty || '',
      category: i.category || '',
      store: i.store || '',
      household_id: householdId,
    }));
    const ok = await run(supabase.from('shopping_archived').insert(toArchive), 'Errors.archiveFailed');
    if (!ok) return;
    await run(
      supabase
        .from('shopping_items')
        .delete()
        .in(
          'id',
          checkedItems.map((i) => i.id),
        ),
      'Errors.archiveFailed',
    );
  };

  return { archived, loading, archiveChecked, refetch };
}

// ─── SHOPPING FAVOURITES ───
export function useShoppingFavourites(householdId) {
  const {
    data: favourites,
    loading,
    refetch,
  } = useHouseholdTable('shopping_favourites', householdId, 'use_count', false);

  const toggleFavourite = async (name) => {
    const existing = favourites.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      await run(supabase.from('shopping_favourites').delete().eq('id', existing.id), 'Errors.saveFailed');
    } else {
      await run(
        supabase.from('shopping_favourites').insert([
          {
            name,
            household_id: householdId,
            use_count: 1,
            last_used: new Date().toISOString(),
          },
        ]),
        'Errors.saveFailed',
      );
    }
  };

  return { favourites, toggleFavourite, refetch };
}

// ─── SHOPPING STORES ───
export function useShoppingStores(householdId) {
  const { data: stores, loading, refetch } = useHouseholdTable('shopping_stores', householdId, 'sort_order', true);

  const addStore = async (store) => {
    const id = store.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    await run(
      supabase.from('shopping_stores').insert([
        {
          id,
          name: store.name,
          icon: store.icon,
          sort_order: stores.length,
          household_id: householdId,
        },
      ]),
      'Errors.addFailed',
    );
  };

  const deleteStore = async (id) => {
    await run(supabase.from('shopping_stores').delete().eq('id', id), 'Errors.deleteFailed');
  };

  const updateStore = async (id, updates) => {
    await run(supabase.from('shopping_stores').update(updates).eq('id', id), 'Errors.saveFailed');
  };

  return { stores, addStore, updateStore, deleteStore, refetch };
}

// ─── CALENDAR CONNECTIONS ───
export function useCalendarConnections(householdId, userId) {
  const {
    data: connections,
    loading,
    refetch,
  } = useHouseholdTable('calendar_connections', householdId, 'created_at', true);

  // Memoized so consumers (AppShell's connectCalendar + its token-refresh
  // timer effect) keep a stable identity across realtime-triggered renders.
  const saveConnection = useCallback(
    async ({ accessToken, expiresIn, email }) => {
      const expiresAt = new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString();
      await run(
        supabase.from('calendar_connections').delete().eq('user_id', userId).eq('household_id', householdId),
        'Errors.calendarConnectFailed',
      );
      await run(
        supabase.from('calendar_connections').insert({
          user_id: userId,
          household_id: householdId,
          access_token: accessToken,
          expires_at: expiresAt,
          google_email: email,
        }),
        'Errors.calendarConnectFailed',
      );
      await refetch();
    },
    [householdId, userId, refetch],
  );

  const removeConnection = useCallback(
    async (id) => {
      await run(supabase.from('calendar_connections').delete().eq('id', id), 'Errors.deleteFailed');
      await refetch();
    },
    [refetch],
  );

  // Marks the own row as expired (Google rejected the stored token with a 401
  // despite a future expires_at) so isConnected flips false and the UI falls
  // back to the connect button instead of retrying forever.
  const expireConnection = useCallback(async () => {
    await run(
      supabase
        .from('calendar_connections')
        .update({ expires_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('household_id', householdId),
      'Errors.saveFailed',
    );
    await refetch();
  }, [householdId, userId, refetch]);

  const saveEvents = useCallback(
    async (googleEvents, dateStr) => {
      const rows = googleEvents.map((ev) => ({
        household_id: householdId,
        user_id: userId,
        google_event_id: ev.id,
        // Untitled events are stored with an empty title; the UI falls back to
        // the viewer-locale translation via eventTitle() in lib/intl.js.
        title: ev.summary || '',
        start_time: ev.start?.dateTime || ev.start?.date || null,
        end_time: ev.end?.dateTime || ev.end?.date || null,
        is_all_day: !!ev.start?.date,
        location: ev.location || null,
        event_date: dateStr,
      }));
      // Upsert keyed on (user_id, event_date, google_event_id) — the payload
      // omits label/is_important, so annotations survive every re-sync.
      if (rows.length) {
        const ok = await run(
          supabase.from('calendar_events').upsert(rows, { onConflict: 'user_id,event_date,google_event_id' }),
          'Errors.eventsSaveFailed',
        );
        if (!ok) return; // don't wipe the day if the write failed
      }
      // Drop events removed on the Google side (all of them on an empty day).
      let stale = supabase.from('calendar_events').delete().eq('user_id', userId).eq('event_date', dateStr);
      if (rows.length) {
        const ids = rows.map((r) => '"' + String(r.google_event_id).replaceAll('"', '') + '"').join(',');
        stale = stale.not('google_event_id', 'in', '(' + ids + ')');
      }
      await run(stale, 'Errors.eventsSaveFailed');
    },
    [householdId, userId],
  );

  const myConnection = connections.find((c) => c.user_id === userId);
  const isConnected = !!myConnection && new Date(myConnection.expires_at) > new Date();

  return {
    connections,
    myConnection,
    isConnected,
    loading,
    saveConnection,
    removeConnection,
    expireConnection,
    saveEvents,
    refetch,
  };
}

// ─── CALENDAR EVENTS (shared household view) ───
export function useCalendarEvents(householdId, dateStr) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!householdId || !dateStr) return;
    setLoading(true);
    supabase
      .from('calendar_events')
      .select('*')
      .eq('household_id', householdId)
      .eq('event_date', dateStr)
      .order('start_time', { ascending: true })
      .then(({ data }) => {
        setEvents(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [householdId, dateStr, tick]);

  const updateEvent = useCallback(async (id, updates) => {
    await run(supabase.from('calendar_events').update(updates).eq('id', id), 'Errors.saveFailed');
    setTick((t) => t + 1);
  }, []);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { events, loading, refetch, updateEvent };
}

// ─── TODO LISTS (active + archived from one query/channel) ───
export function useTodoLists(householdId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const chName = useRef('todo_lists-' + householdId + '-' + Date.now()).current;

  const fetch = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('todo_lists').select('*').eq('household_id', householdId);
    if (data) setRows(data);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetch();
    let debounce;
    const ch = supabase
      .channel(chName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_lists' }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(fetch, 200);
      })
      .subscribe();
    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(ch);
    };
  }, [fetch, chName]);

  // Plain code-unit compares on the ISO strings — localeCompare mis-sorts
  // them under ICU collation (symbols/punctuation get lower weight).
  const lists = useMemo(
    () =>
      rows
        .filter((l) => !l.archived_at)
        .sort((a, b) => {
          // due_date asc, undated last (old `order('due_date', { nullsFirst: false })`)
          if (!a.due_date) return b.due_date ? 1 : 0;
          if (!b.due_date) return -1;
          return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
        }),
    [rows],
  );
  const archivedLists = useMemo(
    () => rows.filter((l) => l.archived_at).sort((a, b) => (a.archived_at < b.archived_at ? 1 : -1)),
    [rows],
  );

  const addList = async (list) => {
    await run(supabase.from('todo_lists').insert([{ ...list, household_id: householdId }]), 'Errors.addFailed');
    await fetch();
  };
  const updateList = async (id, updates) => {
    await run(supabase.from('todo_lists').update(updates).eq('id', id), 'Errors.saveFailed');
    await fetch();
  };
  const archiveList = async (id) => {
    await run(
      supabase.from('todo_lists').update({ archived_at: new Date().toISOString() }).eq('id', id),
      'Errors.archiveFailed',
    );
    await fetch();
  };
  const unarchiveList = async (id) => {
    await run(supabase.from('todo_lists').update({ archived_at: null }).eq('id', id), 'Errors.restoreFailed');
    await fetch();
  };
  const deleteList = async (id) => {
    await run(supabase.from('todo_lists').delete().eq('id', id), 'Errors.deleteFailed');
    await fetch();
  };

  return { lists, archivedLists, loading, addList, updateList, archiveList, unarchiveList, deleteList, refetch: fetch };
}

// ─── HOME SETTINGS ───
export function useHomeSettings(householdId, userId) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!householdId || !userId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('home_settings')
      .select('*')
      .eq('household_id', householdId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) setSettings(data);
    setLoading(false);
  }, [householdId, userId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const saveSettings = async (updates) => {
    const { data, error } = await supabase
      .from('home_settings')
      .upsert(
        { household_id: householdId, user_id: userId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'household_id,user_id' },
      )
      .select()
      .single();
    if (error) {
      console.error('Errors.settingsSaveFailed', error);
      notifyError('Errors.settingsSaveFailed');
    }
    if (data) setSettings(data);
  };

  return { settings, loading, saveSettings };
}

// ─── TODO ITEMS (whole household, grouped by list — one query/channel) ───
export function useTodoItems(householdId) {
  const { data: items, loading, refetch } = useHouseholdTable('todo_items', householdId, 'sort_order', true);

  const itemsByList = useMemo(() => {
    const map = {};
    for (const item of items) (map[item.list_id] ||= []).push(item);
    return map;
  }, [items]);

  const addItem = async (listId, title) => {
    const listItems = itemsByList[listId] || [];
    const maxOrder = listItems.length > 0 ? Math.max(...listItems.map((i) => i.sort_order ?? 0)) : 0;
    await run(
      supabase
        .from('todo_items')
        .insert([{ title, list_id: listId, household_id: householdId, checked: false, sort_order: maxOrder + 1 }]),
      'Errors.addFailed',
    );
    await refetch();
  };
  const updateItem = async (id, updates) => {
    await run(supabase.from('todo_items').update(updates).eq('id', id), 'Errors.saveFailed');
    await refetch();
  };
  const deleteItem = async (id) => {
    await run(supabase.from('todo_items').delete().eq('id', id), 'Errors.deleteFailed');
    await refetch();
  };
  const toggleItem = (id) => {
    const item = items.find((i) => i.id === id);
    if (item) updateItem(id, { checked: !item.checked });
  };

  return { itemsByList, loading, addItem, updateItem, deleteItem, toggleItem, refetch };
}

// ─── WEB PUSH SUBSCRIPTION ───
// applicationServerKey must be a raw Uint8Array, not the base64url string.
const urlBase64ToUint8Array = (base64url) => {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
};

export function usePushSubscription(householdId, userId, locale) {
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    // Order matters: iOS Safari has no Notification API at all until the app
    // is installed to the home screen (iOS 16.4+), so check that case first.
    if (isIOS && !standalone) {
      setNeedsInstall(true);
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    setSupported(true);
    setPermission(Notification.permission);
  }, []);

  // Reconcile on every app open (and on locale switch): an existing browser
  // subscription — possibly recreated by the SW's pushsubscriptionchange —
  // gets its DB row upserted with the current user/household/locale.
  useEffect(() => {
    if (!supported || !householdId || !userId) return;
    let cancelled = false;
    (async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (cancelled || !sub) return;
      const { endpoint, keys } = sub.toJSON();
      await supabase
        .from('push_subscriptions')
        .upsert(
          { endpoint, p256dh: keys.p256dh, auth: keys.auth, user_id: userId, household_id: householdId, locale },
          { onConflict: 'endpoint' },
        );
      if (!cancelled) setSubscribed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supported, householdId, userId, locale]);

  // Must be called from a user gesture (requestPermission requirement).
  const enable = async () => {
    if (!supported || busy) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      const { endpoint, keys } = sub.toJSON();
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          { endpoint, p256dh: keys.p256dh, auth: keys.auth, user_id: userId, household_id: householdId, locale },
          { onConflict: 'endpoint' },
        );
      if (error) throw error;
      setSubscribed(true);
    } catch (e) {
      console.error('push subscribe failed', e);
      notifyError('Errors.pushSubscribeFailed');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      console.error('push unsubscribe failed', e);
      notifyError('Errors.pushUnsubscribeFailed');
    } finally {
      setBusy(false);
    }
  };

  return { supported, needsInstall, permission, subscribed, busy, enable, disable };
}
