'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Screen } from '@/components/ui';

// Renders inside the root layout, so IntlProvider (and the theme) apply.
export default function NotFound() {
  const t = useTranslations('NotFound');
  return (
    <Screen center>
      <div className="text-center">
        <div className="mb-4 text-6xl">🧭</div>
        {/* suppressHydrationWarning: prerendered in sl, the client may load en */}
        <div className="mb-6 text-xl font-extrabold text-slate-800 dark:text-slate-200" suppressHydrationWarning>
          {t('title')}
        </div>
        <Link
          href="/"
          className="inline-block cursor-pointer rounded-xl border border-indigo-500/20 bg-white/80 px-5 py-3 text-sm font-bold text-slate-800 no-underline dark:border-slate-600/30 dark:bg-slate-800/60 dark:text-slate-200"
          suppressHydrationWarning
        >
          {t('goHome')}
        </Link>
      </div>
    </Screen>
  );
}
