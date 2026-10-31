export interface NearbyPlace {
  id: number;
  name: string;
  type: string;
  lat: number;
  lon: number;
}

export interface LiveWeatherData {
  temperature_c: number;
  precipitation_mm: number;
  rain_mm: number;
  wind_speed_kmh: number;
  weather_code: number;
  is_raining: boolean;
  fetched_at: string;
  source: string;
}

export interface GovApiRecord {
  station?: string;
  city?: string;
  state?: string;
  pollutant_id?: string;
  pollutant_avg?: string;
  last_update?: string;
}

export interface GovApiData {
  source: string;
  total_records_fetched: number;
  records: GovApiRecord[];
  fetched_at: string;
}

export interface AgentLogStep {
  step: string;
  timestamp: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR';
  detail: string;
  raw_data?: unknown;
}

export interface AIAnalysisResult {
  is_valid_civic_issue: boolean;
  rejection_reason?: string;
  title: string;
  category: string;
  department: string;
  sla_hours: number;
  ai_severity_score: number;
  english_summary: string;
  regional_summary: string;
  legal_notice_draft: string;
}

export interface GrievanceRecord {
  id: string;
  created_at: string;
  title: string;
  description: string;
  regional_language: string;
  regional_summary: string;
  legal_notice_draft: string;
  category: string;
  department: string;
  sla_hours: number;
  ai_severity_score: number;
  urgency_score: number;
  priority_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  state: string;
  nearby_critical_places_count: number;
  nearby_places_list: NearbyPlace[];
  live_weather_data: LiveWeatherData;
  gov_api_data: GovApiData;
  agent_execution_logs: AgentLogStep[];
  image_url: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  upvotes: number;
}