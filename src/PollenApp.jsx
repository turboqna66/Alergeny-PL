import React, { useState, useEffect, useCallback } from 'react';

// ---- Config ----
const ALLERGENS = [
  {
    key: 'birch_pollen',
    label: 'Brzoza',
    season: 'marzec–maj',
    color: '#c7572a', // terracotta
  },
  {
    key: 'grass_pollen',
    label: 'Trawy (w tym żyto)',
    season: 'maj–lipiec',
    color: '#3a7d44', // grass green
    note: 'Żyto nie ma osobnego wskaźnika w danych — model traktuje je razem z trawami.',
  },
  {
    key: 'mugwort_pollen',
    label: 'Bylica',
    season: 'lipiec–wrzesień',
    color: '#7a5c3e', // earthy brown
  },
];

const LEVELS = [
  { max: 10, label: 'Niski', short: 'Niski', textColor: '#2f6b3a' },
  { max: 30, label: 'Umiarkowany', short: 'Umiark.', textColor: '#9a7b1f' },
  { max: 70, label: 'Wysoki', short: 'Wysoki', textColor: '#c7572a' },
  { max: Infinity, label: 'Bardzo wysoki', short: 'B. wysoki', textColor: '#a3281f' },
];

const DEFAULT_CITIES = [
  { name: 'Warszawa', lat: 52.2297, lon: 21.0122 },
  { name: 'Kraków', lat: 50.0647, lon: 19.945 },
  { name: 'Wrocław', lat: 51.1079, lon: 17.0385 },
  { name: 'Gdańsk', lat: 54.352, lon: 18.6466 },
  { name: 'Poznań', lat: 52.4064, lon: 16.9252 },
];

function levelFor(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return LEVELS.find((l) => value <= l.max) || LEVELS[LEVELS.length - 1];
}

function formatDay(dateStr, idx) {
  const d = new Date(dateStr);
  if (idx === 0) return 'Dziś';
  if (idx === 1) return 'Jutro';
  return d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

// Signature visual: pollen "drift" bars instead of generic progress bars.
// Height + particle density encode intensity at a glance.
function PollenDrift({ value, color }) {
  const lvl = levelFor(value);
  if (!lvl) {
    return (
      <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 11 }}>
        brak danych
      </div>
    );
  }
  const pct = Math.min(100, (value / 80) * 100);
  const particles = Math.max(2, Math.round((pct / 100) * 9));

  return (
    <div style={{ position: 'relative', height: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          width: 22,
          height: `${Math.max(8, pct)}%`,
          background: `linear-gradient(180deg, ${color}33, ${color})`,
          borderRadius: '3px 3px 1px 1px',
          transition: 'height 0.4s ease',
        }}
      />
      {Array.from({ length: particles }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: `${10 + ((i * 37) % 80)}%`,
            left: `${50 + (((i * 53) % 60) - 30)}%`,
            width: 2.5,
            height: 2.5,
            borderRadius: '50%',
            background: color,
            opacity: 0.35 + (i % 3) * 0.15,
          }}
        />
      ))}
    </div>
  );
}

// Na realnej stronie (poza artifaktem Claude) geolokalizacja i fetch
// działają bez dodatkowych ograniczeń iframe.
export default function PollenApp() {
  const [coords, setCoords] = useState(DEFAULT_CITIES[0]);
  const [cityName, setCityName] = useState(DEFAULT_CITIES[0].name);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geoTried, setGeoTried] = useState(false);

  const fetchData = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const fields = ALLERGENS.map((a) => a.key).join(',');
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=${fields}&timezone=auto&forecast_days=5`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Błąd serwera danych pyłkowych');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError('Nie udało się pobrać danych. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(coords.lat, coords.lon);
  }, [coords, fetchData]);

  const tryGeolocation = () => {
    setGeoTried(true);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setCityName('Twoja lokalizacja');
      },
      () => {
        // silently keep default city on denial
      },
      { timeout: 8000 }
    );
  };

  // Derive daily max per allergen from hourly data
  const dailyData = React.useMemo(() => {
    if (!data || !data.hourly) return [];
    const { time } = data.hourly;
    const dayMap = {};
    time.forEach((t, idx) => {
      const day = t.slice(0, 10);
      if (!dayMap[day]) dayMap[day] = { date: day, values: {} };
      ALLERGENS.forEach((a) => {
        const v = data.hourly[a.key]?.[idx];
        if (v === undefined || v === null) return;
        if (dayMap[day].values[a.key] === undefined || v > dayMap[day].values[a.key]) {
          dayMap[day].values[a.key] = v;
        }
      });
    });
    return Object.values(dayMap).slice(0, 5);
  }, [data]);

  const today = dailyData[0];

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        background: '#faf7f2',
        minHeight: '100vh',
        color: '#2b2620',
        maxWidth: 480,
        margin: '0 auto',
        paddingBottom: 32,
      }}
    >
      {/* Header */}
      <div style={{ padding: '28px 20px 16px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9a8f7f', fontWeight: 600 }}>
          Monitoring pyłków
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, fontFamily: "'Georgia', serif" }}>{cityName}</h1>
          <button
            onClick={tryGeolocation}
            style={{
              fontSize: 12,
              border: 'none',
              background: 'none',
              color: '#c7572a',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            📍 Moja lokalizacja
          </button>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DEFAULT_CITIES.map((c) => (
            <button
              key={c.name}
              onClick={() => {
                setCoords(c);
                setCityName(c.name);
              }}
              style={{
                fontSize: 12,
                padding: '5px 10px',
                borderRadius: 14,
                border: cityName === c.name ? '1px solid #c7572a' : '1px solid #e2dccf',
                background: cityName === c.name ? '#fdeee6' : 'transparent',
                color: cityName === c.name ? '#c7572a' : '#6b6256',
                cursor: 'pointer',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9a8f7f', fontSize: 14 }}>Ładowanie danych…</div>
      )}

      {error && (
        <div style={{ padding: 20, margin: '0 20px', background: '#fbe9e7', borderRadius: 10, color: '#a3281f', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && !error && today && (
        <>
          {/* Today summary */}
          <div style={{ padding: '8px 20px 4px' }}>
            <div style={{ fontSize: 12, color: '#9a8f7f', marginBottom: 10 }}>Dziś</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {ALLERGENS.map((a) => {
                const v = today.values[a.key];
                const lvl = levelFor(v);
                return (
                  <div
                    key={a.key}
                    style={{
                      background: '#fff',
                      borderRadius: 14,
                      padding: '14px 8px 12px',
                      textAlign: 'center',
                      border: '1px solid #efe9dd',
                    }}
                  >
                    <PollenDrift value={v} color={a.color} />
                    <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>{a.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: lvl ? lvl.textColor : '#bbb' }}>
                      {lvl ? lvl.label : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10.5, color: '#a39a8c', marginTop: 10, lineHeight: 1.4 }}>
              Żyto nie ma osobnego wskaźnika w danych źródłowych — ujęte łącznie z trawami. Dane: Open-Meteo / CAMS, rozdzielczość ok. 11 km, nie są to pomiary lokalne.
            </div>
          </div>

          {/* 5-day forecast */}
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ fontSize: 12, color: '#9a8f7f', marginBottom: 10 }}>Prognoza 5-dniowa</div>
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #efe9dd', overflow: 'hidden' }}>
              {dailyData.map((day, idx) => (
                <div
                  key={day.date}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: idx < dailyData.length - 1 ? '1px solid #f3efe5' : 'none',
                  }}
                >
                  <div style={{ width: 64, fontSize: 13, fontWeight: 600, color: '#4a4338' }}>
                    {formatDay(day.date, idx)}
                  </div>
                  <div style={{ flex: 1, display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
                    {ALLERGENS.map((a) => {
                      const v = day.values[a.key];
                      const lvl = levelFor(v);
                      return (
                        <div key={a.key} style={{ textAlign: 'center', minWidth: 38 }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: lvl ? a.color : '#e2dccf',
                              opacity: lvl ? 0.4 + Math.min(1, (v / 70)) * 0.6 : 1,
                              margin: '0 auto 4px',
                            }}
                          />
                          <div style={{ fontSize: 9.5, color: '#9a8f7f' }}>{lvl ? lvl.short : '—'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Season info */}
          <div style={{ padding: '20px 20px 0' }}>
            <div style={{ fontSize: 12, color: '#9a8f7f', marginBottom: 10 }}>Sezony pylenia</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ALLERGENS.map((a) => (
                <div
                  key={a.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12.5,
                    padding: '8px 14px',
                    background: '#fff',
                    borderRadius: 10,
                    border: '1px solid #efe9dd',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{a.label}</span>
                  <span style={{ color: '#9a8f7f' }}>{a.season}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ padding: '24px 20px 0', fontSize: 10.5, color: '#b5ab9c', textAlign: 'center' }}>
        Prototyp · dane: Open-Meteo (CAMS) · nie zastępuje porady lekarskiej
      </div>
    </div>
  );
}
