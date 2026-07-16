'use client';
import { useState, useEffect, useCallback } from 'react';
import { useHomeSettings } from '@/lib/hooks';

const LPP_BASE = 'https://data.lpp.si/api';
const BIKE_API_KEY = process.env.NEXT_PUBLIC_BICIKELJ_API_KEY;
const BIKE_CONTRACT = 'ljubljana';

async function fetchLppStations() {
  try {
    const res = await fetch(`${LPP_BASE}/station/active-stations`);
    const json = await res.json();
    return json?.data || [];
  } catch { return []; }
}

async function fetchBusArrivals(stationCode) {
  try {
    const res = await fetch(`${LPP_BASE}/station/arrival-on-station?station-code=${stationCode}&route-id=&limit=5`);
    const json = await res.json();
    return json?.data || [];
  } catch { return []; }
}

async function fetchAllBikeStations() {
  try {
    const res = await fetch(`https://api.jcdecaux.com/vls/v1/stations?contract=${BIKE_CONTRACT}&apiKey=${BIKE_API_KEY}`);
    return await res.json();
  } catch { return []; }
}

function mapsNavLink(from, to) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from || '')}&destination=${encodeURIComponent(to || '')}&travelmode=driving`;
}
function mapsTrafficLink(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || 'Ljubljana')}`;
}

// ─── STATION SEARCH DROPDOWN ───
function StationSearch({ placeholder, stations, onSelect, isDark, st }) {
  const [query, setQuery] = useState('');
  const results = query.length > 1
    ? stations.filter(s => s.name?.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
    : [];

  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} style={st.INP} />
      {results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: isDark ? '#1E293B' : '#fff', border: st.cardBorder, borderRadius: 10, zIndex: 50, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', marginTop: 4 }}>
          {results.map((s, i) => (
            <div key={i} onClick={() => { onSelect(s); setQuery(''); }}
              style={{ padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: st.textPrimary, borderBottom: i < results.length - 1 ? `1px solid ${isDark ? 'rgba(71,85,105,0.15)' : 'rgba(99,102,241,0.08)'}` : 'none' }}>
              {s.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EDIT MODAL ───
function EditModal({ settings, onSave, onClose, isDark, st }) {
  const [homeAddress, setHomeAddress] = useState(settings?.home_address || '');
  const [destinations, setDestinations] = useState(settings?.destinations?.length ? settings.destinations : []);
  const [shortcuts, setShortcuts] = useState(settings?.shortcuts?.length ? settings.shortcuts : []);
  const [busStops, setBusStops] = useState(settings?.bus_stops?.length ? settings.bus_stops : []);
  const [bikeStations, setBikeStations] = useState(settings?.bike_stations?.length ? settings.bike_stations : []);
  const [lppStations, setLppStations] = useState([]);
  const [allBikeStations, setAllBikeStations] = useState([]);
  const [loadingStations, setLoadingStations] = useState(true);

  useEffect(() => {
    Promise.all([fetchLppStations(), fetchAllBikeStations()])
      .then(([lpp, bike]) => { setLppStations(lpp); setAllBikeStations(Array.isArray(bike) ? bike : []); })
      .finally(() => setLoadingStations(false));
  }, []);

  const handleSave = () => {
    onSave({
      home_address: homeAddress,
      destinations: destinations.filter(d => d.name && d.address),
      shortcuts: shortcuts.filter(s => s.name && s.url),
      bus_stops: busStops.filter(s => s.name && s.code),
      bike_stations: bikeStations.filter(s => s.name && s.number !== undefined),
    });
  };

  const row = { display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' };
  const chip = { flex: 1, background: isDark ? 'rgba(30,41,59,0.5)' : 'rgba(99,102,241,0.05)', border: st.cardBorder, borderRadius: 10, padding: '8px 12px' };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: isDark ? 'linear-gradient(180deg,#1E293B,#0F172A)' : '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 430, padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: isDark ? '#334155' : '#CBD5E1', borderRadius: 2, margin: '0 auto 20px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: st.textPrimary, margin: '0 0 20px' }}>🏠 Nastavitve</h3>

        {/* Home address */}
        <label style={st.LBL}>Domači naslov</label>
        <input value={homeAddress} onChange={e => setHomeAddress(e.target.value)} placeholder="npr. Slovenska 1, Ljubljana" style={{ ...st.INP, marginBottom: 20 }} />

        {/* Destinations */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={st.LBL}>📍 Navigacija (max 3)</label>
            {destinations.length < 3 && <button onClick={() => setDestinations([...destinations, { name: '', address: '' }])} style={st.ADDBTN}>+ Dodaj</button>}
          </div>
          {destinations.map((d, i) => (
            <div key={i} style={row}>
              <input value={d.name} onChange={e => { const n = [...destinations]; n[i] = { ...n[i], name: e.target.value }; setDestinations(n); }} placeholder="Ime" style={{ ...st.INP, flex: '0 0 90px' }} />
              <input value={d.address} onChange={e => { const n = [...destinations]; n[i] = { ...n[i], address: e.target.value }; setDestinations(n); }} placeholder="Naslov" style={{ ...st.INP, flex: 1 }} />
              <button onClick={() => setDestinations(destinations.filter((_, j) => j !== i))} style={st.RMBTN}>✕</button>
            </div>
          ))}
        </div>

        {/* Shortcuts */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={st.LBL}>🔗 Bližnjice (max 6)</label>
            {shortcuts.length < 6 && <button onClick={() => setShortcuts([...shortcuts, { name: '', url: '', emoji: '' }])} style={st.ADDBTN}>+ Dodaj</button>}
          </div>
          {shortcuts.map((s, i) => (
            <div key={i} style={row}>
              <input value={s.emoji} onChange={e => { const n = [...shortcuts]; n[i] = { ...n[i], emoji: e.target.value }; setShortcuts(n); }} placeholder="🔗" style={{ ...st.INP, flex: '0 0 48px', textAlign: 'center', fontSize: 18 }} />
              <input value={s.name} onChange={e => { const n = [...shortcuts]; n[i] = { ...n[i], name: e.target.value }; setShortcuts(n); }} placeholder="Ime" style={{ ...st.INP, flex: '0 0 90px' }} />
              <input value={s.url} onChange={e => { const n = [...shortcuts]; n[i] = { ...n[i], url: e.target.value }; setShortcuts(n); }} placeholder="https://..." style={{ ...st.INP, flex: 1 }} />
              <button onClick={() => setShortcuts(shortcuts.filter((_, j) => j !== i))} style={st.RMBTN}>✕</button>
            </div>
          ))}
        </div>

        {/* LPP bus stops */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={st.LBL}>🚌 LPP postaje (max 3)</label>
          </div>
          {busStops.map((s, i) => (
            <div key={i} style={row}>
              <div style={chip}>
                <div style={{ fontSize: 13, fontWeight: 600, color: st.textPrimary }}>{s.name}</div>
                <div style={{ fontSize: 11, color: st.textSecondary }}>Koda: {s.code}</div>
              </div>
              <button onClick={() => setBusStops(busStops.filter((_, j) => j !== i))} style={st.RMBTN}>✕</button>
            </div>
          ))}
          {busStops.length < 3 && (
            loadingStations
              ? <div style={{ fontSize: 12, color: st.textSecondary, padding: '8px 0' }}>Nalagam postaje...</div>
              : lppStations.length > 0
                ? <StationSearch placeholder="Išči postajo LPP..." stations={lppStations}
                    onSelect={s => setBusStops([...busStops, { name: s.name, code: s.ref_id || s.station_code || s.code || String(s.id || '') }])}
                    isDark={isDark} st={st} />
                : <div style={{ fontSize: 12, color: st.textSecondary, padding: '8px 0' }}>Iskanje ni na voljo — vnesi kodo postaje ročno na <span style={{ color: '#818CF8' }}>opendata.si/lpp</span></div>
          )}
        </div>

        {/* BicikeLJ stations */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={st.LBL}>🚲 BicikeLJ (max 3)</label>
          </div>
          {bikeStations.map((s, i) => (
            <div key={i} style={row}>
              <div style={chip}>
                <div style={{ fontSize: 13, fontWeight: 600, color: st.textPrimary }}>{s.name}</div>
                <div style={{ fontSize: 11, color: st.textSecondary }}>Postaja #{s.number}</div>
              </div>
              <button onClick={() => setBikeStations(bikeStations.filter((_, j) => j !== i))} style={st.RMBTN}>✕</button>
            </div>
          ))}
          {bikeStations.length < 3 && (
            loadingStations
              ? <div style={{ fontSize: 12, color: st.textSecondary, padding: '8px 0' }}>Nalagam postaje...</div>
              : <StationSearch placeholder="Išči postajo BicikeLJ..."
                  stations={allBikeStations.map(s => ({ name: s.name, number: s.number }))}
                  onSelect={s => setBikeStations([...bikeStations, { name: s.name, number: s.number }])}
                  isDark={isDark} st={st} />
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSave} style={{ flex: 1, padding: 14, borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#F97316,#E85D04)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Shrani</button>
          <button onClick={onClose} style={{ flex: 1, padding: 14, borderRadius: 14, border: st.cardBorder, background: 'transparent', color: st.textSecondary, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>Prekliči</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───
export default function HomeModule({ user, householdId, isDark }) {
  const { settings, loading, saveSettings } = useHomeSettings(householdId, user.id);
  const [editing, setEditing] = useState(false);
  const [busData, setBusData] = useState({});
  const [bikeData, setBikeData] = useState({});

  const st = {
    cardBg: isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.9)',
    cardBorder: isDark ? '1px solid rgba(71,85,105,0.2)' : '1px solid rgba(99,102,241,0.15)',
    textPrimary: isDark ? '#E2E8F0' : '#1E293B',
    textSecondary: isDark ? '#64748B' : '#94A3B8',
    INP: { width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: isDark ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.9)', border: isDark ? '1px solid rgba(71,85,105,0.3)' : '1px solid rgba(99,102,241,0.2)', borderRadius: 10, color: isDark ? '#E2E8F0' : '#1E293B', fontSize: 14, outline: 'none' },
    LBL: { fontSize: 11, fontWeight: 700, color: isDark ? '#64748B' : '#94A3B8', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
    ADDBTN: { fontSize: 11, padding: '4px 10px', borderRadius: 8, border: 'none', background: 'rgba(99,102,241,0.15)', color: '#818CF8', cursor: 'pointer', fontWeight: 700 },
    RMBTN: { width: 36, height: 36, borderRadius: 8, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#EF4444', cursor: 'pointer', flexShrink: 0, fontSize: 14 },
  };

  const refreshBus = useCallback(async () => {
    if (!settings?.bus_stops?.length) return;
    for (const stop of settings.bus_stops) {
      if (!stop.code) continue;
      const arrivals = await fetchBusArrivals(stop.code);
      setBusData(prev => ({ ...prev, [stop.code]: arrivals }));
    }
  }, [settings]);

  const refreshBike = useCallback(async () => {
    if (!settings?.bike_stations?.length) return;
    const all = await fetchAllBikeStations();
    if (!Array.isArray(all)) return;
    const map = {};
    for (const station of settings.bike_stations) {
      const found = all.find(s => s.number === station.number);
      if (found) map[station.number] = found;
    }
    setBikeData(map);
  }, [settings]);

  useEffect(() => {
    refreshBus();
    refreshBike();
    const interval = setInterval(refreshBus, 120000);
    return () => clearInterval(interval);
  }, [refreshBus, refreshBike]);

  const handleSave = async (data) => {
    await saveSettings(data);
    setEditing(false);
  };

  if (loading) return null;

  const destinations = settings?.destinations || [];
  const shortcuts = settings?.shortcuts || [];
  const busStops = settings?.bus_stops || [];
  const bikeStations = settings?.bike_stations || [];
  const SECTION_LABEL = { fontSize: 11, fontWeight: 700, color: isDark ? '#334155' : '#CBD5E1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 };

  // ─── EMPTY STATE ───
  if (!settings?.home_address) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={SECTION_LABEL}>Promet & bližnjice</div>
        <div onClick={() => setEditing(true)} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 16, padding: '20px 16px', textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏠</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: st.textPrimary, marginBottom: 4 }}>Nastavi promet & bližnjice</div>
          <div style={{ fontSize: 12, color: st.textSecondary }}>Avtobusi, navigacija, bližnjice do aplikacij</div>
        </div>
        {editing && <EditModal settings={settings} onSave={handleSave} onClose={() => setEditing(false)} isDark={isDark} st={st} />}
      </div>
    );
  }

  // ─── MAIN DISPLAY ───
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={SECTION_LABEL}>Promet & bližnjice</div>
        <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: st.textSecondary, fontSize: 16, cursor: 'pointer', padding: 4 }}>✎</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Traffic → Google Maps */}
        <a href={mapsTrafficLink(settings.home_address)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>🚦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: st.textPrimary }}>Promet</div>
              <div style={{ fontSize: 12, color: st.textSecondary }}>Poglej v Google Maps →</div>
            </div>
          </div>
        </a>

        {/* Destinations grid */}
        {destinations.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: destinations.length === 1 ? '1fr' : destinations.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8 }}>
            {destinations.map((dest, i) => (
              <a key={i} href={mapsNavLink(settings.home_address, dest.address)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>📍</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: st.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dest.name}</div>
                  <div style={{ fontSize: 10, color: '#0EA5E9', marginTop: 2 }}>Navigiraj →</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Shortcuts grid (always 2 cols except 1 = full width) */}
        {shortcuts.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: shortcuts.length === 1 ? '1fr' : '1fr 1fr', gap: 8 }}>
            {shortcuts.map((s, i) => (
              <a key={i} href={s.url.startsWith('http') ? s.url : 'https://' + s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{s.emoji || '🔗'}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: st.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* LPP bus arrivals */}
        {busStops.map((stop, i) => {
          const arrivals = busData[stop.code] || [];
          return (
            <div key={i} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: arrivals.length > 0 ? 8 : 0 }}>
                <span style={{ fontSize: 18 }}>🚌</span>
                <div style={{ fontSize: 14, fontWeight: 700, color: st.textPrimary, flex: 1 }}>{stop.name}</div>
                <button onClick={refreshBus} style={{ background: 'none', border: 'none', color: st.textSecondary, cursor: 'pointer', fontSize: 14, padding: 4 }}>↻</button>
              </div>
              {arrivals.length === 0
                ? <div style={{ fontSize: 12, color: st.textSecondary }}>Ni podatkov</div>
                : arrivals.slice(0, 3).map((arr, j) => {
                    const eta = arr.eta_min ?? arr.eta ?? arr.eta_seconds;
                    const etaMin = arr.eta_seconds != null ? Math.round(arr.eta_seconds / 60) : eta;
                    return (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderTop: j > 0 ? `1px solid ${isDark ? 'rgba(71,85,105,0.1)' : 'rgba(99,102,241,0.06)'}` : 'none' }}>
                        <span style={{ fontWeight: 700, color: st.textPrimary }}>{arr.route_name || arr.route_id || arr.line || '—'}</span>
                        <span style={{ color: etaMin <= 2 ? '#22C55E' : st.textSecondary, fontWeight: 600 }}>
                          {etaMin <= 0 ? '🟢 Prihaja' : `${etaMin} min`}
                        </span>
                      </div>
                    );
                  })
              }
            </div>
          );
        })}

        {/* BicikeLJ */}
        {bikeStations.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: bikeStations.length === 1 ? '1fr' : bikeStations.length === 2 ? '1fr 1fr' : '1fr 1fr 1fr', gap: 8 }}>
            {bikeStations.map((station, i) => {
              const data = bikeData[station.number];
              const available = data?.available_bikes ?? '?';
              const stands = data?.available_bike_stands ?? '?';
              return (
                <div key={i} style={{ background: st.cardBg, border: st.cardBorder, borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>🚲</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: st.textPrimary, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{station.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: available === 0 ? '#EF4444' : '#22C55E', lineHeight: 1 }}>{available}</div>
                  <div style={{ fontSize: 10, color: st.textSecondary, marginTop: 2 }}>{stands} mest</div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {editing && <EditModal settings={settings} onSave={handleSave} onClose={() => setEditing(false)} isDark={isDark} st={st} />}
    </div>
  );
}
