'use client';

import React, { useState } from 'react';
import { Camera, MapPin, Mic, MicOff, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { GrievanceRecord } from '@/types/grievance';

interface GrievanceFormProps {
  selectedCoords: { lat: number; lon: number };
  onSelectCoords: (lat: number, lon: number) => void;
  onReportCreated: (newRecord: GrievanceRecord) => void;
}

const LANGUAGES = ['Hindi', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Kannada', 'English'];

export default function GrievanceForm({
  selectedCoords,
  onSelectCoords,
  onReportCreated,
}: GrievanceFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [regionalLanguage, setRegionalLanguage] = useState('Hindi');
  const [isRecording, setIsRecording] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMessage(null);
    }
  };

  const detectLiveGPS = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSelectCoords(pos.coords.latitude, pos.coords.longitude);
        setIsLocating(false);
      },
      (err) => {
        setErrorMessage(`GPS Error: ${err.message}. You can also click directly on the map to set location.`);
        setIsLocating(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition =
      (window as unknown as Record<string, any>).SpeechRecognition ||
      (window as unknown as Record<string, any>).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Browser Speech Recognition not supported. Please type your note.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = regionalLanguage === 'Hindi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      setErrorMessage('Please upload or capture a real photo of the civic issue.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(
      'Uploading to Supabase Storage -> Querying OpenStreetMap, Open-Meteo & Data.gov.in -> Running Gemini 2.5 Flash SLA Triage...'
    );

    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('description', description);
      formData.append('regionalLanguage', regionalLanguage);
      formData.append('latitude', String(selectedCoords.lat));
      formData.append('longitude', String(selectedCoords.lon));

      const res = await fetch('/api/triage', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to triage civic report.');
      }

      onReportCreated(data.grievance);
      setImageFile(null);
      setPreviewUrl(null);
      setDescription('');
      setStatusMessage('Live Triage Complete! Ticket logged to public accountability ledger.');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed');
      setStatusMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-lg font-bold text-white">Report Live Civic Hazard</h2>
          <p className="text-xs text-slate-400">
            Multimodal Vision + Live Geospatial/Weather + Statutory SLA Routing
          </p>
        </div>
        <span className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
          Live API Pipeline
        </span>
      </div>

      {/* Image Upload */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          1. Photographic Evidence (Required)
        </label>
        <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-lg cursor-pointer bg-slate-950/60 transition overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-400">
              <Camera className="w-8 h-8 mb-2 text-blue-400" />
              <p className="text-xs font-medium">Click to capture camera photo or upload image</p>
              <p className="text-[11px] text-slate-500 mt-1">Potholes, garbage dumps, water leaks, open manholes</p>
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
        </label>
      </div>

      {/* Live GPS Coordinates */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            2. Exact GPS Location
          </label>
          <button
            type="button"
            onClick={detectLiveGPS}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300"
          >
            <MapPin className="w-3.5 h-3.5" />
            {isLocating ? 'Detecting GPS...' : 'Auto-Detect My Live GPS'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300">
            Lat: <span className="font-mono text-white">{selectedCoords.lat.toFixed(5)}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-300">
            Lon: <span className="font-mono text-white">{selectedCoords.lon.toFixed(5)}</span>
          </div>
        </div>
      </div>

      {/* Regional Language Selector */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          3. Regional Language for Citizen Rights & SLA Explainer
        </label>
        <select
          value={regionalLanguage}
          onChange={(e) => setRegionalLanguage(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </div>

      {/* Voice / Text Description */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            4. Citizen Voice / Text Note (Optional)
          </label>
          <button
            type="button"
            onClick={toggleVoiceInput}
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${
              isRecording ? 'bg-red-500/20 text-red-400 animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {isRecording ? 'Listening...' : 'Speak Note'}
          </button>
        </div>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the hazard in English or your regional language..."
          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusMessage && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-start gap-2">
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-blue-400 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-semibold py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2 text-sm"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Running Autonomous Triage Pipeline...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit & Run Live AI Triage
          </>
        )}
      </button>
    </form>
  );
}