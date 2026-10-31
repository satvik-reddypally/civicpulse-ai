# CivicPulse AI — Multimodal Civic Grievance & Statutory SLA Triage System

**Track:** Civic Pulse, Digital Governance & Public Information

## 1. System Architecture Diagram

```mermaid
flowchart TD
    Citizen[Citizen Web/Mobile Client] -->|1. Live Photo + Voice/Text + GPS| API[Next.js /api/triage Route]
    API -->|2. Upload Evidence| Storage[(Supabase Storage Bucket)]
    API -->|3a. Reverse Geocode & 500m Proximity| OSM[OpenStreetMap Nominatim & Overpass API]
    API -->|3b. Live Rain & Weather Telemetry| Meteo[Open-Meteo Live Weather API]
    API -->|3c. Real-Time CPCB Station Data| OGD[Data.gov.in Official API]
    OSM & Meteo & OGD -->|Live Environmental Context| Gemini[Gemini 2.5 Flash Multimodal Agent]
    Storage -->|Image Buffer| Gemini
    Gemini -->|Defect Verification + Dept Routing + Regional SLA Explainer + Legal Notice| Scorer[Hybrid Urgency Scoring Engine]
    Scorer -->|Persist Live Record + Audit Trace| DB[(Supabase PostgreSQL + Realtime)]
    DB -->|Live WebSockets Stream| Dashboard[Public Accountability Map & Ledger]