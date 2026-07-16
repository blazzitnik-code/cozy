'use client';
import { useState, useEffect, useRef } from "react";
import { subscribeToErrors } from '@/lib/notify';
import { cx } from '@/lib/utils';

// ─── APP FRAME ───
// Full-height app container with the themed gradient background and the
// two decorative glow blobs. `center` is used by loading/auth screens.
export function Screen({ children, center = false, onClick, glow2 = "bg-glow-2" }) {
  return (
    <div onClick={onClick} className={cx("max-w-app mx-auto min-h-screen relative overflow-hidden bg-app text-ink font-sans", center && "flex items-center justify-center")}>
      <div className="absolute -top-15 -right-15 w-50 h-50 bg-glow-1 rounded-full pointer-events-none" />
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
        <div className="text-64 mb-4">🏠</div>
        <div className="text-28 font-black"><span className="bg-grad-brand-app text-gradient">Cožy</span></div>
        <div className="text-ink-dim mt-2 text-14">Nalagam...</div>
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
        "rounded-20 border font-semibold cursor-pointer whitespace-nowrap shrink-0",
        small ? "px-2.5 py-1.5 text-12" : "px-3.5 py-2 text-13",
        active
          ? (color ? "border-(--cat)/50 bg-(--cat)/13 text-(--cat)" : "border-accent/50 bg-accent/15 text-accent")
          : "border-line-strong bg-surface-2 text-ink-2"
      )}
    >{children}</button>
  );
}

export function FC({ label, value }) {
  return (
    <div className="bg-surface rounded-14 px-4 py-3.5 border border-line">
      <div className="text-11 text-ink-3 mb-1 uppercase tracking-[1px] font-semibold">{label}</div>
      <div className="text-15 font-bold text-ink">{value}</div>
    </div>
  );
}

const BTN_VARIANTS = {
  primary: "bg-grad-primary text-white border-none",
  success: "bg-grad-success text-white border-none",
  danger: "bg-danger/12 text-danger border border-danger/30",
  ghost: "bg-transparent text-ink-3 border border-line-strong",
};

export function Btn({ onClick, children, v = "primary", disabled = false, className, style }) {
  return (
    <button
      onClick={onClick} disabled={disabled} style={style}
      className={cx("w-full p-3.75 rounded-14 text-16 font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default", BTN_VARIANTS[v] || BTN_VARIANTS.primary, className)}
    >{children}</button>
  );
}

export function Card({ children, className, onClick, style }) {
  return <div onClick={onClick} style={style} className={cx("bg-surface border border-line rounded-16", className)}>{children}</div>;
}

export function Input({ size = "md", className, ...rest }) {
  const sizes = {
    md: "px-4 py-3.5 rounded-14 text-16",
    sm: "px-3.5 py-3 rounded-12 text-15",
    xs: "px-3 py-2.5 rounded-10 text-14",
  };
  return <input className={cx("w-full box-border bg-field border border-field-line text-ink outline-none font-medium", sizes[size], className)} {...rest} />;
}

export function Label({ children, className }) {
  return <label className={cx("block text-13 font-bold text-ink-2 mb-2", className)}>{children}</label>;
}

export function SectionHeader({ children, className }) {
  return <div className={cx("text-11 font-bold text-ink-3 uppercase tracking-[1px] mb-2.5", className)}>{children}</div>;
}

export function EmptyState({ icon, children }) {
  return (
    <div className="text-center py-12 text-ink-3">
      <div className="text-48 mb-3">{icon}</div>
      <div className="text-14">{children}</div>
    </div>
  );
}

export function IconButton({ onClick, children, className }) {
  return (
    <button onClick={onClick} className={cx("bg-surface border border-line rounded-10 px-2.5 py-2 text-ink-3 text-14 font-semibold leading-none cursor-pointer", className)}>
      {children}
    </button>
  );
}

export function Fab({ onClick, children = "+", className }) {
  return (
    <button
      onClick={onClick}
      className={cx("fixed bottom-[calc(74px+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[62px] h-[62px] rounded-full border-none bg-grad-primary text-white text-30 font-light cursor-pointer shadow-fab flex items-center justify-center z-50", className)}
    >{children}</button>
  );
}

export function Avatar({ name, size = 32, className }) {
  return (
    <div style={{ width: size, height: size }} className={cx("rounded-full bg-grad-primary flex items-center justify-center text-14 font-bold text-white shrink-0", className)}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

// Row of equal-width toggle buttons (language/theme switchers).
const SEG_ACTIVE = {
  sky: "border-accent/50 bg-accent/12 text-accent",
  indigo: "border-accent-2/50 bg-accent-2/15 text-accent-3",
};

export function Segmented({ options, value, onChange, tone = "sky", className }) {
  return (
    <div className={cx("flex gap-2", className)}>
      {options.map(o => (
        <button
          key={o.value} onClick={() => onChange(o.value)}
          className={cx("flex-1 p-2.5 rounded-12 border font-bold text-14 cursor-pointer",
            value === o.value ? (SEG_ACTIVE[tone] || SEG_ACTIVE.sky) : "border-line-strong bg-surface text-ink-2")}
        >{o.label}</button>
      ))}
    </div>
  );
}

export function Badge({ children, className, style }) {
  return <span style={style} className={cx("inline-block text-11 font-bold px-2.5 py-1 rounded-20 border whitespace-nowrap", className)}>{children}</span>;
}

// ─── MODAL (bottom sheet) ───
export function Modal({ children, onClose }) {
  return (
    <div onClick={onClose} className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-end justify-center z-100">
      <div onClick={e => e.stopPropagation()} className="bg-modal rounded-t-24 w-full max-w-app pt-6 px-5 pb-9 border border-line-strong border-b-0 max-h-[85vh] overflow-y-auto">
        <div className="w-9 h-1 bg-handle rounded-2 mx-auto mb-5" />
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({ action, onClose }) {
  if (!action) return null;
  return (
    <Modal onClose={onClose}>
      <p className="text-16 font-semibold text-ink text-center mb-6 mt-1">{action.message}</p>
      <div className="flex gap-2.5">
        <button onClick={async () => { await action.onConfirm(); onClose(); }} className="flex-1 p-3.5 rounded-14 border-none bg-grad-danger text-white text-15 font-bold cursor-pointer">Potrdi</button>
        <button onClick={onClose} className="flex-1 p-3.5 rounded-14 border border-line-strong bg-transparent text-ink-2 text-15 font-semibold cursor-pointer">Prekliči</button>
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
        <div key={t.id} onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} className="pointer-events-auto flex items-center gap-2.5 py-3 px-3.5 bg-toast border border-toast-line rounded-14 text-toast-ink text-14 font-semibold shadow-pop cursor-pointer backdrop-blur-sm">
          <span className="text-16">⚠️</span>
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
        <span className="text-28 font-black tracking-[-0.5px]">
          <span className="bg-grad-brand-freeze text-gradient">ZMRZK</span>
          <span className="text-accent">❄️</span>
        </span>
      ) : (
        <span className="text-28 font-black tracking-[-0.5px]">
          <span className="bg-grad-brand-shop text-gradient">TRGOVK</span>
          <span>🛒</span>
        </span>
      )}
      <div className="text-10 text-ink-dim mt-0.5 text-left">
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
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-app bg-nav backdrop-blur-lg border-t border-line flex pb-[env(safe-area-inset-bottom)] z-80">
      {NAV_TABS.map(tab => (
        <button
          key={tab.id} onClick={() => onNavigate(tab.id)}
          className={cx("flex-1 flex items-center justify-center py-3.5 px-1 bg-transparent border-none cursor-pointer transition-colors duration-150", mode === tab.id ? "text-nav-active" : "text-ink-dim")}
        >
          <span className={cx("text-24 leading-none", mode !== tab.id && "grayscale-30")}>{tab.icon}</span>
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
    <div className="relative overflow-hidden rounded-16">
      {/* Green background revealed on swipe */}
      <div className={cx("absolute right-0 top-0 bottom-0 w-30 bg-grad-swipe flex items-center justify-end pr-5 rounded-r-16 transition-opacity duration-150", offsetX < -30 ? "opacity-100" : "opacity-0")}>
        <span className="text-white font-extrabold text-14">✓ Porabljeno</span>
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
