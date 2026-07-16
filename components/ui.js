'use client';
import { useState, useEffect, useRef } from "react";
import { subscribeToErrors } from '@/lib/notify';

// ─── SMALL COMPONENTS ───
export function Pill({ active, color, onClick, children, small }) {
  return <button onClick={onClick} style={{ padding: small ? "6px 10px" : "8px 14px", borderRadius: 20, border: "1px solid", borderColor: active ? (color ? color + "80" : "rgba(56,189,248,0.5)") : "rgba(71,85,105,0.3)", background: active ? (color ? color + "20" : "rgba(56,189,248,0.15)") : "rgba(30,41,59,0.5)", color: active ? (color || "#38BDF8") : "#94A3B8", fontSize: small ? 12 : 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{children}</button>;
}

export function FC({ label, value }) {
  return <div style={{ background: "rgba(30,41,59,0.6)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(71,85,105,0.2)" }}><div style={{ fontSize: 11, color: "#64748B", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0" }}>{value}</div></div>;
}

export function Btn({ onClick, children, v = "primary", disabled = false, style: s = {} }) {
  const map = { primary: { bg: "linear-gradient(135deg,#0EA5E9,#6366F1)", c: "#fff", b: "none" }, success: { bg: "linear-gradient(135deg,#22C55E,#059669)", c: "#fff", b: "none" }, danger: { bg: "rgba(239,68,68,0.12)", c: "#EF4444", b: "1px solid rgba(239,68,68,0.3)" }, ghost: { bg: "transparent", c: "#64748B", b: "1px solid rgba(71,85,105,0.3)" } };
  const st = map[v] || map.primary;
  return <button onClick={onClick} disabled={disabled} style={{ width: "100%", padding: "15px", borderRadius: 14, border: st.b, background: st.bg, color: st.c, fontSize: 16, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, ...s }}>{children}</button>;
}

export function Modal({ children, onClose, isDark = true }) {
  const modalBg = isDark ? "linear-gradient(180deg,#1E293B,#0F172A)" : "linear-gradient(180deg,#FFFFFF,#F8FAFF)";
  const handleBg = isDark ? "#334155" : "#CBD5E1";
  const border = isDark ? "1px solid rgba(71,85,105,0.3)" : "1px solid rgba(99,102,241,0.15)";
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}><div onClick={e => e.stopPropagation()} style={{ background: modalBg, borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 430, padding: "24px 20px 36px", border, borderBottom: "none", maxHeight: "85vh", overflowY: "auto" }}><div style={{ width: 36, height: 4, background: handleBg, borderRadius: 2, margin: "0 auto 20px" }} />{children}</div></div>;
}

export function ConfirmModal({ action, onClose, isDark = true }) {
  if (!action) return null;
  return (
    <Modal isDark={isDark} onClose={onClose}>
      <p style={{ fontSize: 16, fontWeight: 600, color: isDark ? "#E2E8F0" : "#1E293B", textAlign: "center", marginBottom: 24, marginTop: 4 }}>{action.message}</p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={async () => { await action.onConfirm(); onClose(); }} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#EF4444,#DC2626)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Potrdi</button>
        <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: 14, border: "1px solid rgba(71,85,105,0.3)", background: "transparent", color: "#94A3B8", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Prekliči</button>
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
    <div style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 398, display: "flex", flexDirection: "column", gap: 8, zIndex: 300, pointerEvents: "none" }}>
      {toasts.map(t => (
        <div key={t.id} onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "rgba(69,10,10,0.95)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 14, color: "#FCA5A5", fontSize: 14, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", cursor: "pointer", backdropFilter: "blur(8px)" }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <span style={{ flex: 1 }}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ─── LOGO / MODE TOGGLE (freezer ↔ shopping) ───
export function LogoToggle({ mode, onToggle }) {
  return (
    <button onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
      {mode === "freezer" ? (
        <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px" }}>
          <span style={{ background: "linear-gradient(135deg,#E2E8F0,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ZMRZK</span>
          <span style={{ color: "#38BDF8" }}>❄️</span>
        </span>
      ) : (
        <span style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.5px" }}>
          <span style={{ background: "linear-gradient(135deg,#E2E8F0,#F59E0B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>TRGOVK</span>
          <span>🛒</span>
        </span>
      )}
      <div style={{ fontSize: 10, color: "#475569", marginTop: 2, textAlign: "left" }}>
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
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(11,17,32,0.97)", backdropFilter: "blur(16px)", borderTop: "1px solid rgba(71,85,105,0.2)", display: "flex", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 80 }}>
      {NAV_TABS.map(tab => (
        <button key={tab.id} onClick={() => onNavigate(tab.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 4px", background: "none", border: "none", cursor: "pointer", color: mode === tab.id ? "#C4B5FD" : "#475569", transition: "color 0.15s" }}>
          <span style={{ fontSize: 24, lineHeight: 1, filter: mode === tab.id ? "none" : "grayscale(0.3)" }}>{tab.icon}</span>
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
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 16 }}>
      {/* Green background revealed on swipe */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 120, background: "linear-gradient(90deg, transparent, #22C55E)", display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 20, borderRadius: "0 16px 16px 0", opacity: offsetX < -30 ? 1 : 0, transition: "opacity 0.15s" }}>
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>✓ Porabljeno</span>
      </div>
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onClick={() => { if (!moved.current && onClick) onClick(); }}
        style={{ transform: `translateX(${offsetX}px)`, transition: swiping ? "none" : "transform 0.25s ease", position: "relative", zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  );
}
