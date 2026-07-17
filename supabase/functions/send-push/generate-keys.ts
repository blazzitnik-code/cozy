// One-off VAPID key generator — run manually, NEVER imported by index.ts:
//
//   deno run supabase/functions/send-push/generate-keys.ts
//
// Use ONE key pair for local + prod (mixing pairs invalidates existing
// browser subscriptions per environment). Store the JSON as the
// VAPID_KEYS_JSON function secret; the public key goes into
// NEXT_PUBLIC_VAPID_PUBLIC_KEY (.env.local / Vercel). Do not commit either.

import * as webpush from 'jsr:@negrel/webpush@0.3';

const keys = await webpush.generateVapidKeys({ extractable: true });
const exported = await webpush.exportVapidKeys(keys);

// applicationServerKey for pushManager.subscribe(): raw P-256 point, base64url
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
const publicKey = btoa(String.fromCharCode(...raw))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

console.log('VAPID_KEYS_JSON (edge function secret — do not commit):\n');
console.log(JSON.stringify(exported));
console.log('\nNEXT_PUBLIC_VAPID_PUBLIC_KEY (.env.local + Vercel):\n');
console.log(publicKey);
