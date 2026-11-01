-- Run once in Supabase -> SQL Editor. Safe to re-run. Aligns the table with what the UI reads.

create table if not exists public.grievances (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table public.grievances add column if not exists title text;
alter table public.grievances add column if not exists category text;
alter table public.grievances add column if not exists responsible_department text;
alter table public.grievances add column if not exists priority_level text;
alter table public.grievances add column if not exists urgency_score integer default 0;
alter table public.grievances add column if not exists statutory_sla_hours integer default 48;
alter table public.grievances add column if not exists ai_summary text;
alter table public.grievances add column if not exists citizen_note text;
alter table public.grievances add column if not exists citizen_language text;
alter table public.grievances add column if not exists regional_citizen_explainer text;
alter table public.grievances add column if not exists formal_legal_notice text;
alter table public.grievances add column if not exists image_url text;
alter table public.grievances add column if not exists latitude double precision;
alter table public.grievances add column if not exists longitude double precision;
alter table public.grievances add column if not exists address_display text;
alter table public.grievances add column if not exists upvotes integer default 1;
alter table public.grievances add column if not exists status text default 'OPEN';
alter table public.grievances add column if not exists live_weather_context jsonb default '{}'::jsonb;
alter table public.grievances add column if not exists agent_execution_trace jsonb default '[]'::jsonb;

-- Old columns from an earlier schema must not block inserts
do $$
declare r record;
begin
  for r in
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'grievances'
      and is_nullable = 'NO' and column_default is null
      and column_name not in ('id')
  loop
    execute format('alter table public.grievances alter column %I drop not null', r.column_name);
  end loop;
end $$;

-- Drop old CHECK constraints that could reject values
do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid = 'public.grievances'::regclass and contype = 'c'
  loop
    execute format('alter table public.grievances drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.grievances enable row level security;
drop policy if exists "Allow public read access" on public.grievances;
create policy "Allow public read access" on public.grievances for select using (true);
drop policy if exists "Allow public insert access" on public.grievances;
create policy "Allow public insert access" on public.grievances for insert with check (true);
drop policy if exists "Allow public update access" on public.grievances;
create policy "Allow public update access" on public.grievances for update using (true);

-- Realtime (ignore if already added)
do $$ begin
  alter publication supabase_realtime add table public.grievances;
exception when others then null;
end $$;

-- Storage bucket for photos
insert into storage.buckets (id, name, public) values ('civic-evidence', 'civic-evidence', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Read Civic Evidence" on storage.objects;
create policy "Public Read Civic Evidence" on storage.objects for select using (bucket_id = 'civic-evidence');
drop policy if exists "Public Upload Civic Evidence" on storage.objects;
create policy "Public Upload Civic Evidence" on storage.objects for insert with check (bucket_id = 'civic-evidence');