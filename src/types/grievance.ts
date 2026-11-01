export interface WeatherTelemetry {
  temperature_c: number | string;
  precipitation_mm: number;
  rain_mm?: number;
  wind_speed_kmh?: number;
  weather_condition: string;
  is_raining?: boolean;
}

export interface AirQualityTelemetry {
  pm25: number | string;
  pm10?: number | string;
  aqi_status: string;
  station_name?: string;
  total_records_fetched?: number;
  records?: unknown[];
  source?: string;
}

export interface LiveEnrichmentContext {
  address_display?: string;
  nearby_critical_infrastructure: string[];
  weather: WeatherTelemetry;
  air_quality: AirQualityTelemetry;
}

export interface AgentTraceStep {
  step: number;
  name: string;
  source: string;
  detail: string;
  timestamp: string;
}

export type AgentLogStep = AgentTraceStep;
export type LiveWeatherData = WeatherTelemetry;
export type GovApiData = AirQualityTelemetry;

export interface NearbyPlace {
  name: string;
  type: string;
  lat: number;
  lon: number;
  distance_meters: number;
}

export interface AIAnalysisResult {
  title: string;
  category: string;
  responsible_department: string;
  department?: string;
  priority_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgency_score: number;
  ai_severity_score?: number;
  statutory_sla_hours: number;
  sla_hours?: number;
  ai_summary: string;
  english_summary?: string;
  regional_summary?: string;
  regional_citizen_explainer: string;
  formal_legal_notice: string;
  legal_notice_draft?: string;
  is_valid_civic_issue?: boolean;
  rejection_reason?: string;
}

export interface GrievanceRecord {
  id: string;
  created_at: string;
  title: string;
  category: string;
  responsible_department: string;
  priority_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgency_score: number;
  statutory_sla_hours: number;
  ai_summary: string;
  citizen_note?: string;
  citizen_language: string;
  regional_citizen_explainer: string;
  formal_legal_notice: string;
  image_url: string;
  latitude: number;
  longitude: number;
  address_display: string;
  upvotes: number;
  status?: string;
  live_weather_context: LiveEnrichmentContext;
  agent_execution_trace: AgentTraceStep[];
}