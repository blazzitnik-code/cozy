import './globals.css';
import Script from 'next/script';
import IntlProvider from '@/components/IntlProvider';

export const metadata = {
  title: 'Cožy',
  description: 'Domača aplikacija za gospodinjstvo',
  manifest: '/manifest.json',
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
  themeColor: '#020617',
};

export default function RootLayout({ children }) {
  return (
    // data-theme="dark" is the SSR default; the pre-paint script below may
    // flip it to the saved theme before hydration → suppressHydrationWarning.
    <html
      lang="sl"
      data-theme="dark"
      suppressHydrationWarning
      className="overflow-x-hidden overscroll-none bg-indigo-50 text-slate-800 antialiased scheme-light dark:bg-slate-950 dark:text-slate-200 dark:scheme-dark"
    >
      <head>
        {/* Apply saved theme + language before first paint (dark: classes key off
            data-theme; lang is a11y/spellcheck polish — the UI language itself
            lives in IntlProvider) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('zmrzko_theme');if(t)document.documentElement.dataset.theme=t;var l=localStorage.getItem('zmrzko_lang');if(l)document.documentElement.lang=l}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="pt-[env(safe-area-inset-top)]">
        <IntlProvider>{children}</IntlProvider>
      </body>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
    </html>
  );
}
