// lib/providers.js
//
// Registry of home-device providers — added once a second real provider
// (Vaillant) joined MELCloud Home, so the connect/disconnect/command API
// routes can dispatch on provider_connections.provider / home_devices.provider
// instead of each route hardcoding a single provider module. Each entry's
// `client` is the pure API module (providers/<name>/index.js — login,
// refreshAccessToken, getDevices, control fns) and `server` is its
// lib/<name>-server.js glue (adminClient, getValidAccessToken, toFriendlyError,
// markConnectionOk/Error).
import * as melcloudHomeClient from '../providers/melcloud-home/index.js';
import * as vaillantClient from '../providers/vaillant/index.js';
import * as shellyClient from '../providers/shelly/index.js';
import * as netatmoClient from '../providers/netatmo/index.js';
import * as melcloudServer from './melcloud-server.js';
import * as vaillantServer from './vaillant-server.js';
import * as shellyServer from './shelly-server.js';
import * as netatmoServer from './netatmo-server.js';

export const PROVIDERS = {
  melcloud_home: { client: melcloudHomeClient, server: melcloudServer },
  vaillant: { client: vaillantClient, server: vaillantServer },
  shelly: { client: shellyClient, server: shellyServer },
  netatmo: { client: netatmoClient, server: netatmoServer },
};

export function getProvider(name) {
  const entry = PROVIDERS[name];
  if (!entry) throw new Error(`Unknown home-device provider: ${name}`);
  return entry;
}
