'use client';
import { useAuth, useHousehold } from '@/lib/hooks';
import AppShell from '@/components/AppShell';
import { useState } from 'react';
import { Screen, Loader, Input, Label, Btn } from '@/components/ui';

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
  if (authLoading || (user && hhLoading)) return <Loader />;

  // Not logged in → Login screen
  if (!user) {
    return (
      <Screen center>
        <div className="text-center px-8 w-full">
          <div className="text-72 mb-4">🏠</div>
          <div className="text-36 font-black mb-2">
            <span className="bg-grad-brand-app text-gradient">Cožy</span>
          </div>
          <p className="text-ink-3 text-15 mb-8">Domača aplikacija za gospodinjstvo</p>

          <button onClick={signInWithGoogle} className="w-full py-4 px-6 rounded-16 border border-line-strong bg-surface text-ink text-16 font-bold cursor-pointer flex items-center justify-center gap-3">
            {/* Google brand mark — fill colors are Google's, not theme colors */}
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Prijava z Google
          </button>
        </div>
      </Screen>
    );
  }

  // Logged in but no household → Create or Join
  if (!household) {
    return (
      <Screen center>
        <div className="px-6 w-full">
          <div className="text-center mb-8">
            <div className="text-48 mb-3">👋</div>
            <h1 className="text-24 font-extrabold mb-1">Zdravo, {user.user_metadata?.full_name?.split(' ')[0] || 'uporabnik'}!</h1>
            <p className="text-ink-3 text-14">Ustvari gospodinjstvo ali se pridruži obstoječemu</p>
          </div>

          {error && <div className="py-3 px-4 bg-danger/10 border border-danger/30 rounded-12 text-danger text-14 mb-4 text-center">{error}</div>}

          {!hhMode && (
            <div className="flex flex-col gap-3">
              <button onClick={() => { setHhMode('create'); setDisplayName(user.user_metadata?.full_name || ''); }} className="p-5 rounded-16 border border-accent/30 bg-accent/8 text-ink cursor-pointer text-left">
                <div className="text-28 mb-2">🏠</div>
                <div className="text-17 font-bold mb-1">Ustvari gospodinjstvo</div>
                <div className="text-13 text-ink-3">Začni novo in povabi družino ali partnerja</div>
              </button>
              <button onClick={() => { setHhMode('join'); setDisplayName(user.user_metadata?.full_name || ''); }} className="p-5 rounded-16 border border-line-strong bg-surface-2 text-ink cursor-pointer text-left">
                <div className="text-28 mb-2">🔗</div>
                <div className="text-17 font-bold mb-1">Pridruži se</div>
                <div className="text-13 text-ink-3">Vnesi kodo od nekoga ki te je povabil</div>
              </button>
              <button onClick={signOut} className="p-3 bg-transparent border-none text-ink-dim text-13 cursor-pointer mt-2">Odjava</button>
            </div>
          )}

          {hhMode === 'create' && (
            <div>
              <Label>Tvoje ime</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="npr. Janez" className="mb-3.5" />
              <Label>Ime gospodinjstva</Label>
              <Input value={hhName} onChange={e => setHhName(e.target.value)} placeholder="npr. Novakovi" className="mb-5" />
              <Btn onClick={async () => {
                setSubmitting(true); setError('');
                try { await createHousehold(hhName || 'Moje gospodinjstvo', displayName || 'Uporabnik'); }
                catch (e) { setError(e.message); }
                setSubmitting(false);
              }} disabled={submitting}>{submitting ? "Ustvarjam..." : "Ustvari gospodinjstvo"}</Btn>
              <button onClick={() => { setHhMode(null); setError(''); }} className="w-full p-3 bg-transparent border-none text-ink-3 text-14 cursor-pointer mt-2">← Nazaj</button>
            </div>
          )}

          {hhMode === 'join' && (
            <div>
              <Label>Tvoje ime</Label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="npr. Ana" className="mb-3.5" />
              <Label>Koda gospodinjstva</Label>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="npr. A4F2BC" maxLength={6} className="w-full box-border px-4 py-3.5 bg-field border border-field-line rounded-14 text-ink outline-none mb-5 text-center text-24 tracking-[8px] font-extrabold" />
              <Btn v="success" onClick={async () => {
                setSubmitting(true); setError('');
                try { await joinHousehold(joinCode, displayName || 'Uporabnik'); }
                catch (e) { setError('Neveljavna koda. Preveri in poskusi znova.'); }
                setSubmitting(false);
              }} disabled={submitting || joinCode.length < 4}>{submitting ? "Pridružujem..." : "Pridruži se"}</Btn>
              <button onClick={() => { setHhMode(null); setError(''); }} className="w-full p-3 bg-transparent border-none text-ink-3 text-14 cursor-pointer mt-2">← Nazaj</button>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  // Logged in + has household → Main app
  return <AppShell user={user} household={household} members={members} signOut={signOut} />;
}
