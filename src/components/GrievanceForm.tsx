'use client';

import React, { useState } from 'react';
import {
  Camera,
  MapPin,
  Mic,
  Send,
  Loader2,
  AlertCircle,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { GrievanceRecord } from '@/types/grievance';

interface GrievanceFormProps {
  userEmail: string | null;
  onRequireAuth: () => void;
  selectedLat: number;
  selectedLon: number;
  onSelectLocation: (lat: number, lon: number) => void;
  onSuccess: (record: GrievanceRecord) => void;
}
// Vercel rejects request bodies over ~4.5MB, and phone photos are often larger. Shrink before upload.
async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
const INDIAN_LANGUAGES = [
  'Telugu',
  'Hindi',
  'Gujarati',
  'Tamil',
  'Marathi',
  'Kannada',
  'Bengali',
  'Malayalam',
  'English',
];

const QUICK_TAGS = [
  'Open Manhole near School',
  'Waterlogging & Road Cave-in',
  'Overflowing Garbage',
  'Broken Streetlight',
];

export default function GrievanceForm({
  userEmail,
  onRequireAuth,
  selectedLat,
  selectedLon,
  onSelectLocation,
  onSuccess,
}: GrievanceFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [citizenNote, setCitizenNote] = useState('');
  const [language, setLanguage] = useState('Telugu');
  const [isListening, setIsListening] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setErrorMsg(null);
    }
  };

  const detectLiveGPS = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Geolocation is not supported on this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onSelectLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setErrorMsg(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true }
    );
  };

  const startVoiceInput = () => {
    const SpeechRecognition =
      (
        window as unknown as {
          SpeechRecognition?: unknown;
          webkitSpeechRecognition?: unknown;
        }
      ).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg('Voice input is not supported in this browser.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition = new (SpeechRecognition as any)();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setCitizenNote((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.start();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userEmail) {
      onRequireAuth();
      return;
    }

    if (!imageFile) {
      setErrorMsg('Please upload a photo of the civic issue.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('image', await compressImage(imageFile));
      formData.append('latitude', String(selectedLat));
      formData.append('longitude', String(selectedLon));
      formData.append(
        'citizen_note',
        `[Reported by: ${userEmail}] ${citizenNote}`.trim()
      );
      formData.append('citizen_language', language);

      const response = await fetch('/api/triage', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      setImageFile(null);
      setImagePreview(null);
      setCitizenNote('');
      onSuccess(result.data as GrievanceRecord);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full h-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 space-y-5 flex flex-col justify-between shadow-xs"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Report an Issue
            </h2>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Submit photo evidence and location for automated routing
            </p>
          </div>
          {userEmail && (
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 border border-teal-300 dark:border-teal-500/30 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Signed In
            </span>
          )}
        </div>

        {!userEmail && (
          <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-extrabold text-slate-900 dark:text-white">
                Sign in required
              </p>
              <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">
                Please sign in with your email to submit and track reports.
              </p>
            </div>
            <button
              type="button"
              onClick={onRequireAuth}
              className="shrink-0 text-sm font-bold px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white cursor-pointer"
            >
              Sign In
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1.5">
            1. Issue Photo *
          </label>
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-600 dark:hover:border-teal-500 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/60 transition overflow-hidden">
            {imagePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreview}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center mb-2">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Click to upload or capture photo
                </span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                  Potholes, garbage dumps, water leaks, streetlights
                </span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              2. Location Coordinates
            </label>
            <button
              type="button"
              onClick={detectLiveGPS}
              className="text-xs sm:text-sm text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1 font-extrabold cursor-pointer"
            >
              <MapPin className="w-4 h-4" /> Use Current Location
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono font-bold">
            <div>Lat: {selectedLat.toFixed(5)}</div>
            <div>Lon: {selectedLon.toFixed(5)}</div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-extrabold text-slate-900 dark:text-slate-100 mb-1.5">
            3. Preferred Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
          >
            {INDIAN_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
              4. Additional Details (Optional)
            </label>
            <button
              type="button"
              onClick={startVoiceInput}
              className={`text-xs font-bold flex items-center gap-1 px-3 py-1 rounded-lg cursor-pointer ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5" /> {isListening ? 'Listening...' : 'Voice Input'}
            </button>
          </div>
          <textarea
            rows={2}
            value={citizenNote}
            onChange={(e) => setCitizenNote(e.target.value)}
            placeholder="Describe the issue or landmark..."
            className="w-full border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setCitizenNote(tag)}
                className="text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-teal-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {userEmail ? (
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing & Submitting Report...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Report
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={onRequireAuth}
          className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-sm font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          Sign In to Submit Report
        </button>
      )}
    </form>
  );
}