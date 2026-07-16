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
        <div className="w-full px-8 text-center">
          <div className="mb-4 text-7xl">🏠</div>
          <div className="mb-2 text-4xl font-black">
            <span className="bg-linear-135 from-slate-800 to-violet-300 bg-clip-text text-transparent dark:from-slate-200">
              Cožy
            </span>
          </div>
          <p className="mb-8 text-base text-slate-400 dark:text-slate-500">Domača aplikacija za gospodinjstvo</p>

          <button
            onClick={signInWithGoogle}
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border border-indigo-500/20 bg-white/80 px-6 py-4 text-base font-bold text-slate-800 dark:border-slate-600/30 dark:bg-slate-800/60 dark:text-slate-200"
          >
            {/* Google brand mark — fill colors are Google's, not theme colors */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
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
        <div className="w-full px-6">
          <div className="mb-8 text-center">
            <div className="mb-3 text-5xl">👋</div>
            <h1 className="mb-1 text-2xl font-extrabold">
              Zdravo, {user.user_metadata?.full_name?.split(' ')[0] || 'uporabnik'}!
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Ustvari gospodinjstvo ali se pridruži obstoječemu
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-500">
              {error}
            </div>
          )}

          {!hhMode && (
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setHhMode('create');
                  setDisplayName(user.user_metadata?.full_name || '');
                }}
                className="cursor-pointer rounded-2xl border border-sky-400/30 bg-sky-400/8 p-5 text-left text-slate-800 dark:text-slate-200"
              >
                <div className="mb-2 text-3xl">🏠</div>
                <div className="mb-1 text-lg font-bold">Ustvari gospodinjstvo</div>
                <div className="text-sm text-slate-400 dark:text-slate-500">
                  Začni novo in povabi družino ali partnerja
                </div>
              </button>
              <button
                onClick={() => {
                  setHhMode('join');
                  setDisplayName(user.user_metadata?.full_name || '');
                }}
                className="cursor-pointer rounded-2xl border border-indigo-500/20 bg-white/70 p-5 text-left text-slate-800 dark:border-slate-600/30 dark:bg-slate-800/50 dark:text-slate-200"
              >
                <div className="mb-2 text-3xl">🔗</div>
                <div className="mb-1 text-lg font-bold">Pridruži se</div>
                <div className="text-sm text-slate-400 dark:text-slate-500">Vnesi kodo od nekoga ki te je povabil</div>
              </button>
              <button
                onClick={signOut}
                className="mt-2 cursor-pointer border-none bg-transparent p-3 text-sm text-slate-300 dark:text-slate-600"
              >
                Odjava
              </button>
            </div>
          )}

          {hhMode === 'create' && (
            <div>
              <Label>Tvoje ime</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="npr. Janez"
                className="mb-3.5"
              />
              <Label>Ime gospodinjstva</Label>
              <Input
                value={hhName}
                onChange={(e) => setHhName(e.target.value)}
                placeholder="npr. Novakovi"
                className="mb-5"
              />
              <Btn
                onClick={async () => {
                  setSubmitting(true);
                  setError('');
                  try {
                    await createHousehold(hhName || 'Moje gospodinjstvo', displayName || 'Uporabnik');
                  } catch (e) {
                    setError(e.message);
                  }
                  setSubmitting(false);
                }}
                disabled={submitting}
              >
                {submitting ? 'Ustvarjam...' : 'Ustvari gospodinjstvo'}
              </Btn>
              <button
                onClick={() => {
                  setHhMode(null);
                  setError('');
                }}
                className="mt-2 w-full cursor-pointer border-none bg-transparent p-3 text-sm text-slate-400 dark:text-slate-500"
              >
                ← Nazaj
              </button>
            </div>
          )}

          {hhMode === 'join' && (
            <div>
              <Label>Tvoje ime</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="npr. Ana"
                className="mb-3.5"
              />
              <Label>Koda gospodinjstva</Label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="npr. A4F2BC"
                maxLength={6}
                className="mb-5 box-border w-full rounded-xl border border-indigo-500/25 bg-white/90 px-4 py-3.5 text-center text-2xl font-extrabold tracking-[8px] text-slate-800 outline-none dark:border-indigo-500/30 dark:bg-slate-800/80 dark:text-slate-200"
              />
              <Btn
                v="success"
                onClick={async () => {
                  setSubmitting(true);
                  setError('');
                  try {
                    await joinHousehold(joinCode, displayName || 'Uporabnik');
                  } catch (e) {
                    setError('Neveljavna koda. Preveri in poskusi znova.');
                  }
                  setSubmitting(false);
                }}
                disabled={submitting || joinCode.length < 4}
              >
                {submitting ? 'Pridružujem...' : 'Pridruži se'}
              </Btn>
              <button
                onClick={() => {
                  setHhMode(null);
                  setError('');
                }}
                className="mt-2 w-full cursor-pointer border-none bg-transparent p-3 text-sm text-slate-400 dark:text-slate-500"
              >
                ← Nazaj
              </button>
            </div>
          )}
        </div>
      </Screen>
    );
  }

  // Logged in + has household → Main app
  return <AppShell user={user} household={household} members={members} signOut={signOut} />;
}
