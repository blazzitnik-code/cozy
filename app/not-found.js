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
        <div className="mb-6 font-serif text-2xl font-semibold tracking-tight" suppressHydrationWarning>
          {t('title')}
        </div>
        <Link
          href="/"
          className="inline-block cursor-pointer rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-bold text-stone-900 no-underline dark:border-white/10 dark:bg-stone-900 dark:text-stone-100"
          suppressHydrationWarning
        >
          {t('goHome')}
        </Link>
      </div>
    </Screen>
  );
}
