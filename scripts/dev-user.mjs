#!/usr/bin/env node
// Give a LOCAL-stack auth user a password so the dev login form (LAN-device
// testing) can sign in — Google OAuth can't round-trip to a private-IP stack.
// Existing user (e.g. created via Google on desktop) gets the password set, so
// the phone lands in the same account/household; otherwise the user is created.
// auth.users is wiped by `npx supabase db reset` — re-run this after a reset.
//
// Usage: node scripts/dev-user.mjs <email> [password]   (password defaults to cozy-dev)
import { execSync } from 'node:child_process';

const email = process.argv[2];
const password = process.argv[3] || 'cozy-dev';
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/dev-user.mjs <email> [password]');
  process.exit(1);
}

// Keys come from the running local stack — never hardcoded.
const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8' })
    .split('\n')
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);
const { API_URL: api, SERVICE_ROLE_KEY: service, ANON_KEY: anon } = env;
if (!api || !service) {
  console.error('Could not read the local stack config — is it running? (npx supabase start)');
  process.exit(1);
}

const headers = { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' };

const listRes = await fetch(`${api}/auth/v1/admin/users?per_page=1000`, { headers });
if (!listRes.ok) throw new Error(`listing users failed: ${listRes.status} ${await listRes.text()}`);
const { users = [] } = await listRes.json();
const existing = users.find((u) => u.email === email);

const res = existing
  ? await fetch(`${api}/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ password }),
    })
  : await fetch(`${api}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
if (!res.ok)
  throw new Error(`${existing ? 'password update' : 'user creation'} failed: ${res.status} ${await res.text()}`);
console.log(`${existing ? 'Password set for existing user' : 'Created user'} ${email} (local stack only).`);

// End-to-end sanity check: the same password grant the app's dev form uses.
const tok = await fetch(`${api}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (tok.ok) {
  console.log('Password sign-in verified against GoTrue.');
} else {
  console.error(`Password sign-in check FAILED: ${tok.status} ${await tok.text()}`);
  process.exit(1);
}
