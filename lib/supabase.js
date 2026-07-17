import { createClient } from '@supabase/supabase-js';

const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Dev-on-LAN shim: when the app is opened from another device via the dev
// machine's IP (phone testing), a loopback Supabase URL would point at the
// device itself — swap its host for the one the page was loaded from. The
// local stack's Docker ports listen on all interfaces, so the same port works.
function resolveUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return url;
  const u = new URL(url);
  const loopback = (h) => h === '127.0.0.1' || h === 'localhost';
  if (loopback(u.hostname) && !loopback(window.location.hostname)) u.hostname = window.location.hostname;
  return u.toString();
}

export const supabase = createClient(resolveUrl(), supabaseKey);
