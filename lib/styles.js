// Theme-dependent styles — resolved via getStyles(isDark) inside components where the theme is known
export const getStyles = (isDark) => ({
  A: { maxWidth: 430, margin: "0 auto", minHeight: "100vh", position: "relative", overflow: "hidden", background: isDark ? "linear-gradient(180deg,#0B1120 0%,#111827 40%,#0F172A 100%)" : "linear-gradient(180deg,#F0F4FF 0%,#E8EEFF 40%,#EEF2FF 100%)", color: isDark ? "#E2E8F0" : "#1E293B", fontFamily: "'Outfit','DM Sans',-apple-system,sans-serif" },
  F1: { position: "absolute", top: -60, right: -60, width: 200, height: 200, background: isDark ? "radial-gradient(circle,rgba(56,189,248,0.08) 0%,transparent 70%)" : "radial-gradient(circle,rgba(56,189,248,0.15) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
  F2: { position: "absolute", bottom: 100, left: -80, width: 250, height: 250, background: isDark ? "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)" : "radial-gradient(circle,rgba(99,102,241,0.1) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" },
  INP: { width: "100%", boxSizing: "border-box", padding: "14px 16px", background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)", border: isDark ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(99,102,241,0.25)", borderRadius: 14, color: isDark ? "#E2E8F0" : "#1E293B", fontSize: 16, outline: "none", fontWeight: 500 },
  LBL: { fontSize: 13, fontWeight: 700, color: isDark ? "#94A3B8" : "#64748B", display: "block", marginBottom: 8 },
  cardBg: isDark ? "rgba(30,41,59,0.6)" : "rgba(255,255,255,0.8)",
  cardBorder: isDark ? "1px solid rgba(71,85,105,0.2)" : "1px solid rgba(99,102,241,0.15)",
  textPrimary: isDark ? "#E2E8F0" : "#1E293B",
  textSecondary: isDark ? "#94A3B8" : "#64748B",
  textMuted: isDark ? "#64748B" : "#94A3B8",
  inputBg: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)",
  pillBg: isDark ? "rgba(30,41,59,0.5)" : "rgba(255,255,255,0.7)",
  modalBg: isDark ? "linear-gradient(180deg,#1E293B,#0F172A)" : "linear-gradient(180deg,#FFFFFF,#F8FAFF)",
  modalHandle: isDark ? "#334155" : "#CBD5E1",
});

// Static styles (theme-agnostic, dark values) — legacy aliases for screens that don't theme yet
export const A = { maxWidth: 430, margin: "0 auto", minHeight: "100vh", position: "relative", overflow: "hidden", background: "linear-gradient(180deg,#0B1120 0%,#111827 40%,#0F172A 100%)", color: "#E2E8F0", fontFamily: "'Outfit','DM Sans',-apple-system,sans-serif" };
export const F1 = { position: "absolute", top: -60, right: -60, width: 200, height: 200, background: "radial-gradient(circle,rgba(56,189,248,0.08) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" };
export const F2 = { position: "absolute", bottom: 100, left: -80, width: 250, height: 250, background: "radial-gradient(circle,rgba(99,102,241,0.06) 0%,transparent 70%)", borderRadius: "50%", pointerEvents: "none" };
export const INP = { width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, color: "#E2E8F0", fontSize: 16, outline: "none", fontWeight: 500 };
export const LBL = { fontSize: 13, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 8 };
