---
name: new-screen
description: Step-by-step recipe for adding a new Cožy module (bottom-nav tab) or a sub-screen inside an existing module — AppShell wiring, PageBody keying, ui.js reuse, i18n, pre-commit checks. Use whenever building a new screen.
---

# New screen / module in Cožy

CLAUDE.md holds the rules and the _why_; this skill is the **order of operations**. Work through the steps top to bottom and cross-check the referenced CLAUDE.md sections as you go.

## 0. Decide the scope

- **Sub-screen inside an existing module** (a new pane of Freezer/Shopping/Todo/…): steps 3–6 only, inside that module's file.
- **New module = new bottom-nav tab**: all steps.

## 1. Module file (new module only)

One file `components/XModule.js`, one default export. The module owns **only UI state** (`useState` for screen/filters/modals) — no data hooks, no Supabase imports. Sole exception: module-local **external-API** data (non-Supabase fetches à la HomeModule's LPP/BicikeLJ), seeded from module-scope caches so remounts paint instantly — see CLAUDE.md → Structure.

## 2. Data wiring (new module / new data only)

1. Hook in `lib/hooks.js` — the ONLY place Supabase is touched. For a plain household-scoped table, build on the internal generic `useHouseholdTable(tableName, householdId, orderBy, ascending)` (returns `{ data, loading, refetch }` + realtime); add mutators next to it like the existing hooks do. Failed writes must go through `notifyError()` — never swallowed.
2. New table? → migration (`npx supabase migration new`), RLS via `is_household_member()`, grants, **add it to the `supabase_realtime` publication** (see CLAUDE.md → Database).
3. Call the hook in `AppShell.js` and pass data + mutators down as props; add the render branch to AppShell's single return: `{mode === 'x' && <XModule … />}`. (Rationale — tab switches unmount modules — is in CLAUDE.md → Structure.)
4. Tab: add `{ id: 'x', Icon: <lucide icon> }` to `NAV_TABS` in `components/ui.js` and a `Nav.x` key to both message files — the label doubles as the tab's aria-label automatically.

## 3. Screen skeleton

One logical screen = one keyed `<PageBody>`; branch on local state:

```js
export default function XModule({ items, loading, dbAdd, onOpenSettings }) {
  const t = useTranslations('X');
  const ta = useTranslations('A11y');
  const [screen, setScreen] = useState('home');

  if (screen === 'detail')
    return (
      <Screen>
        <PageBody key="x-detail">…</PageBody>
      </Screen>
    );

  return (
    <Screen>
      <PageBody key="x-home">…</PageBody>
      <Fab onClick={() => setScreen('add')} aria-label={ta('add')} />
    </Screen>
  );
}
```

- Every sub-screen branch gets its **own unique `PageBody key`** (`frz-home`/`frz-add`/`frz-archive` pattern) — the key drives the enter animation + scroll reset.
- **Never** wrap screens in `AnimatePresence` — transitions are enter-only by design.
- Fixed UI (`Fab`) goes **outside `PageBody`, inside `Screen`** (PageBody's animating transform is a CSS containing block).
- A view that swaps in place without a full PageBody (auth panes, toggles) → keyed `<ScreenEnter>`.

## 4. Reuse before inventing

Check `components/ui.js` first — primitives (`Card`, `Input`, `Btn`, `IconButton`, `Modal`+`ModalActions`, `ConfirmModal`, `EmptyState`, `SectionHeader`, `Segmented`, `BackBtn`, `SwipeCard`…), class consts (`CHIP_OFF/CHIP_ON`, `ROW_FLAT`, `POPOVER`, `PRESS/PRESS_SM/ROW_PRESS`) and the Motion vocabulary (`POP`, `LIST_ROW`, `COLLAPSE`, `SCREEN_ENTER`, `StepPane`+`useStepDir`, `TickNum`, `Spinner`). Styling rules live in CLAUDE.md → Theming; the ones most often missed:

- Item lists are FLAT (`ROW_FLAT` dotted dividers), `Card` only for hero/summary surfaces.
- Primary actions are ink capsules; **orange only in the documented accent locations**, accent text `text-orange-600 dark:text-orange-400`.
- Swipeable/reorderable rows need an **opaque page-colored bg** (`bg-stone-100 dark:bg-stone-950`).
- New tappables get `PRESS`/`PRESS_SM` (and never `whileTap` on top of them).

## 5. Lists & loading

- Animated lists: `<AnimatePresence initial={false} mode="popLayout">` around the map, `relative` on the container, **stable DB-uuid keys** (never index keys; `key` as the FIRST prop, before any spread — React 19 quirk).
- Empty states gate on the hook's `loading` flag, never bare `.length === 0` (no flash during cold-start fetch).

## 6. i18n

- New namespace/keys in **BOTH** `messages/sl.json` and `messages/en.json`; never hardcode UI text in JSX.
- Icon-only buttons need a translated aria-label from `A11y` (`IconButton`/`Fab` pass it through).
- Dates via `useFormatter()` named presets (`day`, `dayShort`, `time`, …) — never `toLocaleDateString`.
- Plurals: ICU with all 4 Slovenian forms (`one/two/few/other`); escape literal `{ } #` with `'`.
- Dynamic keys (`'prefix.' + key`) → extend `DYNAMIC_KEYS` in `scripts/check-messages.mjs`.

## 7. Verify

```bash
npm run format
npm run i18n:check
grep -rnE '#[0-9A-Fa-f]{3,8}\b|rgba?\(' app components lib --include='*.js' | grep -vE 'lib/constants\.js|fill="#|themeColor'   # must be empty
```

For visual confirmation of the actual screens, use the **visual-check** skill.
