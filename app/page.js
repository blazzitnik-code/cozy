'use client';
import { useAuth, useHousehold } from '@/lib/hooks';
import ZmrzkoApp from '@/components/ZmrzkoApp';
import { useState } from 'react';

const A = { maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "linear-gradient(180deg,#0B1120 0%,#111827 40%,#0F172A 100%)", color: "#E2E8F0", fontFamily: "'Outfit','DM Sans',-apple-system,sans-serif", display: "flex", alignItems: "center", justifyContent: "center" };
const INP = { width: "100%", boxSizing: "border-box", padding: "14px 16px", background: "rgba(30,41,59,0.8)", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 14, color: "#E2E8F0", fontSize: 16, outline: "none", fontWeight: 500 };

export default function Home() {
  const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();
  const { household, members, loading: hhLoading, createHousehold, joinHousehold } = useHousehold(user);
  const [hhMode, setHhMode] = useState(null); // 'create' | 'join'
  const [hhName, setHhName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Loading
  if (authLoading || (user && hhLoading)) {
    return (
      <div style={A}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
          <div style={{ fontSize: 28, fontWeight: 900 }}>
            <span style={{ background: "linear-gradient(135deg,#E2E8F0,#C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cožy</span>
          </div>
          <div style={{ color: "#475569", marginTop: 8, fontSize: 14 }}>Nalagam...</div>
        </div>
      </div>
    );
  }

  // Not logged in → Login screen
  if (!user) {
    return (
      <div style={A}>
        <div style={{ textAlign: "center", padding: "0 32px", width: "100%" }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🏠</div>
          <div style={{ fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
            <span style={{ background: "linear-gradient(135deg,#E2E8F0,#C4B5FD)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Cožy</span>
          </div>
          <p style={{ color: "#64748B", fontSize: 15, marginBottom: 32 }}>Domača aplikacija za gospodinjstvo</p>
          
          <button onClick={signInWithGoogle} style={{
            width: "100%", padding: "16px 24px", borderRadius: 16, border: "1px solid rgba(71,85,105,0.3)",
            background: "rgba(30,41,59,0.6)", color: "#E2E8F0", fontSize: 16, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Prijava z Google
          </button>
        </div>
      </div>
    );
  }

  // Logged in but no household → Create or Join
  if (!household) {
    return (
      <div style={A}>
        <div style={{ padding: "0 24px", width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Zdravo, {user.user_metadata?.full_name?.split(' ')[0] || 'uporabnik'}!</h1>
            <p style={{ color: "#64748B", fontSize: 14 }}>Ustvari gospodinjstvo ali se pridruži obstoječemu</p>
          </div>

          {error && <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, color: "#EF4444", fontSize: 14, marginBottom: 16, textAlign: "center" }}>{error}</div>}

          {!hhMode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={() => { setHhMode('create'); setDisplayName(user.user_metadata?.full_name || ''); }} style={{
                padding: "20px", borderRadius: 16, border: "1px solid rgba(56,189,248,0.3)",
                background: "rgba(56,189,248,0.08)", color: "#E2E8F0", cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🏠</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Ustvari gospodinjstvo</div>
                <div style={{ fontSize: 13, color: "#64748B" }}>Začni novo in povabi družino ali partnerja</div>
              </button>
              <button onClick={() => { setHhMode('join'); setDisplayName(user.user_metadata?.full_name || ''); }} style={{
                padding: "20px", borderRadius: 16, border: "1px solid rgba(71,85,105,0.3)",
                background: "rgba(30,41,59,0.4)", color: "#E2E8F0", cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Pridruži se</div>
                <div style={{ fontSize: 13, color: "#64748B" }}>Vnesi kodo od nekoga ki te je povabil</div>
              </button>
              <button onClick={signOut} style={{ padding: "12px", background: "transparent", border: "none", color: "#475569", fontSize: 13, cursor: "pointer", marginTop: 8 }}>Odjava</button>
            </div>
          )}

          {hhMode === 'create' && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 8 }}>Tvoje ime</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="npr. Janez" style={{ ...INP, marginBottom: 14 }} />
              <label style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 8 }}>Ime gospodinjstva</label>
              <input value={hhName} onChange={e => setHhName(e.target.value)} placeholder="npr. Novakovi" style={{ ...INP, marginBottom: 20 }} />
              <button onClick={async () => {
                setSubmitting(true); setError('');
                try { await createHousehold(hhName || 'Moje gospodinjstvo', displayName || 'Uporabnik'); }
                catch (e) { setError(e.message); }
                setSubmitting(false);
              }} disabled={submitting} style={{
                width: "100%", padding: "16px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg,#0EA5E9,#6366F1)", color: "#fff",
                fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: submitting ? 0.5 : 1,
              }}>{submitting ? "Ustvarjam..." : "Ustvari gospodinjstvo"}</button>
              <button onClick={() => { setHhMode(null); setError(''); }} style={{ width: "100%", padding: "12px", background: "transparent", border: "none", color: "#64748B", fontSize: 14, cursor: "pointer", marginTop: 8 }}>← Nazaj</button>
            </div>
          )}

          {hhMode === 'join' && (
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 8 }}>Tvoje ime</label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="npr. Ana" style={{ ...INP, marginBottom: 14 }} />
              <label style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", display: "block", marginBottom: 8 }}>Koda gospodinjstva</label>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="npr. A4F2BC" maxLength={6} style={{ ...INP, marginBottom: 20, textAlign: "center", fontSize: 24, letterSpacing: 8, fontWeight: 800 }} />
              <button onClick={async () => {
                setSubmitting(true); setError('');
                try { await joinHousehold(joinCode, displayName || 'Uporabnik'); }
                catch (e) { setError('Neveljavna koda. Preveri in poskusi znova.'); }
                setSubmitting(false);
              }} disabled={submitting || joinCode.length < 4} style={{
                width: "100%", padding: "16px", borderRadius: 14, border: "none",
                background: "linear-gradient(135deg,#22C55E,#059669)", color: "#fff",
                fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: (submitting || joinCode.length < 4) ? 0.4 : 1,
              }}>{submitting ? "Pridružujem..." : "Pridruži se"}</button>
              <button onClick={() => { setHhMode(null); setError(''); }} style={{ width: "100%", padding: "12px", background: "transparent", border: "none", color: "#64748B", fontSize: 14, cursor: "pointer", marginTop: 8 }}>← Nazaj</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Logged in + has household → Main app
  return <ZmrzkoApp user={user} household={household} members={members} signOut={signOut} />;
}
