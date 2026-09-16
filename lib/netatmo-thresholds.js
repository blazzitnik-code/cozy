// Shared Netatmo comfort thresholds — read by both DevicesModule.js (the
// Naprave card's colored CO2/vlaga stat rows + frost banner) and
// WeatherWidget.js (the home-screen "something needs attention" lines), so
// the two places can't quietly drift apart on what counts as "bad".
// Mocked with B in the "Vremenske postaje" artifact
// (claude.ai/artifact/EeYUgnwzQ5Y7WZMhxkQ9rj, v9) before being built for
// real — thresholds below match that mock.

export const LOW_BATTERY_PERCENT = 25;
export const FROST_TEMP_C = 2;

// CO2 comfort tiers (ppm): <800 fresh, 800–1200 stuffy/time to air out,
// >1200 poor.
export function co2Tier(ppm) {
  if (ppm == null) return null;
  if (ppm < 800) return 'good';
  if (ppm <= 1200) return 'mid';
  return 'bad';
}

// Indoor humidity comfort tiers (%): 40–60 comfortable, 30–40/60–70 a bit
// dry or humid, outside that too dry (static, dry air) or mold/condensation
// risk.
export function humidityTier(pct) {
  if (pct == null) return null;
  if (pct >= 40 && pct <= 60) return 'good';
  if (pct >= 30 && pct <= 70) return 'mid';
  return 'bad';
}
