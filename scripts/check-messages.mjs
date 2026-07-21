// i18n guard: run with `npm run i18n:check` (see CLAUDE.md).
// Validates that messages/sl.json and messages/en.json stay in lockstep:
//   1. identical key sets in both locales,
//   2. every message has valid ICU syntax (plurals formatted for several counts),
//   3. every t('…') / t.raw('…') / Errors.* key referenced in code exists.
// Exits non-zero on any failure so it can gate commits/CI.
import { createTranslator } from 'next-intl';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const sl = read('messages/sl.json');
const en = read('messages/en.json');

let failures = 0;
const fail = (msg) => {
  console.error('✗', msg);
  failures++;
};

// ─── 1. Key parity ───
const collectKeys = (obj, prefix = '', out = new Set()) => {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) collectKeys(v, p, out);
    else out.add(p);
  }
  return out;
};
const slKeys = collectKeys(sl);
const enKeys = collectKeys(en);
for (const k of slKeys) if (!enKeys.has(k)) fail(`missing in en.json: ${k}`);
for (const k of enKeys) if (!slKeys.has(k)) fail(`missing in sl.json: ${k}`);

// ─── 2. ICU syntax — format every message with dummy params ───
const params = {
  count: 2,
  days: 2,
  weeks: 2,
  done: 2,
  total: 5,
  min: 3,
  months: 6,
  name: 'X',
  code: '600012',
  number: 42,
  store: 'Spar',
  label: 'X',
  date: '1. 1. 2026',
  p: 40,
  n: 3,
  h: 2,
  m: 15,
};
const pluralCounts = [0, 1, 2, 3, 5, 101];
const getValue = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

for (const [locale, messages] of [
  ['sl', sl],
  ['en', en],
]) {
  // Default onError only logs and falls back — throw so the try/catch counts it.
  const t = createTranslator({
    locale,
    messages,
    onError(e) {
      throw e;
    },
  });
  for (const key of collectKeys(messages)) {
    const val = getValue(messages, key);
    if (typeof val !== 'string') continue; // t.raw arrays (Calendar.dow)
    try {
      if (/plural/.test(val)) {
        for (const c of pluralCounts) t(key, { ...params, count: c, days: c, weeks: c, done: c, total: 5 });
      } else {
        t(key, params);
      }
    } catch (e) {
      fail(`ICU error [${locale}] ${key}: ${e.message}`);
    }
  }
}

// ─── 3. Every key referenced in code exists in the catalog ───
// Dynamic references (built with string concatenation) that the regex below
// cannot see — keep in sync with the code:
const DYNAMIC_KEYS = [
  // ShoppingModule: t('sections.' + group.key)
  ...[
    'zamrznjeno',
    'mlecni',
    'meso',
    'sadje',
    'zelenjava',
    'pekarna',
    'suho',
    'pijace',
    'zivali',
    'cistila',
    'drugo',
  ].map((k) => `Shopping.sections.${k}`),
  // CalendarModule/EventForm: t('types.' + k) and t('recurrence.' + r)
  ...['sluzba', 'sport', 'dom', 'socialno', 'zdravje', 'sola', 'potovanje', 'opravki', 'other'].map(
    (k) => `Calendar.types.${k}`,
  ),
  ...['once', 'weekly', 'monthly', 'yearly', 'custom'].map((k) => `Calendar.recurrence.${k}`),
  // BottomNav: t(tab.id)
  ...['home', 'freezer', 'shopping', 'calendar', 'todo'].map((k) => `Nav.${k}`),
];
for (const k of DYNAMIC_KEYS) if (!slKeys.has(k)) fail(`dynamic key missing: ${k}`);

const leafKeys = new Set([...slKeys].map((k) => k.split('.').slice(1).join('.')).filter(Boolean));
const srcFiles = ['app', 'components', 'lib']
  .flatMap((dir) => fs.readdirSync(path.join(root, dir)).map((f) => path.join(dir, f)))
  .filter((f) => f.endsWith('.js'));

for (const file of srcFiles) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  let m;
  // t('key') / tc('key') / t.raw('key') / t.has('key')
  const callRe = /\b(?:t|tc)(?:\.(?:raw|has))?\(\s*'([^']+)'/g;
  while ((m = callRe.exec(src))) {
    const key = m[1];
    if (key.includes(' ') || key.endsWith('.')) continue; // sentences / dynamic prefixes
    if (!slKeys.has(key) && !leafKeys.has(key)) fail(`${file}: unknown key '${key}'`);
  }
  // Message keys passed around as plain strings (toasts, error state)
  const literalRe = /'((?:Errors|Auth)\.[A-Za-z][A-Za-z.]*)'/g;
  while ((m = literalRe.exec(src))) {
    if (!slKeys.has(m[1])) fail(`${file}: unknown key '${m[1]}'`);
  }
}

if (failures === 0) {
  console.log(`✓ i18n OK — ${slKeys.size} keys, sl/en in sync, ICU valid, all references resolve`);
} else {
  console.error(`\n${failures} i18n problem(s) found`);
  process.exit(1);
}
