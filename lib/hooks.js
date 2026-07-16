'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import { notifyError } from './notify';

// Reports failed writes to the user via toast (see <Toaster /> in ui.js).
// `msg` is an Errors.* message key — Toaster translates it at render time.
// Reads keep their per-hook handling.
const run = async (query, msg) => {
  const { error } = await query;
  if (error) {
    console.error(msg, error);
    notifyError(msg);
  }
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signInWithGoogle, signOut };
}

// ─── HOUSEHOLD ───
export function useHousehold(user) {
  const [household, setHousehold] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Step 1: Get user's membership (simple query, no join)
    const { data: memberData, error: memberError } = await supabase
      .from('household_members')
      .select('household_id, role, display_name')
      .eq('user_id', user.id);

    if (memberError || !memberData || memberData.length === 0) {
      setHousehold(null);
      setLoading(false);
      return;
    }

    const hhId = memberData[0].household_id;

    // Step 2: Get household details (separate query)
    const { data: hhData } = await supabase.from('households').select('id, name, join_code').eq('id', hhId).single();

    if (hhData) {
      setHousehold(hhData);
      // Step 3: Get all members
      const { data: allMembers } = await supabase.from('household_members').select('*').eq('household_id', hhId);
      if (allMembers) setMembers(allMembers);
    } else {
      setHousehold(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetch();
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
    const ch = supabase
      .channel(tableName + '-' + householdId)
      .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => fetch())
      .subscribe();
    return () => {
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
    await run(
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
    await run(supabase.from('items').delete().eq('id', item.id), 'Errors.archiveFailed');
  };

  const updateArchived = async (id, updates) => {
    await run(supabase.from('archived').update(updates).eq('id', id), 'Errors.saveFailed');
  };

  const deleteArchived = async (id) => {
    await run(supabase.from('archived').delete().eq('id', id), 'Errors.deleteFailed');
  };

  const unarchiveItem = async (archivedItem) => {
    await run(
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
    const ch = supabase
      .channel('categories-' + householdId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => fetch())
      .subscribe();
    return () => {
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
    await run(supabase.from('shopping_archived').insert(toArchive), 'Errors.archiveFailed');
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

  return { archived, archiveChecked, refetch };
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

  const saveConnection = async ({ accessToken, expiresIn, email }) => {
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
  };

  const removeConnection = async (id) => {
    await run(supabase.from('calendar_connections').delete().eq('id', id), 'Errors.deleteFailed');
    await refetch();
  };

  const saveEvents = useCallback(
    async (googleEvents, dateStr) => {
      if (!googleEvents.length) return;
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
      await run(
        supabase.from('calendar_events').delete().eq('user_id', userId).eq('event_date', dateStr),
        'Errors.eventsSaveFailed',
      );
      await run(supabase.from('calendar_events').insert(rows), 'Errors.eventsSaveFailed');
    },
    [householdId, userId],
  );

  const myConnection = connections.find((c) => c.user_id === userId);
  const isConnected = !!myConnection && new Date(myConnection.expires_at) > new Date();

  return { connections, myConnection, isConnected, loading, saveConnection, removeConnection, saveEvents, refetch };
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

  return { events, loading, refetch: () => setTick((t) => t + 1), updateEvent };
}

// ─── TODO LISTS ───
export function useTodoLists(householdId) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const chName = useRef('todo_lists-' + householdId + '-' + Date.now()).current;

  const fetch = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('todo_lists')
      .select('*')
      .eq('household_id', householdId)
      .is('archived_at', null)
      .order('due_date', { ascending: true, nullsFirst: false });
    if (data) setLists(data);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel(chName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_lists' }, fetch)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetch, householdId]);

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
  const deleteList = async (id) => {
    await run(supabase.from('todo_lists').delete().eq('id', id), 'Errors.deleteFailed');
    await fetch();
  };

  return { lists, loading, addList, updateList, archiveList, deleteList, refetch: fetch };
}

// ─── TODO ARCHIVED LISTS ───
export function useTodoArchivedLists(householdId) {
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const chName = useRef('todo_lists_archived-' + householdId + '-' + Date.now()).current;

  const fetch = useCallback(async () => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('todo_lists')
      .select('*')
      .eq('household_id', householdId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false });
    if (data) setLists(data);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel(chName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_lists' }, fetch)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetch, chName]);

  const unarchiveList = async (id) => {
    await run(supabase.from('todo_lists').update({ archived_at: null }).eq('id', id), 'Errors.restoreFailed');
    await fetch();
  };

  return { lists, loading, unarchiveList, refetch: fetch };
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
      .single();
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

// ─── TODO ITEMS ───
export function useTodoItems(householdId, listId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const chName = useRef('todo_items-' + listId + '-' + Date.now()).current;

  const fetch = useCallback(async () => {
    if (!householdId || !listId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('todo_items')
      .select('*')
      .eq('list_id', listId)
      .order('sort_order', { ascending: true });
    if (data) setItems(data);
    setLoading(false);
  }, [householdId, listId]);

  useEffect(() => {
    fetch();
    const ch = supabase
      .channel(chName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todo_items' }, fetch)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetch, chName]);

  const addItem = async (title) => {
    const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order ?? 0)) : 0;
    await run(
      supabase
        .from('todo_items')
        .insert([{ title, list_id: listId, household_id: householdId, checked: false, sort_order: maxOrder + 1 }]),
      'Errors.addFailed',
    );
    await fetch();
  };
  const updateItem = async (id, updates) => {
    await run(supabase.from('todo_items').update(updates).eq('id', id), 'Errors.saveFailed');
    await fetch();
  };
  const deleteItem = async (id) => {
    await run(supabase.from('todo_items').delete().eq('id', id), 'Errors.deleteFailed');
    await fetch();
  };
  const toggleItem = (id) => {
    const item = items.find((i) => i.id === id);
    if (item) updateItem(id, { checked: !item.checked });
  };

  return { items, loading, addItem, updateItem, deleteItem, toggleItem, refetch: fetch };
}
