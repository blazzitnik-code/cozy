// Theme-aware styles backed by the CSS design tokens in app/globals.css.
// Values are var(--…) references, so every st.* consumer follows the active
// theme (<html data-theme>) automatically. getStyles keeps its (isDark)
// signature for call-site compatibility; the parameter is no longer used
// for token-backed values and goes away once modules migrate to tokens.
export const getStyles = () => ({
  A: { maxWidth: 430, margin: "0 auto", minHeight: "100vh", position: "relative", overflow: "hidden", background: "var(--bg)", color: "var(--text-1)", fontFamily: "'Outfit','DM Sans',-apple-system,sans-serif" },
  F1: { position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "var(--glow-1)", borderRadius: "50%", pointerEvents: "none" },
  F2: { position: "absolute", bottom: 100, left: -80, width: 250, height: 250, background: "var(--glow-2)", borderRadius: "50%", pointerEvents: "none" },
  INP: { width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "var(--input-bg)", border: "1px solid var(--input-border)", borderRadius: 14, color: "var(--text-1)", fontSize: 16, outline: "none", fontWeight: 500 },
  LBL: { fontSize: 13, fontWeight: 700, color: "var(--text-2)", display: "block", marginBottom: 8 },
  cardBg: "var(--surface)",
  cardBorder: "1px solid var(--border)",
  textPrimary: "var(--text-1)",
  textSecondary: "var(--text-2)",
  textMuted: "var(--text-3)",
  inputBg: "var(--input-bg)",
  pillBg: "var(--surface-2)",
  modalBg: "var(--modal-bg)",
  modalHandle: "var(--modal-handle)",
});

// Static styles (always dark) — legacy aliases for module internals that
// still hardcode the dark palette; they migrate to tokens together with
// the upcoming visual design.
export const A = { maxWidth: 430, margin: "0 auto", minHeight: "100vh", position: "relative", overflow: "hidden", background: "linear-gradient(180deg,#0B1120 0%,#111827 40%,#0F172A 100%)", color: "#E2E8F0", fontFamily: "'Outfit','DM Sans',-apple-system,sans-serif" };
export const F1 = { position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "radial-gradient(circle,rgba(56,189,248,0.08) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" };
export const F2 = { position: "absolute", bottom: 100, left: -80, width: 250, height: 250, background: "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" };
export const INP = { width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, color: "#E2E8F0", fontSize: 16, outline: "none", fontWeight: 500 };
export const LBL = { fontSize: 13, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 8 };
