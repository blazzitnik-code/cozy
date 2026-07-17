// send-push — the single place that sends web push notifications.
// Called by DB triggers / pg_cron via pg_net (see the push_notifications
// migration), authenticated with the shared PUSH_FN_SECRET header
// (verify_jwt = false in config.toml).
//
// Web push library: jsr:@negrel/webpush (pure WebCrypto, Deno-native).
// It is v0.x and unaudited; if it ever misbehaves, the contained fallback
// is npm:web-push (Node shims) — only this file would change, with VAPID
// keys as raw base64url strings instead of exported JWK JSON.
//
// Env (supabase/functions/.env locally, `npx supabase secrets set` in prod):
//   VAPID_KEYS_JSON  — output of generate-keys.ts (JWK key pair)
//   VAPID_SUBJECT    — mailto: contact for the push service
//   PUSH_FN_SECRET   — shared secret, must match the `push_fn_secret` Vault entry

import * as webpush from 'jsr:@negrel/webpush@0.3';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { t } from './i18n.ts';

// Freezer items with expiry within this many days (or overdue) count toward
// the daily digest.
const DIGEST_EXPIRY_DAYS = 3;

const PUSH_FN_SECRET = Deno.env.get('PUSH_FN_SECRET')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';

const vapidKeys = await webpush.importVapidKeys(JSON.parse(Deno.env.get('VAPID_KEYS_JSON')!), {
  extractable: false,
});
const appServer = await webpush.ApplicationServer.new({
  contactInformation: VAPID_SUBJECT,
  vapidKeys,
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  locale: string;
  user_id: string;
  household_id: string;
}

interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}

async function sendTo(sub: SubRow, payload: PushPayload) {
  try {
    const subscriber = appServer.subscribe({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth },
    });
    await subscriber.pushTextMessage(JSON.stringify(payload), {});
  } catch (err) {
    // deno-lint-ignore no-explicit-any
    const status = (err as any)?.response?.status;
    const gone =
      status === 404 ||
      status === 410 ||
      (err instanceof webpush.PushMessageError && err.isGone());
    if (gone) {
      // Push service says the endpoint no longer exists — prune the row.
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      console.log(`pruned dead subscription ${sub.endpoint.slice(0, 48)}…`);
    } else {
      console.error('push send failed', status, err);
    }
  }
}

async function actorName(householdId: string, actor: string): Promise<string> {
  const { data } = await supabase
    .from('household_members')
    .select('display_name')
    .eq('household_id', householdId)
    .eq('user_id', actor)
    .maybeSingle();
  return data?.display_name ?? '?';
}

// deno-lint-ignore no-explicit-any
async function handleShoppingAdded(body: any) {
  const { household_id, actor, record } = body;
  if (!actor) return; // can't tell who acted — better silence than self-notification
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('household_id', household_id)
    .neq('user_id', actor);
  if (!subs?.length) return;
  const name = await actorName(household_id, actor);
  await Promise.all(
    subs.map((sub: SubRow) =>
      sendTo(sub, {
        title: t(sub.locale, 'shoppingTitle'),
        body: t(sub.locale, 'shoppingBody', { name, item: record.name }),
        tag: `shopping-${household_id}`, // rapid multi-adds collapse into one
        url: '/#shopping',
      }),
    ),
  );
}

// deno-lint-ignore no-explicit-any
async function handleTodoAssigned(body: any) {
  const { household_id, actor, record } = body;
  if (!actor || record.assigned_to === actor) return; // self-assign → no push
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('household_id', household_id)
    .eq('user_id', record.assigned_to);
  if (!subs?.length) return;
  const [name, { data: list }] = await Promise.all([
    actorName(household_id, actor),
    supabase.from('todo_lists').select('title').eq('id', record.list_id).maybeSingle(),
  ]);
  await Promise.all(
    subs.map((sub: SubRow) =>
      sendTo(sub, {
        title: t(sub.locale, 'todoTitle'),
        body: t(sub.locale, 'todoBody', {
          name,
          title: record.title,
          list: list?.title ?? '',
        }),
        tag: `todo-${record.id}`,
        url: '/#todo',
      }),
    ),
  );
}

function ljubljanaDateStr(base: Date, addDays = 0): string {
  const shifted = new Date(base.getTime() + addDays * 86400_000);
  // en-CA formats as YYYY-MM-DD, matching the app's date columns
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Ljubljana' }).format(shifted);
}

async function handleDailyDigest() {
  const today = ljubljanaDateStr(new Date());
  const horizon = ljubljanaDateStr(new Date(), DIGEST_EXPIRY_DAYS);

  const { data: subs } = await supabase.from('push_subscriptions').select('*');
  if (!subs?.length) return;

  const byHousehold = new Map<string, SubRow[]>();
  for (const sub of subs as SubRow[]) {
    const list = byHousehold.get(sub.household_id) ?? [];
    list.push(sub);
    byHousehold.set(sub.household_id, list);
  }

  await Promise.all(
    [...byHousehold.entries()].map(async ([householdId, householdSubs]) => {
      const [{ count: expiring }, { count: due }] = await Promise.all([
        supabase
          .from('items')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .not('expiry', 'is', null)
          .lte('expiry', horizon), // includes overdue
        supabase
          .from('todo_lists')
          .select('*', { count: 'exact', head: true })
          .eq('household_id', householdId)
          .eq('due_date', today)
          .is('archived_at', null),
      ]);
      if (!expiring && !due) return;
      await Promise.all(
        householdSubs.map((sub) => {
          const parts = [];
          if (expiring) parts.push(t(sub.locale, 'digestFreezer', { count: expiring }));
          if (due) parts.push(t(sub.locale, 'digestTodos', { count: due }));
          return sendTo(sub, {
            title: t(sub.locale, 'digestTitle'),
            body: parts.join(' · '),
            tag: `digest-${householdId}`,
            url: '/',
          });
        }),
      );
    }),
  );
}

// deno-lint-ignore no-explicit-any
async function handle(body: any) {
  switch (body.type) {
    case 'shopping_added':
      return handleShoppingAdded(body);
    case 'todo_assigned':
      return handleTodoAssigned(body);
    case 'daily_digest':
      return handleDailyDigest();
    default:
      console.warn('unknown push type', body.type);
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== PUSH_FN_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('bad request', { status: 400 });
  }

  // Respond 202 immediately (pg_net times out at 3 s) and finish the sends
  // in the background.
  const work = handle(body).catch((err) => console.error('send-push failed', err));
  // deno-lint-ignore no-explicit-any
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(work);
  else await work;

  return new Response(null, { status: 202 });
});
