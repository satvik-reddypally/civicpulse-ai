-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create the live grievances table
CREATE TABLE IF NOT EXISTS public.grievances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    regional_language TEXT NOT NULL DEFAULT 'Hindi',
    regional_summary TEXT NOT NULL,
    legal_notice_draft TEXT NOT NULL,
    category TEXT NOT NULL,
    department TEXT NOT NULL,
    sla_hours INTEGER NOT NULL DEFAULT 48,
    ai_severity_score INTEGER NOT NULL CHECK (ai_severity_score BETWEEN 1 AND 10),
    urgency_score INTEGER NOT NULL CHECK (urgency_score BETWEEN 0 AND 100),
    priority_level TEXT NOT NULL CHECK (priority_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    nearby_critical_places_count INTEGER NOT NULL DEFAULT 0,
    nearby_places_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    live_weather_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    gov_api_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    agent_execution_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED')),
    upvotes INTEGER NOT NULL DEFAULT 1
);

-- 2. Enable Row Level Security (RLS) with open public access for hackathon transparency
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.grievances;
CREATE POLICY "Allow public read access" ON public.grievances
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access" ON public.grievances;
CREATE POLICY "Allow public insert access" ON public.grievances
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access" ON public.grievances;
CREATE POLICY "Allow public update access" ON public.grievances
    FOR UPDATE USING (true);

-- 3. Enable Realtime on grievances table
ALTER PUBLICATION supabase_realtime ADD TABLE public.grievances;

-- 4. Create Storage Bucket for Civic Evidence Images
INSERT INTO storage.buckets (id, name, public)
VALUES ('civic-evidence', 'civic-evidence', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Civic Evidence" ON storage.objects;
CREATE POLICY "Public Read Civic Evidence" ON storage.objects
    FOR SELECT USING (bucket_id = 'civic-evidence');

DROP POLICY IF EXISTS "Public Upload Civic Evidence" ON storage.objects;
CREATE POLICY "Public Upload Civic Evidence" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'civic-evidence');