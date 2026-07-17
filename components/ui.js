'use client';
import { useState, useEffect, useRef } from 'react';
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
        'relative mx-auto min-h-screen max-w-[430px] overflow-hidden bg-stone-100 text-stone-900 dark:bg-stone-950 dark:text-stone-100',
        center && 'flex items-center justify-center',
      )}
    >
      {children}
    </div>
  );
}

// Standard page content wrapper inside <Screen> (nav-safe bottom padding).
export function PageBody({ children, className }) {
  return (
    <div className={cx('relative z-1 px-4 pt-4 pb-[calc(100px+env(safe-area-inset-bottom))]', className)}>
      {children}
    </div>
  );
}

// Serif brand wordmark — the single source for "Cožy" (login, loader, home).
export function Wordmark({ className }) {
  return (
    <span className={cx('font-serif font-semibold tracking-tight text-stone-900 dark:text-stone-100', className)}>
      Cožy
    </span>
  );
}

// Full-screen brand loader (auth + data loading gates).
export function Loader() {
  const t = useTranslations('Common');
  return (
    <Screen center>
      <div className="text-center">
        <div className="mb-4 text-6xl">🏠</div>
        <Wordmark className="text-4xl" />
        {/* suppressHydrationWarning: this is the only text that hydrates against
            server HTML — SSR always renders sl, the client may load en */}
        <div className="mt-2 text-sm text-stone-400 dark:text-stone-500" suppressHydrationWarning>
          {t('loading')}
        </div>
      </div>
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

export function BackBtn({ onClick, children, className }) {
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
      <ChevronLeft className="size-4" />
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

const BTN_VARIANTS = {
  primary: 'bg-stone-900 text-white border-none dark:bg-stone-100 dark:text-stone-900',
  success: 'bg-green-600 text-white border-none',
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

export function Card({ children, className, onClick, style }) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={cx(
        'rounded-2xl border border-stone-200/70 bg-white dark:border-white/10 dark:bg-stone-900',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Input({ size = 'md', className, ...rest }) {
  const sizes = {
    md: 'px-4 py-3.5 rounded-xl text-base',
    sm: 'px-3.5 py-3 rounded-xl text-base',
    xs: 'px-3 py-2.5 rounded-lg text-sm',
  };
  return (
    <input
      className={cx(
        'box-border w-full border border-stone-300 bg-white font-medium text-stone-900 transition-colors outline-none placeholder:text-stone-400 focus:border-orange-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100',
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
        'fixed bottom-[calc(74px+env(safe-area-inset-bottom))] left-1/2 z-50 flex h-15.5 w-15.5 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-stone-900 text-white shadow-lg shadow-stone-950/25 dark:bg-stone-100 dark:text-stone-900 dark:shadow-black/40',
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

// Row of equal-width toggle buttons (language/theme switchers).
export function Segmented({ options, value, onChange, className }) {
  return (
    <div className={cx('flex gap-2', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 cursor-pointer rounded-full border p-2.5 text-sm font-bold',
            PRESS,
            value === o.value ? CHIP_ON : CHIP_OFF,
          )}
        >
          {o.label}
        </button>
      ))}
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
// BottomNav paints over modals opened from inside page content). Slides up
// from below; backdrop tap and dragging the handle down dismiss it WITH the
// exit animation: internal `open` state drives an inner AnimatePresence and
// onExitComplete calls onClose() once the sheet is off-screen. Closes via
// caller state (ModalActions Save/Cancel) stay instant by design — do not
// wrap call sites in AnimatePresence.
export function Modal({ children, onClose }) {
  const [open, setOpen] = useState(true);
  const dragControls = useDragControls();
  const dismiss = () => setOpen(false);
  return createPortal(
    <AnimatePresence onExitComplete={onClose}>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={dismiss}
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
              if (info.offset.y > 100 || info.velocity.y > 800) dismiss();
            }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border-t border-stone-200 bg-white px-5 pt-6 pb-[calc(36px+env(safe-area-inset-bottom))] dark:border-white/10 dark:bg-stone-900"
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
          'flex-1 cursor-pointer rounded-full border-none p-3.5 text-base font-bold disabled:cursor-default disabled:opacity-50',
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
  if (!action) return null;
  return (
    <Modal onClose={onClose}>
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
    <button onClick={onToggle} className="cursor-pointer border-none bg-transparent p-0 text-left">
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
            'flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-none bg-transparent px-1 pt-3 pb-2 transition-colors duration-150',
            mode === tab.id ? 'text-stone-900 dark:text-stone-100' : 'text-stone-400 dark:text-stone-600',
          )}
        >
          <tab.Icon className="size-5.5" strokeWidth={mode === tab.id ? 2.2 : 1.8} />
          <span className={cx('h-1 w-1 rounded-full bg-orange-500', mode === tab.id ? 'opacity-100' : 'opacity-0')} />
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
