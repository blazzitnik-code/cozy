'use client';
import { useState, useEffect, useRef } from 'react';
import { subscribeToErrors } from '@/lib/notify';
import { cx } from '@/lib/utils';

// ─── APP FRAME ───
// Full-height app container with the themed gradient background and the
// two decorative glow blobs. `center` is used by loading/auth screens.
export function Screen({
  children,
  center = false,
  onClick,
  glow2 = 'bg-radial from-indigo-500/10 to-transparent to-70% dark:from-indigo-500/6',
}) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'relative mx-auto min-h-screen max-w-[430px] overflow-hidden bg-linear-to-b from-indigo-50 via-indigo-100 via-40% to-indigo-50 text-slate-800 dark:from-slate-950 dark:via-gray-900 dark:to-slate-900 dark:text-slate-200',
        center && 'flex items-center justify-center',
      )}
    >
      <div className="pointer-events-none absolute -top-15 -right-15 h-50 w-50 rounded-full bg-radial from-sky-400/15 to-transparent to-70% dark:from-sky-400/8" />
      <div className={cx('pointer-events-none absolute bottom-25 -left-20 h-62.5 w-62.5 rounded-full', glow2)} />
      {children}
    </div>
  );
}

// Full-screen brand loader (auth + data loading gates).
export function Loader() {
  return (
    <Screen center>
      <div className="text-center">
        <div className="mb-4 text-6xl">🏠</div>
        <div className="text-3xl font-black">
          <span className="bg-linear-135 from-slate-800 to-violet-300 bg-clip-text text-transparent dark:from-slate-200">
            Cožy
          </span>
        </div>
        <div className="mt-2 text-sm text-slate-300 dark:text-slate-600">Nalagam...</div>
      </div>
    </Screen>
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
        small ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        active
          ? color
            ? 'border-(--cat)/50 bg-(--cat)/13 text-(--cat)'
            : 'border-sky-400/50 bg-sky-400/15 text-sky-400'
          : 'border-indigo-500/20 bg-white/70 text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/50 dark:text-slate-400',
      )}
    >
      {children}
    </button>
  );
}

export function FC({ label, value }) {
  return (
    <div className="rounded-xl border border-indigo-500/15 bg-white/80 px-4 py-3.5 dark:border-slate-600/20 dark:bg-slate-800/60">
      <div className="mb-1 text-xs font-semibold tracking-[1px] text-slate-400 uppercase dark:text-slate-500">
        {label}
      </div>
      <div className="text-base font-bold text-slate-800 dark:text-slate-200">{value}</div>
    </div>
  );
}

const BTN_VARIANTS = {
  primary: 'bg-linear-135 from-sky-500 to-indigo-500 text-white border-none',
  success: 'bg-linear-135 from-green-500 to-emerald-600 text-white border-none',
  danger: 'bg-red-500/12 text-red-500 border border-red-500/30',
  ghost: 'bg-transparent text-slate-400 dark:text-slate-500 border border-indigo-500/20 dark:border-slate-600/30',
};

export function Btn({ onClick, children, v = 'primary', disabled = false, className }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'w-full cursor-pointer rounded-xl p-3.75 text-base font-bold disabled:cursor-default disabled:opacity-40',
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
        'rounded-2xl border border-indigo-500/15 bg-white/80 dark:border-slate-600/20 dark:bg-slate-800/60',
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
        'box-border w-full border border-indigo-500/25 bg-white/90 font-medium text-slate-800 outline-none dark:border-indigo-500/30 dark:bg-slate-800/80 dark:text-slate-200',
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}

export function Label({ children, className }) {
  return (
    <label className={cx('mb-2 block text-sm font-bold text-slate-500 dark:text-slate-400', className)}>
      {children}
    </label>
  );
}

export function SectionHeader({ children, className }) {
  return (
    <div
      className={cx('mb-2.5 text-xs font-bold tracking-[1px] text-slate-400 uppercase dark:text-slate-500', className)}
    >
      {children}
    </div>
  );
}

export function EmptyState({ icon, children }) {
  return (
    <div className="py-12 text-center text-slate-400 dark:text-slate-500">
      <div className="mb-3 text-5xl">{icon}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function IconButton({ onClick, children, className }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'cursor-pointer rounded-lg border border-indigo-500/15 bg-white/80 px-2.5 py-2 text-sm leading-none font-semibold text-slate-400 dark:border-slate-600/20 dark:bg-slate-800/60 dark:text-slate-500',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Fab({ onClick, children = '+', className }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'fixed bottom-[calc(74px+env(safe-area-inset-bottom))] left-1/2 z-50 flex h-15.5 w-15.5 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border-none bg-linear-135 from-sky-500 to-indigo-500 text-3xl font-light text-white shadow-xl ring-4 shadow-sky-500/40 ring-sky-500/10',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Avatar({ name, size = 32, className }) {
  return (
    <div
      style={{ width: size, height: size }}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-full bg-linear-135 from-sky-500 to-indigo-500 text-sm font-bold text-white',
        className,
      )}
    >
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

// Row of equal-width toggle buttons (language/theme switchers).
const SEG_ACTIVE = {
  sky: 'border-sky-400/50 bg-sky-400/12 text-sky-400',
  indigo: 'border-indigo-500/50 bg-indigo-500/15 text-indigo-400',
};

export function Segmented({ options, value, onChange, tone = 'sky', className }) {
  return (
    <div className={cx('flex gap-2', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 cursor-pointer rounded-xl border p-2.5 text-sm font-bold',
            value === o.value
              ? SEG_ACTIVE[tone] || SEG_ACTIVE.sky
              : 'border-indigo-500/20 bg-white/80 text-slate-500 dark:border-slate-600/30 dark:bg-slate-800/60 dark:text-slate-400',
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
export function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-100 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border border-b-0 border-indigo-500/20 bg-linear-to-b from-white to-indigo-50 px-5 pt-6 pb-9 dark:border-slate-600/30 dark:from-slate-800 dark:to-slate-900"
      >
        <div className="mx-auto mb-5 h-1 w-9 rounded-xs bg-slate-300 dark:bg-slate-700" />
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ action, onClose }) {
  if (!action) return null;
  return (
    <Modal onClose={onClose}>
      <p className="mt-1 mb-6 text-center text-base font-semibold text-slate-800 dark:text-slate-200">
        {action.message}
      </p>
      <div className="flex gap-2.5">
        <button
          onClick={async () => {
            await action.onConfirm();
            onClose();
          }}
          className="flex-1 cursor-pointer rounded-xl border-none bg-linear-135 from-red-500 to-red-600 p-3.5 text-base font-bold text-white"
        >
          Potrdi
        </button>
        <button
          onClick={onClose}
          className="flex-1 cursor-pointer rounded-xl border border-indigo-500/20 bg-transparent p-3.5 text-base font-semibold text-slate-500 dark:border-slate-600/30 dark:text-slate-400"
        >
          Prekliči
        </button>
      </div>
    </Modal>
  );
}

// ─── ERROR TOASTER (fed by lib/notify.js) ───
export function Toaster() {
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
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed top-[calc(12px+env(safe-area-inset-top))] left-1/2 z-300 flex w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
          className="pointer-events-auto flex cursor-pointer items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-950/95 px-3.5 py-3 text-sm font-semibold text-red-300 shadow-lg shadow-black/40 backdrop-blur-sm"
        >
          <span className="text-base">⚠️</span>
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── LOGO / MODE TOGGLE (freezer ↔ shopping) ───
export function LogoToggle({ mode, onToggle }) {
  return (
    <button onClick={onToggle} className="cursor-pointer border-none bg-transparent p-0 text-left">
      {mode === 'freezer' ? (
        <span className="text-3xl font-black tracking-[-0.5px]">
          <span className="bg-linear-135 from-slate-800 to-sky-400 bg-clip-text text-transparent dark:from-slate-200">
            ZMRZK
          </span>
          <span className="text-sky-400">❄️</span>
        </span>
      ) : (
        <span className="text-3xl font-black tracking-[-0.5px]">
          <span className="bg-linear-135 from-slate-800 to-amber-500 bg-clip-text text-transparent dark:from-slate-200">
            TRGOVK
          </span>
          <span>🛒</span>
        </span>
      )}
      <div className="mt-0.5 text-left text-[10px] text-slate-300 dark:text-slate-600">
        Tapni za {mode === 'freezer' ? 'nakupovalni seznam' : 'zamrzovalnik'}
      </div>
    </button>
  );
}

// ─── BOTTOM NAV ───
const NAV_TABS = [
  { id: 'home', icon: '🏠', label: 'Dom' },
  { id: 'freezer', icon: '❄️', label: 'Zmrzko' },
  { id: 'shopping', icon: '🛒', label: 'Nakupi' },
  { id: 'calendar', icon: '📅', label: 'Koledar' },
  { id: 'todo', icon: '✅', label: 'Opravila' },
];

export function BottomNav({ mode, onNavigate }) {
  return (
    <div className="fixed bottom-0 left-1/2 z-80 flex w-full max-w-[430px] -translate-x-1/2 border-t border-indigo-500/15 bg-white/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg dark:border-slate-600/20 dark:bg-slate-950/97">
      {NAV_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onNavigate(tab.id)}
          className={cx(
            'flex flex-1 cursor-pointer items-center justify-center border-none bg-transparent px-1 py-3.5 transition-colors duration-150',
            mode === tab.id ? 'text-violet-300' : 'text-slate-300 dark:text-slate-600',
          )}
        >
          <span className={cx('text-2xl leading-none', mode !== tab.id && 'grayscale-30')}>{tab.icon}</span>
        </button>
      ))}
    </div>
  );
}

// ─── SWIPEABLE CARD ───
export function SwipeCard({ children, onSwipeLeft, onClick }) {
  const [offsetX, setOffsetX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const moved = useRef(false);

  const onTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    moved.current = false;
    setSwiping(true);
  };
  const onTouchMove = (e) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (dy > 30 && !moved.current) {
      setSwiping(false);
      return;
    }
    if (dx < -10) moved.current = true;
    setOffsetX(Math.min(0, dx));
  };
  const onTouchEnd = () => {
    setSwiping(false);
    if (offsetX < -80 && onSwipeLeft) {
      setOffsetX(-200);
      setTimeout(() => {
        onSwipeLeft();
        setOffsetX(0);
      }, 200);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Green background revealed on swipe */}
      <div
        className={cx(
          'absolute top-0 right-0 bottom-0 flex w-30 items-center justify-end rounded-r-2xl bg-linear-to-r from-transparent to-green-500 pr-5 transition-opacity duration-150',
          offsetX < -30 ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span className="text-sm font-extrabold text-white">✓ Porabljeno</span>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (!moved.current && onClick) onClick();
        }}
        className="relative z-1"
        style={{ transform: `translateX(${offsetX}px)`, transition: swiping ? 'none' : 'transform 0.25s ease' }}
      >
        {children}
      </div>
    </div>
  );
}
