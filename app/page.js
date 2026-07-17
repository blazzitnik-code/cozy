'use client';
import { useAuth, useHousehold } from '@/lib/hooks';
import AppShell from '@/components/AppShell';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { rpcErrorKey } from '@/lib/intl';
import { cx } from '@/lib/utils';
import { Screen, ScreenEnter, Loader, Input, Label, Btn, Wordmark, CODE_INPUT, PRESS, PRESS_SM } from '@/components/ui';

export default function Home() {
  // Root-namespace t: `error` state may hold a message key (Errors.rpc.* /
  // Auth.invalidCode) or a raw DB message — t.has() picks the right rendering.
  const t = useTranslations();
  const { user, loading: authLoading, signInWithGoogle, signInWithPassword, signOut } = useAuth();
  const { household, members, loading: hhLoading, createHousehold, joinHousehold } = useHousehold(user);
  const [hhMode, setHhMode] = useState(null); // 'create' | 'join'
  const [hhName, setHhName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');

  // Suppresses the hhMode pane's own entrance while the household screen
  // itself is entering (login → household: outer + pane mount together and
  // the rise would compound); pane switches (chooser ↔ create/join) replay it.
  const hhScreenReady = useRef(false);
  const showHhScreen = !authLoading && !!user && !hhLoading && !household;
  useEffect(() => {
    hhScreenReady.current = showHhScreen;
  }, [showHhScreen]);

  // Loading
  if (authLoading || (user && hhLoading)) return <Loader />;

  // Not logged in → Login screen
  if (!user) {
    return (
      <Screen center>
        <ScreenEnter className="w-full px-8 text-center">
          <div className="mb-4 text-7xl">🏠</div>
          <div className="mb-2">
            <Wordmark className="text-5xl" />
          </div>
          <p className="mb-8 text-base text-stone-500 dark:text-stone-400">{t('Auth.tagline')}</p>

          <button
            onClick={signInWithGoogle}
            className={cx(
              'flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-stone-200 bg-white px-6 py-4 text-base font-bold text-stone-900 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100',
              PRESS,
            )}
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
            {t('Auth.signInGoogle')}
          </button>

          {/* Dev-only password login for LAN-device testing — Google OAuth can't
              round-trip to the private-IP local stack (see CLAUDE.md). */}
          {process.env.NODE_ENV === 'development' &&
            (!devOpen ? (
              <button
                onClick={() => setDevOpen(true)}
                className={cx(
                  'mt-3 rounded-full border-none bg-transparent p-3 text-sm text-stone-400 dark:text-stone-500',
                  PRESS_SM,
                )}
              >
                {t('Auth.devLogin')}
              </button>
            ) : (
              <form
                className="mt-5 text-left"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSubmitting(true);
                  setError('');
                  try {
                    await signInWithPassword(devEmail.trim(), devPassword);
                  } catch {
                    setError('Auth.devLoginError');
                  }
                  setSubmitting(false);
                }}
              >
                <Input
                  type="email"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  placeholder={t('Auth.devEmailPh')}
                  autoComplete="email"
                  className="mb-3"
                />
                <Input
                  type="password"
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  placeholder={t('Auth.devPasswordPh')}
                  autoComplete="current-password"
                  className="mb-4"
                />
                {error && (
                  <div className="mb-3 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                    {t.has(error) ? t(error) : error}
                  </div>
                )}
                {/* Btn renders a <button>, which defaults to type="submit" inside a form */}
                <Btn disabled={submitting || !devEmail || !devPassword}>{t('Auth.devLogin')}</Btn>
              </form>
            ))}
        </ScreenEnter>
      </Screen>
    );
  }

  // Logged in but no household → Create or Join
  if (!household) {
    return (
      <Screen center>
        <ScreenEnter className="w-full px-6">
          <div className="mb-8 text-center">
            <div className="mb-3 text-5xl">👋</div>
            <h1 className="mb-1 font-serif text-3xl font-semibold tracking-tight">
              {t('Auth.hello', { name: user.user_metadata?.full_name?.split(' ')[0] || t('Auth.userFallback') })}
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">{t('Auth.createOrJoin')}</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
              {t.has(error) ? t(error) : error}
            </div>
          )}

          {!hhMode && (
            <ScreenEnter className="flex flex-col gap-3" initial={hhScreenReady.current ? undefined : false}>
              <button
                onClick={() => {
                  setHhMode('create');
                  setDisplayName(user.user_metadata?.full_name || '');
                }}
                className={cx(
                  'cursor-pointer rounded-2xl border border-stone-200/70 bg-white p-5 text-left text-stone-900 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100',
                  PRESS,
                )}
              >
                <div className="mb-2 text-3xl">🏠</div>
                <div className="mb-1 font-serif text-xl font-semibold tracking-tight">{t('Auth.createHousehold')}</div>
                <div className="text-sm text-stone-500 dark:text-stone-400">{t('Auth.createHouseholdDesc')}</div>
              </button>
              <button
                onClick={() => {
                  setHhMode('join');
                  setDisplayName(user.user_metadata?.full_name || '');
                }}
                className={cx(
                  'cursor-pointer rounded-2xl border border-stone-200/70 bg-white p-5 text-left text-stone-900 dark:border-white/10 dark:bg-stone-900 dark:text-stone-100',
                  PRESS,
                )}
              >
                <div className="mb-2 text-3xl">🔗</div>
                <div className="mb-1 font-serif text-xl font-semibold tracking-tight">{t('Auth.join')}</div>
                <div className="text-sm text-stone-500 dark:text-stone-400">{t('Auth.joinDesc')}</div>
              </button>
              <button
                onClick={signOut}
                className={cx(
                  'mt-2 rounded-full border-none bg-transparent p-3 text-sm text-stone-400 dark:text-stone-500',
                  PRESS_SM,
                )}
              >
                {t('Common.signOut')}
              </button>
            </ScreenEnter>
          )}

          {hhMode === 'create' && (
            <ScreenEnter initial={hhScreenReady.current ? undefined : false}>
              <Label>{t('Auth.yourName')}</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('Auth.namePlaceholderCreate')}
                className="mb-3.5"
              />
              <Label>{t('Auth.householdName')}</Label>
              <Input
                value={hhName}
                onChange={(e) => setHhName(e.target.value)}
                placeholder={t('Auth.householdNamePlaceholder')}
                className="mb-5"
              />
              <Btn
                onClick={async () => {
                  setSubmitting(true);
                  setError('');
                  try {
                    await createHousehold(hhName || t('Auth.defaultHouseholdName'), displayName || t('Common.user'));
                  } catch (e) {
                    setError(rpcErrorKey(e.message) ?? e.message);
                  }
                  setSubmitting(false);
                }}
                disabled={submitting}
              >
                {submitting ? t('Auth.creating') : t('Auth.createHousehold')}
              </Btn>
              <button
                onClick={() => {
                  setHhMode(null);
                  setError('');
                }}
                className={cx(
                  'mt-2 w-full rounded-full border-none bg-transparent p-3 text-sm text-stone-400 dark:text-stone-500',
                  PRESS_SM,
                )}
              >
                {t('Common.back')}
              </button>
            </ScreenEnter>
          )}

          {hhMode === 'join' && (
            <ScreenEnter initial={hhScreenReady.current ? undefined : false}>
              <Label>{t('Auth.yourName')}</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('Auth.namePlaceholderJoin')}
                className="mb-3.5"
              />
              <Label>{t('Auth.joinCode')}</Label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder={t('Auth.joinCodePlaceholder')}
                maxLength={6}
                className={cx(CODE_INPUT, 'mb-5')}
              />
              <Btn
                v="success"
                onClick={async () => {
                  setSubmitting(true);
                  setError('');
                  try {
                    await joinHousehold(joinCode, displayName || t('Common.user'));
                  } catch (e) {
                    // Map known RPC messages like the create path — a network/
                    // server failure must not read as "invalid code".
                    setError(rpcErrorKey(e.message) ?? e.message);
                  }
                  setSubmitting(false);
                }}
                disabled={submitting || joinCode.length < 4}
              >
                {submitting ? t('Auth.joining') : t('Auth.join')}
              </Btn>
              <button
                onClick={() => {
                  setHhMode(null);
                  setError('');
                }}
                className={cx(
                  'mt-2 w-full rounded-full border-none bg-transparent p-3 text-sm text-stone-400 dark:text-stone-500',
                  PRESS_SM,
                )}
              >
                {t('Common.back')}
              </button>
            </ScreenEnter>
          )}
        </ScreenEnter>
      </Screen>
    );
  }

  // Logged in + has household → Main app
  return <AppShell user={user} household={household} members={members} signOut={signOut} />;
}
