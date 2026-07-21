'use client';

import { useEffect } from 'react';

// Route-level error boundary. Without it, an unhandled render error leaves the
// PWA on the browser's blank "This page couldn't load" page. This catches it,
// keeps the app recoverable, and surfaces the actual message so it can be
// reported. Kept dependency-free (no i18n / providers) so it still renders even
// when the crash originated inside one of those.
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('App render error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col items-center justify-center gap-4 bg-stone-100 px-6 text-center dark:bg-stone-950">
      <div className="text-5xl">🫠</div>
      <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
        Ups, nekaj je šlo narobe
      </h1>
      <p className="text-sm text-stone-500 dark:text-stone-400">Aplikacija je naletela na napako.</p>
      {(error?.message || error?.digest) && (
        <pre className="max-w-full overflow-x-auto rounded-lg bg-stone-200 px-3 py-2 text-left text-xs text-stone-600 dark:bg-stone-900 dark:text-stone-400">
          {error?.message || error?.digest}
        </pre>
      )}
      <button
        onClick={() => reset()}
        className="mt-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-bold text-white active:scale-95 dark:bg-stone-100 dark:text-stone-900"
      >
        Poskusi znova
      </button>
    </div>
  );
}
