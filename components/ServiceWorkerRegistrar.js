'use client';

import { useEffect } from 'react';

// Registers the service worker (production builds only — caching in dev makes
// stale-code debugging miserable) and relays notification-click deep links:
// sw.js posts { type: 'navigate', tab } and we surface it as a hash change,
// which AppShell listens for.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    } else {
      // A previously tested production build may have left a SW behind on
      // localhost — unregister so it can't interfere with `next dev`.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }

    const onMessage = (event) => {
      if (event.data?.type === 'navigate' && event.data.tab) {
        window.location.hash = event.data.tab;
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return null;
}
