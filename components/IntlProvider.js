'use client';
import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import sl from '@/messages/sl.json';
import en from '@/messages/en.json';

// Both locales are imported statically so switching works offline (PWA)
// and is instant; each file is only a few KB gzipped.
const MESSAGES = { sl, en };

// Named date/time presets, used app-wide via useFormatter().dateTime(d, '<name>').
const FORMATS = {
  dateTime: {
    day: { day: 'numeric', month: 'short', year: 'numeric' },
    dayShort: { day: 'numeric', month: 'short' },
    dayMonthLong: { day: 'numeric', month: 'long' },
    fullDate: { day: 'numeric', month: 'long', year: 'numeric' },
    numericDate: { day: 'numeric', month: 'numeric', year: 'numeric' },
    monthYear: { month: 'long', year: 'numeric' },
    monthShortYY: { month: 'short', year: '2-digit' },
    weekdayFull: { weekday: 'long', day: 'numeric', month: 'long' },
    time: { hour: '2-digit', minute: '2-digit' },
  },
};

const LocaleContext = createContext(null);
// { locale, switchLocale } — consumed by the language switcher in settings.
export const useLocaleSwitch = () => useContext(LocaleContext);

// Missing-message fallback mirrors the old useT chain: active locale → sl → key path.
function fallbackToSl({ namespace, key }) {
  const path = [namespace, key].filter(Boolean).join('.');
  const val = path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), sl);
  return typeof val === 'string' ? val : path;
}

function onIntlError(err) {
  // MISSING_MESSAGE is handled by fallbackToSl; everything else is a real bug.
  if (err.code !== 'MISSING_MESSAGE') console.error(err);
}

export default function IntlProvider({ children }) {
  const [locale, setLocale] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('zmrzko_lang') || 'sl';
    return 'sl';
  });
  const switchLocale = useCallback((l) => {
    setLocale(l);
    localStorage.setItem('zmrzko_lang', l);
    document.documentElement.lang = l;
  }, []);
  const ctx = useMemo(() => ({ locale, switchLocale }), [locale, switchLocale]);

  return (
    <LocaleContext.Provider value={ctx}>
      <NextIntlClientProvider
        locale={locale}
        messages={MESSAGES[locale] || MESSAGES.sl}
        timeZone="Europe/Ljubljana"
        formats={FORMATS}
        getMessageFallback={fallbackToSl}
        onError={onIntlError}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
