'use client';
import { useState, useEffect, useRef } from "react";
import { subscribeToErrors } from '@/lib/notify';
import { cx } from '@/lib/utils';

// ─── APP FRAME ───
// Full-height app container with the themed gradient background and the
// two decorative glow blobs. `center` is used by loading/auth screens.
export function Screen({ children, center = false, onClick, glow2 = "bg-radial from-indigo-500/10 to-transparent to-70% dark:from-indigo-500/6" }) {
  return (
    <div onClick={onClick} className={cx("max-w-[430px] mx-auto min-h-screen relative overflow-hidden bg-linear-to-b from-indigo-50 via-indigo-100 via-40% to-indigo-50 dark:from-slate-950 dark:via-gray-900 dark:to-slate-900 text-slate-800 dark:text-slate-200", center && "flex items-center justify-center")}>
      <div className="absolute -top-15 -right-15 w-50 h-50 bg-radial from-sky-400/15 to-transparent to-70% dark:from-sky-400/8 rounded-full pointer-events-none" />
      <div className={cx("absolute bottom-25 -left-20 w-62.5 h-62.5 rounded-full pointer-events-none", glow2)} />
      {children}
    </div>
  );
}

// Full-screen brand loader (auth + data loading gates).
export function Loader() {
  return (
    <Screen center>
      <div className="text-center">
        <div className="text-6xl mb-4">🏠</div>
        <div className="text-3xl font-black"><span className="bg-linear-135 from-slate-800 to-violet-300 dark:from-slate-200 bg-clip-text text-transparent">Cožy</span></div>
        <div className="text-slate-300 dark:text-slate-600 mt-2 text-sm">Nalagam...</div>
      </div>
    </Screen>
  );
}

// ─── SMALL COMPONENTS ───
export function Pill({ active, color, onClick, children, small }) {
  return (
    <button
      onClick={onClick}
      style={color ? { "--cat": color } : undefined}
      className={cx(
        "rounded-full border font-semibold cursor-pointer whitespace-nowrap shrink-0",
        small ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
        active
          ? (color ? "border-(--cat)/50 bg-(--cat)/13 text-(--cat)" : "border-sky-400/50 bg-sky-400/15 text-sky-400")
          : "border-indigo-500/20 dark:border-slate-600/30 bg-white/70 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"
      )}
    >{children}</button>
  );
}

export function FC({ label, value }) {
  return (
    <div className="bg-white/80 dark:bg-slate-800/60 rounded-xl px-4 py-3.5 border border-indigo-500/15 dark:border-slate-600/20">
      <div className="text-xs text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-[1px] font-semibold">{label}</div>
      <div className="text-base font-bold text-slate-800 dark:text-slate-200">{value}</div>
    </div>
  );
}

const BTN_VARIANTS = {
  primary: "bg-linear-135 from-sky-500 to-indigo-500 text-white border-none",
  success: "bg-linear-135 from-green-500 to-emerald-600 text-white border-none",
  danger: "bg-red-500/12 text-red-500 border border-red-500/30",
  ghost: "bg-transparent text-slate-400 dark:text-slate-500 border border-indigo-500/20 dark:border-slate-600/30",
};

export function Btn({ onClick, children, v = "primary", disabled = false, className }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={cx("w-full p-3.75 rounded-xl text-base font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default", BTN_VARIANTS[v] || BTN_VARIANTS.primary, className)}
    >{children}</button>
  );
}

export function Card({ children, className, onClick, style }) {
  return <div onClick={onClick} style={style} className={cx("bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-2xl", className)}>{children}</div>;
}

export function Input({ size = "md", className, ...rest }) {
  const sizes = {
    md: "px-4 py-3.5 rounded-xl text-base",
    sm: "px-3.5 py-3 rounded-xl text-base",
    xs: "px-3 py-2.5 rounded-lg text-sm",
  };
  return <input className={cx("w-full box-border bg-white/90 dark:bg-slate-800/80 border border-indigo-500/25 dark:border-indigo-500/30 text-slate-800 dark:text-slate-200 outline-none font-medium", sizes[size], className)} {...rest} />;
}

export function Label({ children, className }) {
  return <label className={cx("block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2", className)}>{children}</label>;
}

export function SectionHeader({ children, className }) {
  return <div className={cx("text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[1px] mb-2.5", className)}>{children}</div>;
}

export function EmptyState({ icon, children }) {
  return (
    <div className="text-center py-12 text-slate-400 dark:text-slate-500">
      <div className="text-5xl mb-3">{icon}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export function IconButton({ onClick, children, className }) {
  return (
    <button onClick={onClick} className={cx("bg-white/80 dark:bg-slate-800/60 border border-indigo-500/15 dark:border-slate-600/20 rounded-lg px-2.5 py-2 text-slate-400 dark:text-slate-500 text-sm font-semibold leading-none cursor-pointer", className)}>
      {children}
    </button>
  );
}

export function Fab({ onClick, children = "+", className }) {
  return (
    <button
      onClick={onClick}
      className={cx("fixed bottom-[calc(74px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-15.5 h-15.5 rounded-full border-none bg-linear-135 from-sky-500 to-indigo-500 text-white text-3xl font-light cursor-pointer shadow-xl shadow-sky-500/40 ring-4 ring-sky-500/10 flex items-center justify-center z-50", className)}
    >{children}</button>
  );
}

export function Avatar({ name, size = 32, className }) {
  return (
    <div style={{ width: size, height: size }} className={cx("rounded-full bg-linear-135 from-sky-500 to-indigo-500 flex items-center justify-center text-sm font-bold text-white shrink-0", className)}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

// Row of equal-width toggle buttons (language/theme switchers).
const SEG_ACTIVE = {
  sky: "border-sky-400/50 bg-sky-400/12 text-sky-400",
  indigo: "border-indigo-500/50 bg-indigo-500/15 text-indigo-400",
};

export function Segmented({ options, value, onChange, tone = "sky", className }) {
  return (
    <div className={cx("flex gap-2", className)}>
      {options.map(o => (
        <button
          key={o.value} onClick={() => onChange(o.value)}
          className={cx("flex-1 p-2.5 rounded-xl border font-bold text-sm cursor-pointer",
            value === o.value ? (SEG_ACTIVE[tone] || SEG_ACTIVE.sky) : "border-indigo-500/20 dark:border-slate-600/30 bg-white/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400")}
        >{o.label}</button>
      ))}
    </div>
  );
}

export function Badge({ children, className, style }) {
  return <span style={style} className={cx("inline-block text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap", className)}>{children}</span>;
}

// ─── MODAL (bottom sheet) ───
export function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-100">
      <div onClick={e => e.stopPropagation()} className="bg-linear-to-b from-white to-indigo-50 dark:from-slate-800 dark:to-slate-900 rounded-t-3xl w-full max-w-[430px] pt-6 px-5 pb-9 border border-indigo-500/20 dark:border-slate-600/30 border-b-0 max-h-[85vh] overflow-y-auto">
        <div className="w-9 h-1 bg-slate-300 dark:bg-slate-700 rounded-xs mx-auto mb-5" />
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ action, onClose }) {
  if (!action) return null;
  return (
    <Modal onClose={onClose}>
      <p className="text-base font-semibold text-slate-800 dark:text-slate-200 text-center mb-6 mt-1">{action.message}</p>
      <div className="flex gap-2.5">
        <button onClick={async () => { await action.onConfirm(); onClose(); }} className="flex-1 p-3.5 rounded-xl border-none bg-linear-135 from-red-500 to-red-600 text-white text-base font-bold cursor-pointer">Potrdi</button>
        <button onClick={onClose} className="flex-1 p-3.5 rounded-xl border border-indigo-500/20 dark:border-slate-600/30 bg-transparent text-slate-500 dark:text-slate-400 text-base font-semibold cursor-pointer">Prekliči</button>
      </div>
    </Modal>
  );
}

// ─── ERROR TOASTER (fed by lib/notify.js) ───
export function Toaster() {
  const [toasts, setToasts] = useState([]);
  useEffect(() => subscribeToErrors(message => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }), []);
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-[calc(12px+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-[398px] flex flex-col gap-2 z-300 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} className="pointer-events-auto flex items-center gap-2.5 py-3 px-3.5 bg-red-950/95 border border-red-500/40 rounded-xl text-red-300 text-sm font-semibold shadow-lg shadow-black/40 cursor-pointer backdrop-blur-sm">
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
    <button onClick={onToggle} className="bg-transparent border-none cursor-pointer p-0 text-left">
      {mode === "freezer" ? (
        <span className="text-3xl font-black tracking-[-0.5px]">
          <span className="bg-linear-135 from-slate-800 to-sky-400 dark:from-slate-200 bg-clip-text text-transparent">ZMRZK</span>
          <span className="text-sky-400">❄️</span>
        </span>
      ) : (
        <span className="text-3xl font-black tracking-[-0.5px]">
          <span className="bg-linear-135 from-slate-800 to-amber-500 dark:from-slate-200 bg-clip-text text-transparent">TRGOVK</span>
          <span>🛒</span>
        </span>
      )}
      <div className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5 text-left">
        Tapni za {mode === "freezer" ? "nakupovalni seznam" : "zamrzovalnik"}
      </div>
    </button>
  );
}

// ─── BOTTOM NAV ───
const NAV_TABS = [
  { id: "home",     icon: "🏠", label: "Dom" },
  { id: "freezer",  icon: "❄️", label: "Zmrzko" },
  { id: "shopping", icon: "🛒", label: "Nakupi" },
  { id: "calendar", icon: "📅", label: "Koledar" },
  { id: "todo",     icon: "✅", label: "Opravila" },
];

export function BottomNav({ mode, onNavigate }) {
  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white/97 dark:bg-slate-950/97 backdrop-blur-lg border-t border-indigo-500/15 dark:border-slate-600/20 flex pb-[env(safe-area-inset-bottom)] z-80">
      {NAV_TABS.map(tab => (
        <button
          key={tab.id} onClick={() => onNavigate(tab.id)}
          className={cx("flex-1 flex items-center justify-center py-3.5 px-1 bg-transparent border-none cursor-pointer transition-colors duration-150", mode === tab.id ? "text-violet-300" : "text-slate-300 dark:text-slate-600")}
        >
          <span className={cx("text-2xl leading-none", mode !== tab.id && "grayscale-30")}>{tab.icon}</span>
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

  const onTouchStart = e => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    moved.current = false;
    setSwiping(true);
  };
  const onTouchMove = e => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = Math.abs(e.touches[0].clientY - startY.current);
    if (dy > 30 && !moved.current) { setSwiping(false); return; }
    if (dx < -10) moved.current = true;
    setOffsetX(Math.min(0, dx));
  };
  const onTouchEnd = () => {
    setSwiping(false);
    if (offsetX < -80 && onSwipeLeft) {
      setOffsetX(-200);
      setTimeout(() => { onSwipeLeft(); setOffsetX(0); }, 200);
    } else {
      setOffsetX(0);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Green background revealed on swipe */}
      <div className={cx("absolute right-0 top-0 bottom-0 w-30 bg-linear-to-r from-transparent to-green-500 flex items-center justify-end pr-5 rounded-r-2xl transition-opacity duration-150", offsetX < -30 ? "opacity-100" : "opacity-0")}>
        <span className="text-white font-extrabold text-sm">✓ Porabljeno</span>
      </div>
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={() => { if (!moved.current && onClick) onClick(); }}
        className="relative z-1"
        style={{ transform: `translateX(${offsetX}px)`, transition: swiping ? "none" : "transform 0.25s ease" }}
      >
        {children}
      </div>
    </div>
  );
}
