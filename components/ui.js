'use client';
import { useState, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'motion/react';
import {
  CalendarDays,
  ChevronLeft,
  House,
  ListChecks,
  LoaderCircle,
  Plus,
  ShoppingCart,
  Snowflake,
  TriangleAlert,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { subscribeToErrors } from '@/lib/notify';
import { cx } from '@/lib/utils';

// ─── APP FRAME ───
// Full-height app container on the flat warm page background.
// `center` is used by loading/auth screens.
export function Screen({ children, center = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'relative mx-auto min-h-dvh max-w-[430px] overflow-hidden bg-stone-100 pt-[env(safe-area-inset-top)] text-stone-900 dark:bg-stone-950 dark:text-stone-100',
        center && 'flex items-center justify-center',
      )}
    >
      {children}
    </div>
  );
}

// Standard page content wrapper inside <Screen> (nav-safe bottom padding).
// Doubles as the screen-transition surface: plays SCREEN_ENTER on mount and
// resets the window scroll (the window is the app's scroller). One logical
// screen = one <PageBody key="…"> — key each sub-screen branch inside a module
// so React remounts it. Fixed UI (Fab) must stay OUTSIDE PageBody: the enter
// transform is a containing block for the subtree while it animates.
export function PageBody({ children, className, ...rest }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <motion.div
      {...SCREEN_ENTER}
      className={cx('relative z-1 px-4 pt-4 pb-[calc(100px+env(safe-area-inset-bottom))]', className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// Enter-only fade+rise for screens/panes that don't use PageBody (auth panes,
// in-place view toggles). Key it per logical pane so React remounts it.
// `rest` lands after the recipe spread, so callers can override e.g. `initial`
// (pass initial={false} on the parent's first mount to avoid a double-rise
// inside an already-entering PageBody/ScreenEnter — see useMounted).
export function ScreenEnter({ children, className, ...rest }) {
  return (
    <motion.div {...SCREEN_ENTER} className={className} {...rest}>
      {children}
    </motion.div>
  );
}

// Serif brand wordmark — the single source for "Cožy" (login, loader, home).
// The ž wears an INVERTED caron: drawn as z + the font's caron glyph (U+02C7)
// rotated 180°, because the precomposed ẑ (U+1E91) isn't guaranteed to exist
// in Fraunces' latin/latin-ext subsets. Em-based offset so it scales with the
// caller's text size (arbitrary value: stock has no em offset utilities).
export function Wordmark({ className }) {
  return (
    <span className={cx('font-serif font-semibold tracking-tight text-stone-900 dark:text-stone-100', className)}>
      <span className="sr-only">Cožy</span>
      <span aria-hidden="true">
        Co
        <span className="relative inline-block">
          z
          <span className="absolute -top-[0.5em] left-1/2 inline-block -translate-x-1/2 rotate-180 leading-none">
            ˇ
          </span>
        </span>
        y
      </span>
    </span>
  );
}

// Full-screen brand loader (auth + data loading gates).
// The brand splash animates once per page load: startup mounts Loader twice
// back-to-back (page.js auth/household gate → AppShell data gate) and a
// replayed rise reads as a double jump between two identical screens.
let loaderEntered = false;

export function Loader() {
  const t = useTranslations('Common');
  const entered = loaderEntered;
  // Flag on unmount (cleanup), not on mount: a mount-time flag would let dev
  // StrictMode's instant remount suppress even the very first entrance.
  useEffect(
    () => () => {
      loaderEntered = true;
    },
    [],
  );
  return (
    <Screen center>
      <ScreenEnter className="text-center" initial={entered ? false : undefined}>
        <div className="mb-4 text-6xl">🏠</div>
        <Wordmark className="text-4xl" />
        {/* suppressHydrationWarning: this is the only text that hydrates against
            server HTML — SSR always renders sl, the client may load en */}
        <div
          className="mt-2 animate-pulse text-sm text-stone-400 motion-reduce:animate-none dark:text-stone-500"
          suppressHydrationWarning
        >
          {t('loading')}
        </div>
      </ScreenEnter>
    </Screen>
  );
}

// ─── INTERACTION STATES ───
// Press feedback + keyboard focus ring, baked into every shared primitive.
// The transition list is scoped (no transform/translate/opacity): a bare
// `transition` would re-ease Motion's per-frame inline styles on motion
// elements that carry PRESS (e.g. Fab) and make their animations lag.
// active:scale-* uses the standalone `scale` property, so it stays animated.
export const PRESS =
  'transition-[scale,color,background-color,border-color,outline-color,box-shadow] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500';
export const PRESS_SM =
  'transition-[scale,color,background-color,border-color,outline-color,box-shadow] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500';
// Press feedback for full-width tappable rows where a scale would look wrong
// (archive rows, popover/dropdown options). Background tint only — never
// opacity (motion rows own their inline opacity).
export const ROW_PRESS = 'cursor-pointer transition-colors active:bg-stone-900/5 dark:active:bg-white/5';

// ─── MOTION ───
// Shared micro-animation vocabulary (~200ms springs). Spread onto motion.*
// elements: <motion.div {...LIST_ROW} key={item.id}>. Global reduced-motion
// gating lives in IntlProvider (MotionConfig reducedMotion="user").
export const SPRING_FAST = { type: 'spring', stiffness: 550, damping: 38 };
export const SPRING_POP = { type: 'spring', stiffness: 800, damping: 30 }; // tiny glyphs, slight overshoot
export const SPRING_SHEET = { type: 'spring', stiffness: 400, damping: 40 }; // softer, for full-height travel (bottom sheet)
// Scale-pop for small glyphs (checkbox ✓ and similar).
export const POP = {
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: SPRING_POP,
};
// Dropdown/popover entrance (entrance-only — callers conditional-render, no exit).
export const POPOVER_POP = {
  initial: { opacity: 0, scale: 0.97, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  transition: SPRING_FAST,
};
// List rows: enter/exit + layout reorder. Needs an <AnimatePresence
// initial={false} mode="popLayout"> around the map and `relative` on the list
// container; keys must be stable DB ids (never array indexes).
export const LIST_ROW = {
  layout: true,
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: SPRING_FAST,
};
// Screen-level entrance — enter-only fade+rise played by PageBody/ScreenEnter
// on mount (tab switches, module sub-screens, auth panes). Screens never
// exit-animate: no AnimatePresence around screens, no mode="wait" latency.
export const SCREEN_ENTER = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: SPRING_FAST,
};
// Entrance for conditionally-appearing chips/small buttons.
export const CHIP_IN = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: SPRING_FAST,
};
// Height accordion (filter strips, collapsible sections). Needs AnimatePresence
// around the conditional and overflow-hidden on the element.
export const COLLAPSE = {
  initial: { height: 0, opacity: 0 },
  animate: { height: 'auto', opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

// True from the second render on — for suppressing a nested ScreenEnter's own
// entrance on the parent's first mount (initial={mounted.current ? undefined : false}).
export function useMounted() {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  return mounted;
}

// Direction tracker for wizards/counters: +1 when the value grew (forward/up),
// -1 when it shrank. Feed the result to StepPane/TickNum.
export function useStepDir(step) {
  const prev = useRef(step);
  const dir = step >= prev.current ? 1 : -1;
  useEffect(() => {
    prev.current = step;
  }, [step]);
  return dir;
}

// Directional wizard pane: the keyed remount slides the new step in from the
// travel direction (enter-only — no exit phase to race autofocus/keyboard).
// Usage: const dir = useStepDir(step); <StepPane step={step} dir={dir}>…
export function StepPane({ step, dir = 1, children, className }) {
  return (
    <motion.div
      key={step}
      initial={{ opacity: 0, x: 24 * dir }}
      animate={{ opacity: 1, x: 0 }}
      transition={SPRING_FAST}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Animated number for steppers/stat counters: the old value slides out and the
// new one slides in along the change direction (odometer feel). popLayout
// positions the exiting span absolutely — hence the relative shell. Offsets
// are em-based so the roll spans the glyph at any text size; tabular-nums
// keeps digit widths stable so ticking never shifts neighbors sideways.
const TICK_VARIANTS = {
  enter: (dir) => ({ y: `${dir * 0.8}em`, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir) => ({ y: `${dir * -0.8}em`, opacity: 0 }),
};

export function TickNum({ value, className }) {
  const dir = useStepDir(value);
  return (
    <span className={cx('relative inline-flex justify-center overflow-hidden tabular-nums', className)}>
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.span
          key={value}
          custom={dir}
          variants={TICK_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={SPRING_POP}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Small inline spinner (loading captions, refresh buttons). CSS-only.
export function Spinner({ className }) {
  return <LoaderCircle aria-hidden className={cx('size-4 animate-spin motion-reduce:animate-none', className)} />;
}

// ─── SELECTABLE CHIP STATES (store tabs, pickers, pills, toggles) ───
export const CHIP_OFF =
  'border-stone-300 bg-white text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400';
// Selected = ink pill (theme-inverting) — the single on-state for all chips.
export const CHIP_ON =
  'border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900';

// Flat list row on the page background — dotted hairline dividers (no cards).
export const ROW_FLAT =
  'flex items-center gap-3 border-b border-dotted border-stone-300 py-3 last:border-b-0 dark:border-stone-700';

// Big letter-spaced household code (join input + settings display).
export const CODE_INPUT =
  'box-border w-full rounded-xl border border-stone-300 bg-white px-4 py-3.5 text-center text-2xl font-bold tracking-[8px] text-stone-900 transition-colors outline-none focus:border-orange-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100';

// Opaque dropdown/popover panel (autocomplete suggestions, menus)
export const POPOVER =
  'rounded-xl border border-stone-200 bg-white p-1 shadow-lg shadow-stone-950/10 dark:border-stone-700 dark:bg-stone-900 dark:shadow-black/40';

// ─── SCROLLABLE CHIP ROW ───
// Edge-fade variants for ScrollChips. mask-image (not a gradient overlay) so
// the fade works on any surface — page background and modal sheet alike.
const FADE_BOTH = '[mask-image:linear-gradient(to_right,transparent,black_28px,black_calc(100%-28px),transparent)]';
const FADE_L = '[mask-image:linear-gradient(to_right,transparent,black_28px)]';
const FADE_R = '[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]';

// One-row horizontal chip scroller (hidden scrollbar); each edge fades only
// while more content is hidden in that direction. Children need shrink-0.
export function ScrollChips({ children, className }) {
  const ref = useRef(null);
  const [fade, setFade] = useState({ l: false, r: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const l = el.scrollLeft > 1;
    const r = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
    setFade((f) => (f.l === l && f.r === r ? f : { l, r }));
  };
  useEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      onScroll={update}
      className={cx(
        'flex [scrollbar-width:none] gap-1.5 overflow-x-auto [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden',
        fade.l && fade.r ? FADE_BOTH : fade.l ? FADE_L : fade.r ? FADE_R : null,
        className,
      )}
    >
      {children}
    </div>
  );
}

// ─── SMALL COMPONENTS ───
export function Pill({ active, color, onClick, children, small }) {
  return (
    <button
      onClick={onClick}
      style={color ? { '--cat': color } : undefined}
      className={cx(
        'shrink-0 cursor-pointer rounded-full border font-semibold whitespace-nowrap',
        PRESS_SM,
        small ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        active ? (color ? 'border-(--cat)/40 bg-(--cat)/13 text-(--cat)' : CHIP_ON) : CHIP_OFF,
      )}
    >
      {children}
    </button>
  );
}

// Outline pill with a leading icon. Defaults to a back chevron + "Nazaj";
// confirm-style actions pass their own icon (e.g. Check) — never a chevron.
export function BackBtn({ onClick, children, className, icon: Icon = ChevronLeft }) {
  const t = useTranslations('Common');
  return (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex cursor-pointer items-center gap-1 rounded-full border border-stone-300 bg-white py-2.5 pr-4 pl-2.5 text-sm font-semibold text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300',
        PRESS,
        className,
      )}
    >
      <Icon className="size-4" />
      {children ?? t('back')}
    </button>
  );
}

export function FC({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-200/70 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-stone-900">
      <div className="mb-1 text-xs font-semibold tracking-[1px] text-stone-400 uppercase dark:text-stone-500">
        {label}
      </div>
      <div className="text-base font-bold text-stone-900 dark:text-stone-100">{value}</div>
    </div>
  );
}

// Filled variants carry a transparent border so every variant is the same
// height — a border-none capsule next to a bordered one sits 2px shorter.
const BTN_VARIANTS = {
  primary: 'bg-stone-900 text-white border border-transparent dark:bg-stone-100 dark:text-stone-900',
  success: 'bg-green-600 text-white border border-transparent',
  danger: 'bg-red-500/10 text-red-600 border border-red-500/25 dark:text-red-400',
  ghost: 'bg-transparent text-stone-500 dark:text-stone-400 border border-stone-300 dark:border-stone-700',
};

export function Btn({ onClick, children, v = 'primary', disabled = false, className }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'w-full cursor-pointer rounded-full p-3.75 text-base font-bold disabled:cursor-default disabled:opacity-40',
        PRESS,
        BTN_VARIANTS[v] || BTN_VARIANTS.primary,
        className,
      )}
    >
      {children}
    </button>
  );
}

// Clickable cards (onClick set) get press feedback + keyboard operability
// automatically. press={false} opts out of the scale — for cards with nested
// buttons, where CSS :active on the ancestor would scale the whole card; such
// cards also skip role="button" (no interactive-inside-interactive ARIA).
export function Card({ children, className, onClick, style, press = true }) {
  const interactive = onClick && press;
  return (
    <div
      onClick={onClick}
      style={style}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={cx(
        'rounded-2xl border border-stone-200/70 bg-white dark:border-white/10 dark:bg-stone-900',
        onClick && 'cursor-pointer',
        interactive && PRESS,
        className,
      )}
    >
      {children}
    </div>
  );
}

// Explicit heights (not padding) so inputs can't drift from the buttons that
// share their row: md = h-12 like square action buttons, xs = h-10.5 like
// compact edit-row controls.
export function Input({ size = 'md', className, ...rest }) {
  const sizes = {
    md: 'h-12 rounded-xl px-4 text-base',
    xs: 'h-10.5 rounded-lg px-3 text-sm',
  };
  return (
    <input
      className={cx(
        // min-w-0 + appearance-none: iOS date inputs otherwise keep their
        // intrinsic width and overflow two-column grids.
        'box-border w-full min-w-0 appearance-none border border-stone-300 bg-white font-medium text-stone-900 transition-colors outline-none placeholder:text-stone-400 focus:border-orange-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100',
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}

export function Label({ children, className }) {
  return (
    <label className={cx('mb-2 block text-sm font-bold text-stone-500 dark:text-stone-400', className)}>
      {children}
    </label>
  );
}

export function SectionHeader({ children, className }) {
  return (
    <div
      className={cx('mb-2.5 text-xs font-bold tracking-[1px] text-stone-400 uppercase dark:text-stone-500', className)}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon, children }) {
  return (
    <div className="py-12 text-center text-stone-400 dark:text-stone-500">
      <div className="mb-3 text-5xl">{icon}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function IconButton({ onClick, children, className, ...rest }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'cursor-pointer rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm leading-none font-semibold text-stone-500 dark:border-white/10 dark:bg-stone-900 dark:text-stone-400',
        PRESS_SM,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Fab({ onClick, children, className, ...rest }) {
  const t = useTranslations('A11y');
  return (
    <motion.button
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={SPRING_FAST}
      onClick={onClick}
      aria-label={t('add')}
      className={cx(
        'fixed right-5 bottom-[calc(88px+env(safe-area-inset-bottom))] z-50 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white shadow-lg shadow-stone-950/25 dark:bg-stone-100 dark:text-stone-900 dark:shadow-black/40',
        PRESS_SM,
        className,
      )}
      {...rest}
    >
      {children ?? <Plus className="size-7" />}
    </motion.button>
  );
}

export function Avatar({ name, size = 32, className }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full bg-stone-800 text-sm font-bold text-stone-100 dark:bg-stone-200 dark:text-stone-900',
        className,
      )}
    >
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// Row of equal-width toggle buttons (language/theme switchers). The ink
// capsule is a shared-layout thumb that slides to the active option.
export function Segmented({ options, value, onChange, className }) {
  const id = useId(); // unique layoutId namespace per instance (settings stacks two)
  return (
    <div className={cx('flex gap-2', className)}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              'relative flex-1 cursor-pointer rounded-full border p-2.5 text-sm font-bold',
              PRESS,
              active ? 'border-transparent' : CHIP_OFF,
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-thumb-${id}`}
                transition={SPRING_FAST}
                aria-hidden
                className="absolute inset-0 rounded-full border border-stone-900 bg-stone-900 dark:border-stone-100 dark:bg-stone-100"
              />
            )}
            <span className={cx('relative z-1 transition-colors', active && 'text-white dark:text-stone-900')}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Badge({ children, className, style }) {
  return (
    <span
      style={style}
      className={cx('inline-block rounded-full border px-2.5 py-1 text-xs font-bold whitespace-nowrap', className)}
    >
      {children}
    </span>
  );
}

// ─── MODAL (bottom sheet) ───
// Portaled to <body> (escapes PageBody's z-1 stacking context — otherwise
// BottomNav paints over modals opened from inside page content). ALWAYS
// mounted and `open`-driven: <Modal open={!!thing} onClose={…}>{thing && …}.
// Every close path — Save/Cancel handlers nulling caller state, backdrop tap,
// dragging the handle down — flips `open` false while the AnimatePresence
// stays mounted, so the slide-down exit plays for all of them (the exiting
// sheet keeps rendering its last-open children). Children render only while
// open, so per-open form components remount naturally; the {thing && …} guard
// is only needed when children JSX dereferences the nullable object. Stacking:
// portal DOM order = JSX order — render ConfirmModal after any Modal it covers.
export function Modal({ open, children, onClose }) {
  const dragControls = useDragControls();
  if (typeof document === 'undefined') return null; // always-mounted portal: no document during SSR
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING_SHEET}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.9 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 800) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border-t border-stone-200 bg-white px-5 pt-6 pb-[calc(36px+env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-stone-900"
          >
            {/* Drag handle — generous touch target around the visual pill */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="-mx-5 -mt-6 cursor-grab touch-none px-5 pt-6 pb-4 active:cursor-grabbing"
            >
              <div className="mx-auto h-1 w-9 rounded-xs bg-stone-300 dark:bg-stone-700" />
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// Save/Cancel pair for bottom-sheet modals. All non-destructive saves share the
// ink capsule; `danger` is the only toned variant.
const ACTION_TONES = {
  primary: 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900',
  danger: 'bg-red-600 text-white',
};

export function ModalActions({
  onSave,
  onCancel,
  saveLabel,
  cancelLabel,
  tone = 'primary',
  disabled = false,
  className,
}) {
  const t = useTranslations('Common');
  return (
    <div className={cx('flex gap-2', className)}>
      <button
        onClick={onSave}
        disabled={disabled}
        className={cx(
          'flex-1 cursor-pointer rounded-full border border-transparent p-3.5 text-base font-bold disabled:cursor-default disabled:opacity-50',
          PRESS,
          ACTION_TONES[tone] || ACTION_TONES.primary,
        )}
      >
        {saveLabel ?? t('save')}
      </button>
      <button
        onClick={onCancel}
        className={cx(
          'flex-1 cursor-pointer rounded-full border border-stone-300 bg-transparent p-3.5 text-base font-semibold text-stone-500 dark:border-stone-700 dark:text-stone-400',
          PRESS,
        )}
      >
        {cancelLabel ?? t('cancel')}
      </button>
    </div>
  );
}

export function ConfirmModal({ action, onClose }) {
  const t = useTranslations('Common');
  return (
    <Modal open={!!action} onClose={onClose}>
      {action && (
        <>
          <p className="mt-1 mb-6 text-center text-base font-semibold text-stone-900 dark:text-stone-100">
            {action.message}
          </p>
          <ModalActions
            tone="danger"
            saveLabel={t('confirm')}
            onSave={async () => {
              await action.onConfirm();
              onClose();
            }}
            onCancel={onClose}
          />
        </>
      )}
    </Modal>
  );
}

// ─── ERROR TOASTER (fed by lib/notify.js) ───
// Messages are usually Errors.* keys (translated at render time, so they follow
// the current locale); unknown strings (e.g. raw DB messages) pass through as-is.
export function Toaster() {
  const t = useTranslations();
  const [toasts, setToasts] = useState([]);
  useEffect(
    () =>
      subscribeToErrors((message) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, message }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
      }),
    [],
  );
  // Container stays mounted while empty (pointer-events-none, harmless) so
  // AnimatePresence can play toast exits.
  return (
    <div className="pointer-events-none fixed top-[calc(12px+env(safe-area-inset-top))] left-1/2 z-300 flex w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={SPRING_FAST}
            onClick={() => setToasts((ts) => ts.filter((x) => x.id !== toast.id))}
            className="pointer-events-auto flex cursor-pointer items-center gap-2.5 rounded-xl border border-red-300 bg-white px-3.5 py-3 text-sm font-semibold text-red-600 shadow-lg shadow-stone-950/10 backdrop-blur-sm dark:border-red-500/40 dark:bg-red-950/95 dark:text-red-300 dark:shadow-black/40"
          >
            <TriangleAlert className="size-4.5 shrink-0" />
            <span className="flex-1">{t.has(toast.message) ? t(toast.message) : toast.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── LOGO / MODE TOGGLE (freezer ↔ shopping) ───
export function LogoToggle({ mode, onToggle }) {
  const t = useTranslations('Nav');
  return (
    <button onClick={onToggle} className={cx('border-none bg-transparent p-0 text-left', PRESS_SM)}>
      <span className="font-serif text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
        {mode === 'freezer' ? 'ZMRZK' : 'TRGOVK'}
        <span className="text-2xl">{mode === 'freezer' ? '❄️' : '🛒'}</span>
      </span>
      <div className="mt-0.5 text-left text-[10px] text-stone-400 dark:text-stone-600">
        {mode === 'freezer' ? t('tapForShopping') : t('tapForFreezer')}
      </div>
    </button>
  );
}

// ─── BOTTOM NAV ───
// Tab names live in the Nav.* messages (rendered as aria-labels — the bar is icon-only).
const NAV_TABS = [
  { id: 'home', Icon: House },
  { id: 'freezer', Icon: Snowflake },
  { id: 'shopping', Icon: ShoppingCart },
  { id: 'calendar', Icon: CalendarDays },
  { id: 'todo', Icon: ListChecks },
];

export function BottomNav({ mode, onNavigate }) {
  const t = useTranslations('Nav');
  return (
    <div className="fixed bottom-0 left-1/2 z-80 flex w-full max-w-[430px] -translate-x-1/2 border-t border-stone-200 bg-stone-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg dark:border-white/10 dark:bg-stone-950/95">
      {NAV_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onNavigate(tab.id)}
          aria-label={t(tab.id)}
          className={cx(
            'flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-none bg-transparent px-1 pt-3 pb-2',
            PRESS_SM,
            mode === tab.id ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400 dark:text-stone-600',
          )}
        >
          <tab.Icon className="size-5.5" strokeWidth={mode === tab.id ? 2.2 : 1.8} />
          {/* Shared-layout dot slides between tabs (BottomNav stays mounted
              across mode switches — see AppShell's single return) */}
          {mode === tab.id ? (
            <motion.span
              layoutId="nav-dot"
              transition={SPRING_FAST}
              aria-hidden
              className="h-1 w-1 rounded-full bg-orange-500"
            />
          ) : (
            <span aria-hidden className="h-1 w-1" />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── SWIPEABLE ROW ───
// Motion drag: 1:1 finger tracking leftwards only (elastic 0 to the right),
// automatic spring snap-back below the archive threshold. Vertical scroll
// keeps working — drag="x" sets touch-action: pan-y. Children must have an
// opaque page-colored bg so the green reveal layer stays hidden at rest.
export function SwipeCard({ children, onSwipeLeft, onClick }) {
  const t = useTranslations('Freezer');
  const x = useMotionValue(0);
  // Green "used" layer fades in as the card is pulled left.
  const revealOpacity = useTransform(x, [-60, -25], [1, 0]);
  const dragging = useRef(false);
  // Imperative animate() below doesn't read MotionConfig — gate it here.
  const reducedMotion = useReducedMotion();

  const handleDragEnd = async (_, info) => {
    // The synthetic click fires after pointerup — clear the guard a frame later.
    requestAnimationFrame(() => (dragging.current = false));
    const archive = onSwipeLeft && (info.offset.x < -80 || (info.offset.x < -40 && info.velocity.x < -600));
    if (!archive) return; // the drag system springs back to constraints on its own
    // Continue the fling off-screen, inheriting the gesture velocity.
    animate(
      x,
      -430,
      reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 40, velocity: info.velocity.x },
    );
    await onSwipeLeft();
    // Realtime removal unmounts the row shortly after. If the write failed
    // (error toast), the card is still mounted — spring it back. If the row
    // is already gone, animating the orphaned MotionValue is a no-op.
    setTimeout(() => animate(x, 0, SPRING_FAST), 1200);
  };

  return (
    <div className="relative overflow-hidden">
      {/* Green background revealed on swipe */}
      <motion.div
        style={{ opacity: revealOpacity }}
        className="absolute top-0 right-0 bottom-0 flex w-30 items-center justify-end bg-linear-to-r from-transparent to-green-600 pr-5"
      >
        <span className="text-sm font-extrabold text-white">{t('usedSwipe')}</span>
      </motion.div>
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 1, right: 0 }}
        dragTransition={{ bounceStiffness: 550, bounceDamping: 38 }}
        style={{ x }}
        onDragStart={() => (dragging.current = true)}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (!dragging.current && onClick) onClick();
        }}
        className="relative z-1"
      >
        {children}
      </motion.div>
    </div>
  );
}
