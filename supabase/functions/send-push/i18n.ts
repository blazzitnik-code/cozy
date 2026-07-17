// Notification strings live HERE, not in messages/*.json — they are rendered
// server-side by this Deno edge function, where next-intl does not exist.
// The subscriber's locale is stored on their push_subscriptions row.

export type Locale = 'sl' | 'en';

const MESSAGES: Record<Locale, Record<string, string>> = {
  sl: {
    shoppingTitle: '🛒 Nakupovalni seznam',
    shoppingBody: '{name}: {item}',
    todoTitle: '✅ Novo opravilo zate',
    todoBody: '{name}: {title} · {list}',
    digestTitle: '☀️ Dnevni pregled',
    digestFreezer: 'Zamrzovalnik: {count} kmalu poteče',
    digestTodos: 'Naloge danes: {count}',
  },
  en: {
    shoppingTitle: '🛒 Shopping list',
    shoppingBody: '{name}: {item}',
    todoTitle: '✅ New todo for you',
    todoBody: '{name}: {title} · {list}',
    digestTitle: '☀️ Daily overview',
    digestFreezer: 'Freezer: {count} expiring soon',
    digestTodos: 'Todos due today: {count}',
  },
};

export function t(locale: string, key: string, params: Record<string, unknown> = {}): string {
  const dict = MESSAGES[(locale as Locale) in MESSAGES ? (locale as Locale) : 'sl'];
  const template = dict[key] ?? MESSAGES.sl[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? ''));
}
