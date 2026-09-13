// providers/melcloud-home/mock.js
//
// Kept for local/manual testing of the DB→edge-function→API→hook→UI
// path without touching a real MELCloud account (see the integration spec's
// "Create a mocked MELCloud provider" testing guidance). Not imported by any
// production code path any more — providers/melcloud-home/index.js is now the
// real OAuth+PKCE implementation. Swap the import back to this file locally
// if you need to test the app without live MELCloud credentials.
//
// Mocked MELCloud Home provider — Step 1 of the Naprave/Devices module.
// No real network calls yet; returns realistic fake state so the DB,
// edge function, API route and UI can all be built and tested end to end
// before real MELCloud auth is wired in (per the implementation doc's own
// testing guidance: "Create a mocked MELCloud provider").
//
// Real implementation later swaps the bodies of these functions for actual
// calls to https://mobile.bff.melcloudhome.com — the function signatures
// and the HomeDevice shape they return are the real contract other layers
// (sync-home-devices edge function, /api/home-devices/[id]/command route)
// are built against, so they should not need to change when auth lands.

// --- in-memory mock state (Step 1 only; real provider reads from MELCloud) ---
const mockDevice = {
  externalId: 'mock-ata-unit-1',
  name: 'Klima',
  room: 'Dnevna soba',
  manufacturer: 'Mitsubishi Electric',
  model: 'MSZ-LN60VG3',
  online: true,
  power: true,
  currentTemperature: 22.4,
  targetTemperature: 22.0,
  mode: 'cool', // cool | heat | auto | dry | fan
  fanSpeed: 'auto', // auto | 1 | 2 | 3 | 4 | 5
  vaneHorizontal: 'both', // left | both | right (simplified from the raw API's 7-value enum)
  wifiSignal: 'good', // good | fair | poor
  outdoorTemperature: 26,
  error: null,
  capabilities: {
    modes: ['cool', 'heat', 'auto', 'dry', 'fan'],
    fanSpeeds: ['auto', '1', '2', '3', '4', '5'],
    hasHorizontalVane: true,
    hasVerticalVane: false,
    minTemperature: 16,
    maxTemperature: 31,
    halfDegreeIncrements: true,
  },
};

function toHomeDevice(raw) {
  return {
    id: raw.externalId,
    provider: 'melcloud_home',
    type: 'air_conditioner',
    name: raw.name,
    room: raw.room,
    manufacturer: raw.manufacturer,
    model: raw.model,
    externalId: raw.externalId,
    state: {
      online: raw.online,
      power: raw.power,
      currentTemperature: raw.currentTemperature,
      targetTemperature: raw.targetTemperature,
      mode: raw.mode,
      fanSpeed: raw.fanSpeed,
      vaneHorizontal: raw.vaneHorizontal,
      wifiSignal: raw.wifiSignal,
      outdoorTemperature: raw.outdoorTemperature,
      error: raw.error,
    },
    capabilities: raw.capabilities,
  };
}

/**
 * authenticate() — real provider does OAuth 2.0 + PKCE against MELCloud
 * Home's mobile BFF (see the upstream reference impl). Mocked version is a
 * no-op that resolves immediately; a token argument isn't needed yet since
 * nothing downstream checks it.
 */
export async function authenticate() {
  return { accessToken: 'mock-token', expiresAt: Date.now() + 3600_000 };
}

/**
 * getDevices() — real provider calls GET /context and returns every ATA
 * unit found there. Mocked version returns the single fake unit.
 */
export async function getDevices() {
  return [toHomeDevice(mockDevice)];
}

/**
 * getDevice(externalId) — used for the "refresh one device" path (manual
 * refresh button, and the immediate re-fetch after a command).
 */
export async function getDevice(externalId) {
  if (externalId !== mockDevice.externalId) return null;
  return toHomeDevice(mockDevice);
}

/**
 * Command functions — real provider sends a partial PUT to
 * /monitor/ataunit/{unit_id} with every other field null (per the API's
 * partial-update contract). Mocked version mutates the in-memory state
 * directly. All resolve void; callers re-fetch via getDevice() afterwards
 * rather than trusting an echoed response, matching the real API (200 with
 * an empty body).
 */
export async function setPower(externalId, on) {
  if (externalId !== mockDevice.externalId) throw new Error('unknown device');
  mockDevice.power = on;
}

export async function setTemperature(externalId, celsius) {
  if (externalId !== mockDevice.externalId) throw new Error('unknown device');
  mockDevice.targetTemperature = celsius;
}

export async function setMode(externalId, mode) {
  if (externalId !== mockDevice.externalId) throw new Error('unknown device');
  if (!mockDevice.capabilities.modes.includes(mode)) throw new Error(`unsupported mode: ${mode}`);
  mockDevice.mode = mode;
}

export async function setFanSpeed(externalId, fanSpeed) {
  if (externalId !== mockDevice.externalId) throw new Error('unknown device');
  if (!mockDevice.capabilities.fanSpeeds.includes(fanSpeed)) {
    throw new Error(`unsupported fan speed: ${fanSpeed}`);
  }
  mockDevice.fanSpeed = fanSpeed;
}

// Vertical vane omitted for this unit — capabilities.hasVerticalVane is
// false, so the UI never renders the control and this never gets called.
// Left in as a documented no-op for when a future unit does support it.
export async function setVerticalVane(_externalId, _position) {
  throw new Error('vertical vane not supported on this device');
}

export async function setHorizontalVane(externalId, position) {
  if (externalId !== mockDevice.externalId) throw new Error('unknown device');
  if (!['left', 'both', 'right'].includes(position)) {
    throw new Error(`unsupported vane position: ${position}`);
  }
  mockDevice.vaneHorizontal = position;
}
