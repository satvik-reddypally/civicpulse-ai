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
import { AgentLogStep } from '@/types/grievance';

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
  const logs: AgentLogStep[] = [];

  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const description = String(formData.get('description') || '');
    const regionalLanguage = String(formData.get('regionalLanguage') || 'Hindi');
    const latitude = parseFloat(String(formData.get('latitude') || ''));
    const longitude = parseFloat(String(formData.get('longitude') || ''));

    if (!imageFile || isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Live image file and valid GPS coordinates (latitude, longitude) are required.' },
        { status: 400 }
      );
    }

    // Step 1: Convert Image & Upload to Supabase Storage
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');
    const fileExt = imageFile.name.split('.').pop() || 'jpg';
    const fileName = `report_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('civic-evidence')
      .upload(fileName, buffer, {
        contentType: imageFile.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage.from('civic-evidence').getPublicUrl(fileName);
    const imageUrl = publicUrlData.publicUrl;

    logs.push({
      step: '1. Supabase Live Storage Upload',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      detail: `Uploaded raw photographic evidence (${Math.round(buffer.length / 1024)} KB) to bucket civic-evidence.`,
      raw_data: { imageUrl },
    });

    // Step 2: Parallel Live External API Enrichment
    const [geoResult, nearbyPlaces, weatherData] = await Promise.all([
      fetchLiveReverseGeocode(latitude, longitude),
      fetchNearbyCriticalInfrastructure(latitude, longitude),
      fetchLiveWeather(latitude, longitude),
    ]);

    logs.push({
      step: '2. OpenStreetMap Nominatim & Overpass Live API',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      detail: `Located "${geoResult.address}". Detected ${nearbyPlaces.length} critical facilities (schools/hospitals) within 500m.`,
      raw_data: { address: geoResult.address, city: geoResult.city, state: geoResult.state, nearbyPlaces },
    });

    logs.push({
      step: '3. Open-Meteo Live Weather Telemetry API',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      detail: `Temp: ${weatherData.temperature_c}°C, Precipitation: ${weatherData.precipitation_mm}mm, Wind: ${weatherData.wind_speed_kmh}km/h.`,
      raw_data: weatherData,
    });

    // Step 3: Live Data.gov.in API Call
    const govData = await fetchLiveGovData(geoResult.state, geoResult.city);
    logs.push({
      step: '4. Data.gov.in Official CPCB API',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      detail: `Fetched ${govData.total_records_fetched} live environmental station records from Data.gov.in.`,
      raw_data: govData,
    });

    // Step 4: Multimodal Gemini 2.5 Flash Triage & SLA Reasoning
    const aiResult = await analyzeCivicIssueWithGemini({
      imageBase64: base64Image,
      mimeType: imageFile.type || 'image/jpeg',
      citizenNote: description,
      regionalLanguage,
      address: geoResult.address,
      city: geoResult.city,
      state: geoResult.state,
      nearbyPlaces,
      weather: weatherData,
      govData,
    });

    if (!aiResult.is_valid_civic_issue) {
      return NextResponse.json(
        {
          error: `AI Verification Rejected Image: ${
            aiResult.rejection_reason || 'The uploaded image does not appear to show a valid public civic issue.'
          }`,
        },
        { status: 422 }
      );
    }

    logs.push({
      step: '5. Gemini 2.5 Flash Multimodal Vision & SLA RAG',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      detail: `Classified as "${aiResult.category}" -> Routed to ${aiResult.department} (Statutory SLA: ${aiResult.sla_hours}h, Visual Severity: ${aiResult.ai_severity_score}/10).`,
      raw_data: aiResult,
    });

    // Step 5: Compute Hybrid Urgency Score
    const { urgency_score, priority_level } = computeHybridUrgencyScore(
      aiResult.ai_severity_score,
      nearbyPlaces.length,
      weatherData
    );

    logs.push({
      step: '6. Hybrid Urgency Scoring Engine',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      detail: `Computed Composite Urgency Score: ${urgency_score}/100 (${priority_level}).`,
      raw_data: { urgency_score, priority_level },
    });

    // Step 6: Insert Live Record into Supabase PostgreSQL
    const { data: insertedRow, error: dbError } = await supabase
      .from('grievances')
      .insert([
        {
          title: aiResult.title,
          description: description || aiResult.english_summary,
          regional_language: regionalLanguage,
          regional_summary: aiResult.regional_summary,
          legal_notice_draft: aiResult.legal_notice_draft,
          category: aiResult.category,
          department: aiResult.department,
          sla_hours: aiResult.sla_hours,
          ai_severity_score: aiResult.ai_severity_score,
          urgency_score,
          priority_level,
          latitude,
          longitude,
          address: geoResult.address,
          city: geoResult.city,
          state: geoResult.state,
          nearby_critical_places_count: nearbyPlaces.length,
          nearby_places_list: nearbyPlaces,
          live_weather_data: weatherData,
          gov_api_data: govData,
          agent_execution_logs: logs,
          image_url: imageUrl,
          status: 'OPEN',
          upvotes: 1,
        },
      ])
      .select()
      .single();

    if (dbError) {
      throw new Error(`Supabase DB insert failed: ${dbError.message}`);
    }

    return NextResponse.json({ grievance: insertedRow }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json({ error: message, logs }, { status: 500 });
  }
}