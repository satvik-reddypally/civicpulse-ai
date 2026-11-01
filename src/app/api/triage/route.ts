import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  computeHybridUrgencyScore,
  fetchLiveGovData,
  fetchLiveReverseGeocode,
  fetchLiveWeather,
  fetchNearbyCriticalInfrastructure,
} from '@/lib/live-enrichment';
import { analyzeCivicIssueWithGemini } from '@/lib/ai-agent';
import { AgentTraceStep } from '@/types/grievance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET() {
  const { data, error } = await supabase
    .from('grievances')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ grievances: data || [] });
}

export async function POST(req: NextRequest) {
  const trace: AgentTraceStep[] = [];
  const addStep = (name: string, source: string, detail: string) =>
    trace.push({ step: trace.length + 1, name, source, detail, timestamp: new Date().toISOString() });

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;

    // The UI sends citizen_note / citizen_language; older callers sent description / regionalLanguage.
    const citizenNote = String(formData.get('citizen_note') ?? formData.get('description') ?? '').trim();
    const language = String(formData.get('citizen_language') ?? formData.get('regionalLanguage') ?? 'English');
    const latitude = parseFloat(String(formData.get('latitude') ?? ''));
    const longitude = parseFloat(String(formData.get('longitude') ?? ''));

    if (!imageFile || typeof imageFile === 'string' || isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'An image file and valid GPS coordinates (latitude, longitude) are required.' },
        { status: 400 }
      );
    }

    // Step 1: Upload evidence to Supabase Storage
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64Image = buffer.toString('base64');
    const mimeType = imageFile.type || 'image/jpeg';
    const fileExt = (imageFile.name?.split('.').pop() || 'jpg').toLowerCase();
    const fileName = `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('civic-evidence')
      .upload(fileName, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) {
      throw new Error(
        `Image upload failed: ${uploadError.message}. Check that the "civic-evidence" storage bucket exists and allows public uploads.`
      );
    }

    const imageUrl = supabase.storage.from('civic-evidence').getPublicUrl(fileName).data.publicUrl;
    addStep(
      'Evidence Upload',
      'Supabase Storage',
      `Uploaded photographic evidence (${Math.round(buffer.length / 1024)} KB) to bucket civic-evidence.`
    );

    // Step 2: Live enrichment. Each helper handles its own failures, so none of them can crash the request.
    const [geo, nearbyPlaces, weather] = await Promise.all([
      fetchLiveReverseGeocode(latitude, longitude),
      fetchNearbyCriticalInfrastructure(latitude, longitude),
      fetchLiveWeather(latitude, longitude),
    ]);
    const govData = await fetchLiveGovData(geo.state, geo.city);

    addStep(
      'Reverse Geocode & 500m Proximity Scan',
      'OpenStreetMap (Nominatim / Overpass)',
      `Located "${geo.address}". Detected ${nearbyPlaces.length} critical facilities (schools/hospitals/clinics) within 500m.`
    );
    addStep(
      'Live Weather Telemetry',
      'Open-Meteo',
      `Temp: ${weather.temperature_c}°C, Precipitation: ${weather.precipitation_mm}mm, Wind: ${weather.wind_speed_kmh}km/h (${weather.weather_condition}).`
    );
    addStep(
      'Official Environmental Registry',
      'Data.gov.in CPCB',
      `Fetched ${govData.total_records_fetched} station records. PM2.5: ${govData.pm25}, status: ${govData.aqi_status}.`
    );

    // Step 3: Gemini multimodal triage
    const ai = await analyzeCivicIssueWithGemini({
      imageBase64: base64Image,
      mimeType,
      citizenNote,
      regionalLanguage: language,
      address: geo.address,
      city: geo.city,
      state: geo.state,
      nearbyPlaces,
      weather,
      govData,
    });

    if (!ai.is_valid_civic_issue) {
      return NextResponse.json(
        {
          error: `AI Verification Rejected Image: ${
            ai.rejection_reason || 'The uploaded image does not appear to show a valid public civic issue.'
          }`,
        },
        { status: 422 }
      );
    }

    addStep(
      'Multimodal Vision Triage & SLA Routing',
      'Google Gemini',
      `Classified as "${ai.category}" -> routed to ${ai.department} (Statutory SLA: ${ai.sla_hours}h, Visual Severity: ${ai.ai_severity_score}/10).`
    );

    // Step 4: Hybrid urgency score
    const { urgency_score, priority_level } = computeHybridUrgencyScore(
      ai.ai_severity_score,
      nearbyPlaces.length,
      weather
    );
    addStep(
      'Hybrid Urgency Scoring',
      'CivicPulse Scoring Engine',
      `Composite Urgency Score: ${urgency_score}/100 (${priority_level}).`
    );

    // Step 5: Persist. Column names match what the UI reads (page.tsx / AgentTraceModal.tsx).
    const row = {
      title: ai.title,
      category: ai.category,
      responsible_department: ai.department,
      priority_level,
      urgency_score,
      statutory_sla_hours: ai.sla_hours,
      ai_summary: ai.english_summary,
      citizen_note: citizenNote,
      citizen_language: language,
      regional_citizen_explainer: ai.regional_summary,
      formal_legal_notice: ai.legal_notice_draft,
      image_url: imageUrl,
      latitude,
      longitude,
      address_display: geo.address,
      upvotes: 1,
      status: 'OPEN',
      live_weather_context: {
        address_display: geo.address,
        nearby_critical_infrastructure: nearbyPlaces.map((p) => `${p.name} (${p.type})`),
        weather,
        air_quality: govData,
      },
      agent_execution_trace: trace,
    };

    const { data: inserted, error: dbError } = await supabase.from('grievances').insert([row]).select().single();
    if (dbError) {
      throw new Error(`Database insert failed: ${dbError.message}`);
    }

    // `data` is what GrievanceForm reads; `grievance` kept for backward compatibility.
    return NextResponse.json({ data: inserted, grievance: inserted }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    console.error('[api/triage] failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}