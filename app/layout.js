import './globals.css';
import { Fraunces, Inter } from 'next/font/google';
import Script from 'next/script';
import IntlProvider from '@/components/IntlProvider';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

// latin-ext is required for č/š/ž (the wordmark "Cožy" itself needs it).
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
  display: 'swap',
});
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-fraunces',
  display: 'swap',
  axes: ['opsz'],
});

export const metadata = {
  title: 'Cožy',
  description: 'Domača aplikacija za gospodinjstvo',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Cožy',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-visual',
  themeColor: '#0C0A09',
};

export default function RootLayout({ children }) {
  return (
    // data-theme="dark" is the SSR default; the pre-paint script below may
    // flip it to the saved theme before hydration → suppressHydrationWarning.
    <html
      lang="sl"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} overflow-x-hidden overscroll-none bg-stone-100 text-stone-900 antialiased scheme-light dark:bg-stone-950 dark:text-stone-100 dark:scheme-dark`}
    >
      {/* Safe-area top padding lives on <Screen> (inside its min-h-dvh box) —
          on <body> it would add to the document height and cause permanent
          scroll/rubber-banding on iOS. */}
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('zmrzko_theme');if(t)document.documentElement.dataset.theme=t;var l=localStorage.getItem('zmrzko_lang');if(l)document.documentElement.lang=l}catch(e){}`,
          }}
        />
        {/* Google Identity Services (~96 KiB) is NOT loaded here — it's only
            needed to connect Google Calendar, so connectCalendar() in AppShell
            injects it on demand. Login uses Supabase redirect OAuth (no GSI). */}
        <ServiceWorkerRegistrar />
        <IntlProvider>{children}</IntlProvider>
      </body>
    </html>
  );
}
