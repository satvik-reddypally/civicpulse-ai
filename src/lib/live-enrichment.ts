import { GovApiData, LiveWeatherData, NearbyPlace } from '@/types/grievance';

export interface ReverseGeocodeResult {
  address: string;
  city: string;
  state: string;
  raw: Record<string, unknown>;
}

/**
 * 1. Live Reverse Geocoding via OpenStreetMap Nominatim API
 */
export async function fetchLiveReverseGeocode(lat: number, lon: number): Promise<ReverseGeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'CivicPulseAI-Hackathon-App/1.0 (civicpulse@example.org)',
      'Accept-Language': 'en',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Nominatim API error: ${res.status}`);
  }

  const data = await res.json();
  const addr = data.address || {};
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.county ||
    addr.state_district ||
    'Unknown City';
  const state = addr.state || 'India';
  const displayName = data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;

  return {
    address: displayName,
    city,
    state,
    raw: data,
  };
}

/**
 * 2. Live Critical Infrastructure Proximity via OpenStreetMap Overpass API (500m radius)
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

  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      cache: 'no-store',
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const elements = Array.isArray(data.elements) ? data.elements : [];

    return elements.map((el: Record<string, any>) => ({
      id: Number(el.id),
      name: el.tags?.name || `Unnamed ${el.tags?.amenity || 'Facility'}`,
      type: el.tags?.amenity || 'critical_infrastructure',
      lat: Number(el.lat || el.center?.lat || lat),
      lon: Number(el.lon || el.center?.lon || lon),
    }));
  } catch {
    return [];
  }
}

/**
 * 3. Live Hyper-Local Weather via Open-Meteo API
 */
export async function fetchLiveWeather(lat: number, lon: number): Promise<LiveWeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation,rain,weather_code,wind_speed_10m`;
  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    throw new Error(`Open-Meteo API failed with status ${res.status}`);
  }

  const data = await res.json();
  const current = data.current || {};
  const precipitation = Number(current.precipitation ?? 0);
  const rain = Number(current.rain ?? 0);

  return {
    temperature_c: Number(current.temperature_2m ?? 0),
    precipitation_mm: precipitation,
    rain_mm: rain,
    wind_speed_kmh: Number(current.wind_speed_10m ?? 0),
    weather_code: Number(current.weather_code ?? 0),
    is_raining: precipitation > 0 || rain > 0,
    fetched_at: new Date().toISOString(),
    source: 'api.open-meteo.com',
  };
}

/**
 * 4. Live Official Indian Government Data via Data.gov.in (CPCB Air Quality / Environmental Index)
 */
export async function fetchLiveGovData(stateName: string, cityName: string): Promise<GovApiData> {
  const apiKey = process.env.DATA_GOV_IN_API_KEY;
  if (!apiKey) {
    throw new Error('Missing DATA_GOV_IN_API_KEY in environment variables');
  }

  const baseUrl = 'https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69';
  const cityFilterUrl = `${baseUrl}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=5&filters[city]=${encodeURIComponent(cityName)}`;

  let res = await fetch(cityFilterUrl, { cache: 'no-store' });
  let data = res.ok ? await res.json() : null;

  if (!data || !Array.isArray(data.records) || data.records.length === 0) {
    const fallbackLiveUrl = `${baseUrl}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=5`;
    res = await fetch(fallbackLiveUrl, { cache: 'no-store' });
    data = res.ok ? await res.json() : { records: [] };
  }

  const records = (data.records || []).map((r: Record<string, any>) => ({
    station: r.station || 'CPCB Monitoring Station',
    city: r.city || cityName,
    state: r.state || stateName,
    pollutant_id: r.pollutant_id || 'PM2.5/PM10',
    pollutant_avg: String(r.pollutant_avg || r.avg_value || 'N/A'),
    last_update: r.last_update || new Date().toISOString(),
  }));

  return {
    source: 'api.data.gov.in (CPCB Real-Time Environmental Registry)',
    total_records_fetched: records.length,
    records,
    fetched_at: new Date().toISOString(),
  };
}

/**
 * 5. Deterministic Hybrid Urgency Score (0-100)
 */
export function computeHybridUrgencyScore(
  aiSeverityScore: number,
  nearbyCriticalCount: number,
  weather: LiveWeatherData
): { urgency_score: number; priority_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' } {
  // Base score from AI Vision Severity (1-10 -> 7 to 70 points)
  const basePoints = Math.min(10, Math.max(1, aiSeverityScore)) * 7;

  // Proximity boost for hospitals/schools/clinics within 500m (up to 18 points)
  const proximityBoost = Math.min(18, nearbyCriticalCount * 6);

  // Weather hazard multiplier (active rain/precipitation or high winds -> up to 12 points)
  let weatherBoost = 0;
  if (weather.is_raining || weather.precipitation_mm > 0) {
    weatherBoost += 10;
  }
  if (weather.wind_speed_kmh > 30) {
    weatherBoost += 2;
  }

  const totalScore = Math.min(100, Math.round(basePoints + proximityBoost + weatherBoost));

  let priority_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (totalScore >= 80) {
    priority_level = 'CRITICAL';
  } else if (totalScore >= 60) {
    priority_level = 'HIGH';
  } else if (totalScore >= 35) {
    priority_level = 'MEDIUM';
  }

  return { urgency_score: totalScore, priority_level };
}