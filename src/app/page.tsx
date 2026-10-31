'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { GrievanceRecord } from '@/types/grievance';
import GrievanceForm from '@/components/GrievanceForm';
import AgentTraceModal from '@/components/AgentTraceModal';
import {
  Activity,
  AlertOctagon,
  Clock,
  ThumbsUp,
  Terminal,
  ShieldCheck,
  MapPin,
} from 'lucide-react';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[440px] w-full rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-sm text-slate-400">
      Loading Live OpenStreetMap Telemetry...
    </div>
  ),
});

export default function HomePage() {
  const [grievances, setGrievances] = useState<GrievanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number }>({
    lat: 23.0225,
    lon: 72.5714,
  });
  const [inspectedTicket, setInspectedTicket] = useState<GrievanceRecord | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  const fetchLiveGrievances = async () => {
    setLoading(true);
    const res = await fetch('/api/triage', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setGrievances(data.grievances || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLiveGrievances();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setSelectedCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      });
    }

    // Subscribe to live Supabase Realtime changes
    const channel = supabase
      .channel('live-grievances')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grievances' },
        () => {
          fetchLiveGrievances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleUpvote = async (id: string) => {
    const res = await fetch('/api/upvote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      const { grievance } = await res.json();
      setGrievances((prev) => prev.map((item) => (item.id === id ? grievance : item)));
    }
  };

  const filteredGrievances =
    filterPriority === 'ALL'
      ? grievances
      : grievances.filter((g) => g.priority_level === filterPriority);

  const criticalCount = grievances.filter((g) => g.priority_level === 'CRITICAL').length;
  const avgUrgency =
    grievances.length > 0
      ? Math.round(grievances.reduce((acc, g) => acc + g.urgency_score, 0) / grievances.length)
      : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/30">
              CP
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                CivicPulse AI
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Digital Governance & SLA Triage
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Real-Time Multimodal Civic Grievance, Geospatial Enrichment & Public Accountability Ledger
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Connected: Gemini 2.5 Flash • OSM Overpass • Open-Meteo • Data.gov.in • Supabase Live</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Live Computed Metrics Row (Zero Hardcoded Numbers) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Live Database Reports</p>
              <p className="text-2xl font-bold text-white mt-1">{grievances.length}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-400 opacity-80" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Critical Priority Hazards</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{criticalCount}</p>
            </div>
            <AlertOctagon className="w-8 h-8 text-red-400 opacity-80" />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">Mean Composite Urgency</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{avgUrgency} / 100</p>
            </div>
            <Clock className="w-8 h-8 text-amber-400 opacity-80" />
          </div>
        </div>

        {/* Main Split Grid: Form + Interactive Live Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <GrievanceForm
              selectedCoords={selectedCoords}
              onSelectCoords={(lat, lon) => setSelectedCoords({ lat, lon })}
              onReportCreated={(newTicket) => {
                setGrievances((prev) => [newTicket, ...prev]);
                setInspectedTicket(newTicket);
              }}
            />
          </div>

          <div className="lg:col-span-7 space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Live Public Accountability Map (Click anywhere to set GPS pin)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real-time markers color-coded by AI + Geospatial Urgency Score
                  </p>
                </div>
              </div>
              <LiveMap
                grievances={grievances}
                selectedCoords={selectedCoords}
                onSelectCoords={(lat, lon) => setSelectedCoords({ lat, lon })}
                onInspectTicket={(ticket) => setInspectedTicket(ticket)}
              />
            </div>
          </div>
        </div>

        {/* Live Public Ledger Feed */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white">
              Live Triaged Civic Ledger ({filteredGrievances.length})
            </h2>
            <div className="flex items-center gap-1.5">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterPriority(lvl)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    filterPriority === lvl
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400 bg-slate-900/40 rounded-xl border border-slate-800">
              Querying live Supabase PostgreSQL database...
            </div>
          ) : filteredGrievances.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 rounded-xl border border-slate-800 space-y-2">
              <p className="text-base font-semibold text-white">
                No grievances in the live database for this filter yet.
              </p>
              <p className="text-xs text-slate-400">
                Upload a real photo on the left to execute the live Gemini + OSM + Open-Meteo + Data.gov.in triage pipeline!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGrievances.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between shadow-lg"
                >
                  <div>
                    <div className="relative h-44 w-full bg-slate-950">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      <span
                        className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          item.priority_level === 'CRITICAL'
                            ? 'bg-red-600 text-white'
                            : item.priority_level === 'HIGH'
                            ? 'bg-orange-500 text-white'
                            : 'bg-amber-500 text-slate-950'
                        }`}
                      >
                        {item.priority_level} • {item.urgency_score}/100
                      </span>
                      <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-950/80 text-slate-200 border border-slate-700">
                        SLA: {item.sla_hours}h
                      </span>
                    </div>

                    <div className="p-4 space-y-2.5">
                      <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
                        {item.department}
                      </div>
                      <h3 className="text-base font-bold text-white leading-snug">{item.title}</h3>
                      <p className="text-xs text-slate-300 line-clamp-2">{item.regional_summary}</p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                        <span className="truncate">{item.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between">
                    <button
                      onClick={() => handleUpvote(item.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-blue-400" />
                      Upvote ({item.upvotes})
                    </button>

                    <button
                      onClick={() => setInspectedTicket(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      Inspect Live Trace & Notice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <AgentTraceModal grievance={inspectedTicket} onClose={() => setInspectedTicket(null)} />
    </div>
  );
}