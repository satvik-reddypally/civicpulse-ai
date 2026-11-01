import { GovApiData, LiveWeatherData, NearbyPlace } from '@/types/grievance';

export interface ReverseGeocodeResult {
  address: string;
  city: string;
  state: string;
  raw: Record<string, unknown>;
}

// Nominatim / Overpass require a real, identifying User-Agent (placeholder emails get blocked with 403).
const UA = 'CivicPulseAI/1.0 (+https://civicpulse-ai-ivory.vercel.app)';
const TIMEOUT_MS = 7000;

async function fetchJson(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${new URL(url).hostname} responded ${res.status}`);
  }
  return res.json();
}

/**
 * 1. Reverse geocoding with a fallback chain. NEVER throws:
 *    Nominatim -> Photon (OSM data) -> BigDataCloud -> raw coordinates.
 */
export async function fetchLiveReverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const coordLabel = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

  // Attempt 1: Nominatim
  try {
    const data = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } }
    );
    const a = data.address || {};
    return {
      address: data.display_name || coordLabel,
      city: a.city || a.town || a.village || a.municipality || a.county || a.state_district || 'Unknown City',
      state: a.state || 'India',
      raw: { provider: 'nominatim' },
    };
  } catch (e) {
    console.warn('[geocode] Nominatim failed:', e instanceof Error ? e.message : e);
  }

  // Attempt 2: Photon (also OpenStreetMap data)
  try {
    const data = await fetchJson(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=en`, {
      headers: { 'User-Agent': UA },
    });
    const p = data.features?.[0]?.properties;
    if (p) {
      const line = [p.name, p.street, p.district, p.city || p.county, p.state, p.country].filter(Boolean).join(', ');
      return {
        address: line || coordLabel,
        city: p.city || p.county || p.district || 'Unknown City',
        state: p.state || 'India',
        raw: { provider: 'photon' },
      };
    }
  } catch (e) {
    console.warn('[geocode] Photon failed:', e instanceof Error ? e.message : e);
  }

  // Attempt 3: BigDataCloud (free, no key)
  try {
    const d = await fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const city = d.city || d.locality || 'Unknown City';
    const state = d.principalSubdivision || 'India';
    return {
      address: [d.locality, d.city, state, d.countryName].filter(Boolean).join(', ') || coordLabel,
      city,
      state,
      raw: { provider: 'bigdatacloud' },
    };
  } catch (e) {
    console.warn('[geocode] BigDataCloud failed:', e instanceof Error ? e.message : e);
  }

  // Last resort: the report still goes through
  return { address: coordLabel, city: 'Unknown City', state: 'India', raw: { provider: 'coordinates-only' } };
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

/**
 * 2. Critical infrastructure within 500m via Overpass (tries two mirrors). NEVER throws.
 */
export async function fetchNearbyCriticalInfrastructure(lat: number, lon: number): Promise<NearbyPlace[]> {
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"~"hospital|clinic|school|college|fire_station|police"](around:500,${lat},${lon});
      way["amenity"~"hospital|clinic|school|college|fire_station|police"](around:500,${lat},${lon});
    );
    out center 10;
  `;

  for (const endpoint of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const data = await fetchJson(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(query)}`,
      });
      const elements: any[] = Array.isArray(data.elements) ? data.elements : [];
      return elements.map((el) => {
        const pLat = Number(el.lat ?? el.center?.lat ?? lat);
        const pLon = Number(el.lon ?? el.center?.lon ?? lon);
        return {
          id: Number(el.id),
          name: el.tags?.name || `Unnamed ${el.tags?.amenity || 'Facility'}`,
          type: el.tags?.amenity || 'critical_infrastructure',
          lat: pLat,
          lon: pLon,
          distance_meters: haversineMeters(lat, lon, pLat, pLon),
        };
      });
    } catch (e) {
      console.warn('[overpass] failed:', endpoint, e instanceof Error ? e.message : e);
    }
  }
  return [];
}

function describeWeatherCode(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

/**
 * 3. Live weather via Open-Meteo. NEVER throws.
 */
export async function fetchLiveWeather(lat: number, lon: number): Promise<LiveWeatherData> {
  try {
    const data = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,rain,weather_code,wind_speed_10m`
    );
    const c = data.current || {};
    const precipitation = Number(c.precipitation ?? 0);
    const rain = Number(c.rain ?? 0);
    const code = Number(c.weather_code ?? 0);
    return {
      temperature_c: Number(c.temperature_2m ?? 0),
      precipitation_mm: precipitation,
      rain_mm: rain,
      wind_speed_kmh: Number(c.wind_speed_10m ?? 0),
      weather_code: code,
      weather_condition: describeWeatherCode(code),
      is_raining: precipitation > 0 || rain > 0,
      fetched_at: new Date().toISOString(),
      source: 'api.open-meteo.com',
    };
  } catch (e) {
    console.warn('[weather] failed:', e instanceof Error ? e.message : e);
    return {
      temperature_c: 0,
      precipitation_mm: 0,
      rain_mm: 0,
      wind_speed_kmh: 0,
      weather_code: 0,
      weather_condition: 'Unavailable',
      is_raining: false,
      fetched_at: new Date().toISOString(),
      source: 'unavailable',
    };
  }
}

function aqiStatusFromPm25(pm25: number | null): string {
  if (pm25 === null) return 'Monitored';
  if (pm25 <= 30) return 'Good';
  if (pm25 <= 60) return 'Satisfactory';
  if (pm25 <= 90) return 'Moderate';
  if (pm25 <= 120) return 'Poor';
  if (pm25 <= 250) return 'Very Poor';
  return 'Severe';
}

/**
 * 4. CPCB air-quality records from Data.gov.in. NEVER throws (missing key or API failure -> empty data).
 */
export async function fetchLiveGovData(stateName: string, cityName: string): Promise<GovApiData> {
  const empty: GovApiData = {
    source: 'api.data.gov.in (unavailable)',
    total_records_fetched: 0,
    records: [],
    pm25: 'N/A',
    aqi_status: 'Monitored',
    fetched_at: new Date().toISOString(),
  };

  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    console.warn('[gov] DATA_GOV_IN_API_KEY not set');
    return empty;
  }

  try {
    const baseUrl = 'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69';
    const key = encodeURIComponent(apiKey);
    let data: any = null;
    try {
      data = await fetchJson(`${baseUrl}?api-key=${key}&format=json&limit=20&filters[city]=${encodeURIComponent(cityName)}`);
    } catch {
      data = null;
    }
    if (!data || !Array.isArray(data.records) || data.records.length === 0) {
      data = await fetchJson(`${baseUrl}?api-key=${key}&format=json&limit=20`);
    }

    const records = (data.records || []).map((r: Record<string, any>) => ({
      station: r.station || 'CPCB Monitoring Station',
      city: r.city || cityName,
      state: r.state || stateName,
      pollutant_id: r.pollutant_id || 'PM2.5/PM10',
      pollutant_avg: String(r.pollutant_avg ?? r.avg_value ?? 'N/A'),
      last_update: r.last_update || new Date().toISOString(),
    }));

    const pm25Row = records.find((r: any) => String(r.pollutant_id).toUpperCase().includes('PM2.5'));
    const pm25Num = pm25Row && !isNaN(Number(pm25Row.pollutant_avg)) ? Number(pm25Row.pollutant_avg) : null;

    return {
      source: 'api.data.gov.in (CPCB Real-Time Environmental Registry)',
      total_records_fetched: records.length,
      records: records.slice(0, 5),
      pm25: pm25Num ?? 'N/A',
      aqi_status: aqiStatusFromPm25(pm25Num),
      station_name: pm25Row?.station,
      fetched_at: new Date().toISOString(),
    };
  } catch (e) {
    console.warn('[gov] failed:', e instanceof Error ? e.message : e);
    return empty;
  }
}

/**
 * 5. Deterministic Hybrid Urgency Score (0-100)
 */
export function computeHybridUrgencyScore(
  aiSeverityScore: number,
  nearbyCriticalCount: number,
  weather: LiveWeatherData
): { urgency_score: number; priority_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
  const basePoints = Math.min(10, Math.max(1, aiSeverityScore)) * 7;
  const proximityBoost = Math.min(18, nearbyCriticalCount * 6);

  let weatherBoost = 0;
  if (weather.is_raining || Number(weather.precipitation_mm) > 0) weatherBoost += 10;
  if (Number(weather.wind_speed_kmh ?? 0) > 30) weatherBoost += 2;

  const totalScore = Math.min(100, Math.round(basePoints + proximityBoost + weatherBoost));

  let priority_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (totalScore >= 80) priority_level = 'CRITICAL';
  else if (totalScore >= 60) priority_level = 'HIGH';
  else if (totalScore >= 35) priority_level = 'MEDIUM';

  return { urgency_score: totalScore, priority_level };
}