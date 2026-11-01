'use client';

import React from 'react';
import { X, CheckCircle2, FileText, Cpu, CloudRain, ShieldAlert } from 'lucide-react';
import { GrievanceRecord } from '@/types/grievance';

interface AgentTraceModalProps {
  darkMode?: boolean;
  record: GrievanceRecord | null;
  onClose: () => void;
}

export default function AgentTraceModal({
  darkMode = false,
  record,
  onClose,
}: AgentTraceModalProps) {
  if (!record) return null;

  const copyNotice = () => {
    navigator.clipboard.writeText(record.formal_legal_notice);
    alert('Official Notice copied to clipboard!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        className={`border rounded-2xl max-w-4xl w-full p-6 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto ${
          darkMode
            ? 'bg-slate-800 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Report Details & Official Escalation Notice
            </span>
            <h3 className="text-xl font-bold mt-1">{record.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              {record.address_display}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl cursor-pointer ${
              darkMode
                ? 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={`border p-4 rounded-xl ${
              darkMode
                ? 'bg-slate-900/60 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400 mb-1">
              <ShieldAlert className="w-4 h-4" /> Nearby Infrastructure (500m)
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {record.live_weather_context?.nearby_critical_infrastructure?.join(', ') ||
                'Standard Municipal Zone'}
            </p>
          </div>

          <div
            className={`border p-4 rounded-xl ${
              darkMode
                ? 'bg-slate-900/60 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400 mb-1">
              <CloudRain className="w-4 h-4" /> Local Weather
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Temp: {record.live_weather_context?.weather?.temperature_c ?? 'N/A'}°C | Precip:{' '}
              {record.live_weather_context?.weather?.precipitation_mm ?? 0} mm
            </p>
          </div>

          <div
            className={`border p-4 rounded-xl ${
              darkMode
                ? 'bg-slate-900/60 border-slate-700'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-teal-600 dark:text-teal-400 mb-1">
              <Cpu className="w-4 h-4" /> Air Quality Index
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              PM2.5: {record.live_weather_context?.air_quality?.pm25 ?? 'Live'} |{' '}
              {record.live_weather_context?.air_quality?.aqi_status ?? 'Monitored'}
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3">
            Verification & Triage Log
          </h4>
          <div className="space-y-2.5">
            {record.agent_execution_trace?.map((t) => (
              <div
                key={t.step}
                className={`flex items-start justify-between border p-3.5 rounded-xl text-sm ${
                  darkMode
                    ? 'bg-slate-900/60 border-slate-700'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-1" />
                  <div>
                    <span className="font-bold">
                      Step {t.step}: {t.name}
                    </span>{' '}
                    <span className="text-teal-600 dark:text-teal-400 font-mono text-xs">
                      ({t.source})
                    </span>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                      {t.detail}
                    </p>
                  </div>
                </div>
                <span className="text-slate-500 dark:text-slate-400 font-mono text-xs shrink-0">
                  {new Date(t.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-teal-600" />
              Official Municipal Notice ({record.statutory_sla_hours}h SLA)
            </h4>
            <button
              onClick={copyNotice}
              className="text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white font-bold px-4 py-1.5 rounded-lg cursor-pointer"
            >
              Copy Notice
            </button>
          </div>
          <pre className="bg-slate-900 text-slate-100 border border-slate-700 p-4 rounded-xl text-xs sm:text-sm whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
            {record.formal_legal_notice}
          </pre>
        </div>
      </div>
    </div>
  );
}