import { GoogleGenAI, Type } from '@google/genai';
import { AIAnalysisResult, GovApiData, LiveWeatherData, NearbyPlace } from '@/types/grievance';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeCivicIssueWithGemini(params: {
  imageBase64: string;
  mimeType: string;
  citizenNote: string;
  regionalLanguage: string;
  address: string;
  city: string;
  state: string;
  nearbyPlaces: NearbyPlace[];
  weather: LiveWeatherData;
  govData: GovApiData;
}): Promise<AIAnalysisResult> {
  const prompt = `
You are an official Indian Municipal Civic Triage & Legal SLA Compliance Agent.
Analyze the attached citizen-submitted photograph along with their note and real-time geospatial/environmental telemetry.

CITIZEN NOTE: "${params.citizenNote || 'No additional text provided. Rely on visual inspection.'}"
REQUESTED REGIONAL LANGUAGE FOR CITIZEN EXPLAINER: "${params.regionalLanguage}"
VERIFIED GPS LOCATION: "${params.address}" (${params.city}, ${params.state})
CRITICAL INFRASTRUCTURE WITHIN 500M (${params.nearbyPlaces.length} found): ${JSON.stringify(
    params.nearbyPlaces.map((p) => `${p.name} (${p.type})`)
  )}
LIVE WEATHER AT LOCATION: Temperature ${params.weather.temperature_c}°C, Precipitation ${
    params.weather.precipitation_mm
  }mm, Wind ${params.weather.wind_speed_kmh}km/h
LIVE DATA.GOV.IN CPCB POLLUTION RECORDS: ${JSON.stringify(params.govData.records)}

STATUTORY MUNICIPAL SLA CHARTER REFERENCE:
1. Open Manhole / Live Exposed Electrical Wire / Fallen Tree Blocking Road -> Department: "Emergency Municipal Engineering & Electrical Cell", SLA: 12 to 24 hours.
2. Major Water Pipeline Burst / Sewage Overflow / Severe Road Pothole (>1ft) -> Department: "Public Works Department (PWD) & Water Supply Board", SLA: 48 hours.
3. Uncollected Solid Waste / Illegal Garbage Dumping / Biomedical or Construction Debris -> Department: "Municipal Solid Waste Management (SWM) & Sanitation", SLA: 24 to 48 hours.
4. Broken Streetlight / Damaged Footpath / Illegal Encroachment -> Department: "Municipal Ward Maintenance & Roads Division", SLA: 72 hours.
5. Industrial Smoke / Open Waste Burning / Severe Air or Water Pollution -> Department: "State Pollution Control Board (SPCB) & Environment Cell", SLA: 24 hours.

INSTRUCTIONS:
1. Determine if the image shows a genuine outdoor/public civic, infrastructure, sanitation, water, road, electrical, or environmental issue (set is_valid_civic_issue = true). Only reject if it is clearly a selfie, indoor personal room, or meme.
2. Assign ai_severity_score from 1 (minor cosmetic defect) to 10 (immediate life-safety hazard).
3. Write "regional_summary" entirely in ${
    params.regionalLanguage
  } script explaining to the citizen: (a) what defect was verified, (b) which municipal department is legally responsible, and (c) the exact statutory SLA hours within which the corporation must resolve it under the Municipal Citizen Charter.
4. Write "legal_notice_draft" as a formal complaint addressed to the Municipal Commissioner of ${
    params.city
  } citing the exact GPS address, nearby sensitive facilities, weather compounding factors, and demanding resolution within the SLA window.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: params.imageBase64,
              mimeType: params.mimeType,
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          is_valid_civic_issue: { type: Type.BOOLEAN },
          rejection_reason: { type: Type.STRING },
          title: { type: Type.STRING },
          category: { type: Type.STRING },
          department: { type: Type.STRING },
          sla_hours: { type: Type.INTEGER },
          ai_severity_score: { type: Type.INTEGER },
          english_summary: { type: Type.STRING },
          regional_summary: { type: Type.STRING },
          legal_notice_draft: { type: Type.STRING },
        },
        required: [
          'is_valid_civic_issue',
          'title',
          'category',
          'department',
          'sla_hours',
          'ai_severity_score',
          'english_summary',
          'regional_summary',
          'legal_notice_draft',
        ],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini 2.5 Flash');
  }

  return JSON.parse(text) as AIAnalysisResult;
}