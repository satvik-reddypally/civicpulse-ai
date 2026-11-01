'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { GrievanceRecord } from '@/types/grievance';
import GrievanceForm from '@/components/GrievanceForm';
import AgentTraceModal from '@/components/AgentTraceModal';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  ShieldAlert,
  Activity,
  Clock,
  ThumbsUp,
  Eye,
  MapPin,
  Volume2,
  Building2,
  Sparkles,
  Scale,
  Sun,
  Moon,
  Search,
  Download,
  BarChart3,
  Compass,
  TrendingUp,
  CheckCircle2,
  SlidersHorizontal,
  UserCheck,
  LogOut,
  ChevronDown,
  BookmarkCheck,
  X,
  Loader2,
  ArrowRight,
  User,
} from 'lucide-react';

const LiveMap = dynamic(() => import('@/components/LiveMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[540px] w-full bg-slate-200 dark:bg-slate-800 animate-pulse rounded-2xl flex items-center justify-center text-slate-800 dark:text-slate-200 text-base font-bold">
      Loading Map...
    </div>
  ),
});

const CITY_PRESETS = [
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
  { name: 'Bengaluru', lat: 12.9716, lon: 77.5946 },
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'New Delhi', lat: 28.6139, lon: 77.209 },
];

export default function CivicPulseDashboard() {
  const [grievances, setGrievances] = useState<GrievanceRecord[]>([]);
  const [selectedLat, setSelectedLat] = useState<number>(23.0225);
  const [selectedLon, setSelectedLon] = useState<number>(72.5714);
  const [activeTraceRecord, setActiveTraceRecord] = useState<GrievanceRecord | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [upvotingId, setUpvotingId] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'WORKSPACE' | 'MY_REPORTS' | 'ANALYTICS'>('WORKSPACE');
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const [authUser, setAuthUser] = useState<SupabaseUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authStep, setAuthStep] = useState<'EMAIL' | 'OTP'>('EMAIL');
  const [emailInput, setEmailInput] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      if (session?.user) {
        setAuthModalOpen(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchGrievances = useCallback(async () => {
    const { data, error } = await supabase
      .from('grievances')
      .select('*')
      .order('urgency_score', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) {
      setGrievances(data as GrievanceRecord[]);
    }
  }, []);

  useEffect(() => {
    fetchGrievances();

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setSelectedLat(pos.coords.latitude);
          setSelectedLon(pos.coords.longitude);
        },
        () => {}
      );
    }

    const channel = supabase
      .channel('realtime-grievances')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'grievances' },
        () => {
          fetchGrievances();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchGrievances]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: emailInput.trim(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setAuthStep('OTP');
      setAuthMessage(`We sent a verification code to ${emailInput.trim()}.`);
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to send verification code.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = otpInput.replace(/\s+/g, '');
    if (!cleanToken) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      let { data, error } = await supabase.auth.verifyOtp({
        email: emailInput.trim(),
        token: cleanToken,
        type: 'email',
      });

      if (error) {
        const signupAttempt = await supabase.auth.verifyOtp({
          email: emailInput.trim(),
          token: cleanToken,
          type: 'signup',
        });
        data = signupAttempt.data;
        error = signupAttempt.error;
      }

      if (error) throw error;

      if (data.user) {
        setAuthUser(data.user);
        setAuthModalOpen(false);
        setAuthStep('EMAIL');
        setOtpInput('');
      }
    } catch (err: unknown) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Invalid or expired code. Please check your email and try again.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
  };

  const handleUpvote = async (id: string) => {
    setUpvotingId(id);
    try {
      const res = await fetch('/api/upvote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchGrievances();
      }
    } finally {
      setUpvotingId(null);
    }
  };

  const speakRegionalNotice = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const exportLedgerCSV = () => {
    if (grievances.length === 0) return;
    const headers = [
      'ID',
      'Title',
      'Category',
      'Department',
      'Priority',
      'UrgencyScore',
      'SLA_Hours',
      'Latitude',
      'Longitude',
      'Upvotes',
      'CreatedAt',
    ];
    const rows = grievances.map((g) => [
      g.id,
      `"${(g.title || '').replace(/"/g, '""')}"`,
      `"${g.category || ''}"`,
      `"${g.responsible_department || ''}"`,
      g.priority_level,
      g.urgency_score,
      g.statutory_sla_hours,
      g.latitude,
      g.longitude,
      g.upvotes,
      g.created_at,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `civicpulse_reports_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMenuOpen(false);
  };

  const myReportsList = useMemo(() => {
    if (!authUser?.email) return [];
    return grievances.filter((g) =>
      g.citizen_note?.toLowerCase().includes(authUser.email!.toLowerCase())
    );
  }, [grievances, authUser]);

  const filteredGrievances = useMemo(() => {
    const sourceList = activeTab === 'MY_REPORTS' ? myReportsList : grievances;
    return sourceList.filter((g) => {
      const matchesPriority =
        filterPriority === 'ALL' || g.priority_level === filterPriority;
      const matchesSearch =
        !searchQuery.trim() ||
        g.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.responsible_department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.address_display?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesPriority && matchesSearch;
    });
  }, [grievances, myReportsList, activeTab, filterPriority, searchQuery]);

  const criticalCount = grievances.filter((g) => g.priority_level === 'CRITICAL').length;
  const highCount = grievances.filter((g) => g.priority_level === 'HIGH').length;
  const avgUrgency =
    grievances.length > 0
      ? Math.round(
          grievances.reduce((acc, item) => acc + item.urgency_score, 0) /
            grievances.length
        )
      : 0;

  const departmentStats = useMemo(() => {
    const counts: Record<string, number> = {};
    grievances.forEach((g) => {
      const dept = g.responsible_department || 'Municipal Engineering Wing';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [grievances]);

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 flex flex-col justify-between">
        <div>
          {/* CURVED FLOATING HEADER WITH HIGH-CONTRAST TEXT */}
          <div className="sticky top-3 z-40 px-5 sm:px-8 pt-2">
            <header className="w-full rounded-2xl border border-slate-300 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-6 py-4 shadow-sm transition-all">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* LEFT: Prominent Brand Logo & Title */}
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-sm">
                    <Scale className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">
                      CivicPulse <span className="text-teal-600 dark:text-teal-400">AI</span>
                    </h1>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                      Public Grievance & SLA Portal
                    </p>
                  </div>
                </div>

                {/* CENTER: Navigation Tabs */}
                <nav className="flex items-center p-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                  <button
                    onClick={() => setActiveTab('WORKSPACE')}
                    className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg transition cursor-pointer ${
                      activeTab === 'WORKSPACE'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Compass className="w-4 h-4" />
                    <span>Dashboard</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('MY_REPORTS')}
                    className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg transition cursor-pointer ${
                      activeTab === 'MY_REPORTS'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                    }`}
                  >
                    <BookmarkCheck className="w-4 h-4" />
                    <span>My Reports</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-extrabold ${
                        activeTab === 'MY_REPORTS'
                          ? 'bg-white text-teal-700'
                          : 'bg-slate-800 text-white dark:bg-slate-700 dark:text-slate-100'
                      }`}
                    >
                      {myReportsList.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setActiveTab('ANALYTICS')}
                    className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-lg transition cursor-pointer ${
                      activeTab === 'ANALYTICS'
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                    }`}
                  >
                    <BarChart3 className="w-4 h-4" />
                    <span>Analytics</span>
                  </button>
                </nav>

                {/* RIGHT: Options Menu + Sign In Button + Theme Toggle */}
                <div className="flex items-center gap-3">
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen((prev) => !prev)}
                      className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition cursor-pointer"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                      <span className="hidden sm:inline">Options</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-4 shadow-xl z-50 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
                          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Service Status
                          </span>
                          <span className="text-xs font-extrabold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" /> All Online
                          </span>
                        </div>

                        <div className="space-y-2 text-sm">
                          {[
                            'Gemini 2.5 Vision',
                            'OpenStreetMap Overpass',
                            'Open-Meteo Weather',
                            'Data.gov.in Air Quality',
                            'Supabase Database',
                          ].map((name) => (
                            <div key={name} className="flex items-center justify-between">
                              <span className="text-slate-800 dark:text-slate-200 font-semibold">
                                {name}
                              </span>
                              <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                                Connected
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="border-t border-slate-200 dark:border-slate-700 pt-2.5">
                          <button
                            onClick={exportLedgerCSV}
                            disabled={grievances.length === 0}
                            className="w-full flex items-center justify-between text-sm font-bold px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
                          >
                            <span className="flex items-center gap-2">
                              <Download className="w-4 h-4 text-teal-600" />
                              Export CSV Report
                            </span>
                            <span className="text-xs font-mono">
                              ({grievances.length})
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {authUser ? (
                    <div className="flex items-center gap-2.5 pl-3.5 pr-2.5 py-2 rounded-xl border border-teal-300 dark:border-teal-500/40 bg-teal-50 dark:bg-teal-500/15 text-teal-950 dark:text-teal-200 text-sm">
                      <UserCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                      <span className="font-bold max-w-[160px] truncate hidden sm:inline">
                        {authUser.email}
                      </span>
                      <button
                        onClick={handleSignOut}
                        title="Sign Out"
                        className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAuthStep('EMAIL');
                        setAuthError(null);
                        setAuthMessage(null);
                        setAuthModalOpen(true);
                      }}
                      className="flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition cursor-pointer shadow-xs"
                    >
                      <User className="w-4 h-4" />
                      <span>Sign In</span>
                    </button>
                  )}

                  <button
                    onClick={() => setDarkMode((prev) => !prev)}
                    aria-label="Toggle Theme"
                    className="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-amber-300 flex items-center justify-center transition cursor-pointer"
                  >
                    {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </header>
          </div>

          {/* MAIN WORKSPACE */}
          <main className="w-full px-5 sm:px-8 py-6 space-y-6">
            {/* 4 KPI SUMMARY CARDS WITH CRISP DARK LABELS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Total Reports
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {grievances.length}
                  </p>
                  <p className="text-xs font-bold text-teal-700 dark:text-teal-400 mt-1">
                    Active Public Ledger
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                  <Activity className="w-6 h-6" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Critical Issues
                  </p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-400">
                      {criticalCount}
                    </span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      + {highCount} High
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                    4h–12h Resolution Target
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Average Urgency
                  </p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                      {avgUrgency}
                    </span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      / 100
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                    Severity & Proximity Score
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between shadow-xs">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    My Submissions
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {myReportsList.length}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 truncate max-w-[180px]">
                    {authUser?.email ? authUser.email : 'Sign in to track reports'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* ANALYTICS TAB */}
            {activeTab === 'ANALYTICS' && (
              <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 shadow-xs">
                <div className="lg:col-span-7 space-y-4">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-teal-600" />
                    Department Workload Breakdown
                  </h3>
                  {departmentStats.length === 0 ? (
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 py-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                      No department metrics yet. Submit a report to view analytics.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {departmentStats.map(([dept, count]) => {
                        const pct = Math.min(
                          100,
                          Math.round((count / Math.max(1, grievances.length)) * 100)
                        );
                        return (
                          <div key={dept} className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-slate-800 dark:text-slate-200">
                              <span>{dept}</span>
                              <span className="text-teal-700 dark:text-teal-400">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-teal-600"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 pt-4 lg:pt-0 lg:pl-6 space-y-3">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Standard Resolution Timelines
                  </h3>
                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-500/15 text-rose-800 dark:text-rose-300 font-bold">
                      <span>Critical (Open Manhole / Live Wire)</span>
                      <span>4h – 6h</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 font-bold">
                      <span>High (Sewage Overflow / Pipe Burst)</span>
                      <span>12h – 24h</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-xl bg-teal-50 dark:bg-teal-500/15 text-teal-900 dark:text-teal-300 font-bold">
                      <span>Medium (Road Pothole / Garbage)</span>
                      <span>24h – 48h</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MAIN WORKSPACE: FORM + MAP */}
            {activeTab === 'WORKSPACE' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                <div className="lg:col-span-5 flex flex-col">
                  <GrievanceForm
                    userEmail={authUser?.email ?? null}
                    onRequireAuth={() => {
                      setAuthStep('EMAIL');
                      setAuthError(null);
                      setAuthMessage(null);
                      setAuthModalOpen(true);
                    }}
                    selectedLat={selectedLat}
                    selectedLon={selectedLon}
                    onSelectLocation={(lat, lon) => {
                      setSelectedLat(lat);
                      setSelectedLon(lon);
                    }}
                    onSuccess={(newRecord) => {
                      fetchGrievances();
                      setActiveTraceRecord(newRecord);
                    }}
                  />
                </div>

                <div className="lg:col-span-7 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between shadow-xs">
                  <div className="space-y-3 mb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-teal-600" />
                          Grievance Map
                        </h2>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Click anywhere on the map to set the issue location
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Critical
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> High
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Medium
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 mr-1">
                        Locations:
                      </span>
                      {CITY_PRESETS.map((city) => (
                        <button
                          key={city.name}
                          type="button"
                          onClick={() => {
                            setSelectedLat(city.lat);
                            setSelectedLon(city.lon);
                          }}
                          className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-lg border transition cursor-pointer ${
                            Math.abs(selectedLat - city.lat) < 0.05
                              ? 'bg-teal-600 text-white border-teal-600'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {city.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-full flex-1 min-h-[520px] rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 relative">
                    <LiveMap
                      grievances={filteredGrievances}
                      selectedLat={selectedLat}
                      selectedLon={selectedLon}
                      onSelectLocation={(lat, lon) => {
                        setSelectedLat(lat);
                        setSelectedLon(lon);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* BOTTOM GRIEVANCE REPORTS LIST */}
            <section className="space-y-4">
              <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-teal-600" />
                    {activeTab === 'MY_REPORTS'
                      ? `My Reports (${filteredGrievances.length})`
                      : `Reported Issues (${filteredGrievances.length})`}
                  </h2>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {activeTab === 'MY_REPORTS'
                      ? authUser?.email
                        ? `Showing issues submitted by ${authUser.email}`
                        : 'Sign in to view and track your submitted complaints'
                      : 'Public record of reported civic issues, assigned departments, and resolution timelines'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-600 dark:text-slate-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search reports..."
                      className="pl-9 pr-4 py-2 text-sm font-medium rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((level) => (
                      <button
                        key={level}
                        onClick={() => setFilterPriority(level)}
                        className={`text-xs sm:text-sm px-3.5 py-2 rounded-xl font-bold transition cursor-pointer ${
                          filterPriority === level
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredGrievances.length === 0 ? (
                <div className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-xs">
                  <Sparkles className="w-8 h-8 text-teal-600 mx-auto mb-2.5" />
                  <p className="text-base font-extrabold text-slate-900 dark:text-white">
                    {activeTab === 'MY_REPORTS'
                      ? 'No reports found for your account yet.'
                      : 'No reports match this filter yet.'}
                  </p>
                  <p className="text-slate-700 dark:text-slate-300 text-sm font-medium mt-1 max-w-md mx-auto">
                    {activeTab === 'MY_REPORTS' && !authUser
                      ? 'Click "Sign In" in the top bar to verify your email and track your submissions.'
                      : 'Upload a photo in the form above to report a new civic issue.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {filteredGrievances.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between transition hover:shadow-md shadow-xs"
                    >
                      <div>
                        <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute top-3 left-3">
                            <span
                              className={`text-xs font-bold px-3 py-1 rounded-lg shadow-xs ${
                                item.priority_level === 'CRITICAL'
                                  ? 'bg-rose-600 text-white'
                                  : item.priority_level === 'HIGH'
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-amber-500 text-slate-950'
                              }`}
                            >
                              {item.priority_level} • {item.urgency_score}/100
                            </span>
                          </div>
                          <div className="absolute bottom-2.5 right-2.5 bg-slate-900/90 text-white text-xs font-bold px-3 py-1 rounded-lg">
                            SLA: {item.statutory_sla_hours}h
                          </div>
                        </div>

                        <div className="p-5 space-y-3">
                          <div className="text-xs text-teal-700 dark:text-teal-400 font-extrabold uppercase tracking-wider truncate">
                            {item.category} • {item.responsible_department}
                          </div>
                          <h3 className="text-base font-extrabold text-slate-900 dark:text-white line-clamp-1">
                            {item.title}
                          </h3>
                          <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed font-medium">
                            {item.ai_summary}
                          </p>

                          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5 pt-1">
                            <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                            <span className="truncate">{item.address_display}</span>
                          </div>

                          <div className="rounded-xl p-3.5 mt-2 border border-teal-200 dark:border-teal-500/30 bg-teal-50/80 dark:bg-teal-500/10">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-extrabold text-teal-900 dark:text-teal-300">
                                Citizen Charter ({item.citizen_language})
                              </span>
                              <button
                                onClick={() =>
                                  speakRegionalNotice(item.regional_citizen_explainer)
                                }
                                className="text-xs flex items-center gap-1 text-teal-800 dark:text-teal-300 hover:underline font-bold cursor-pointer"
                              >
                                <Volume2 className="w-4 h-4" /> Listen
                              </button>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-medium line-clamp-2">
                              {item.regional_citizen_explainer}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
                        <button
                          onClick={() => handleUpvote(item.id)}
                          disabled={upvotingId === item.id}
                          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
                        >
                          <ThumbsUp className="w-4 h-4 text-teal-600" />
                          Upvote ({item.upvotes})
                        </button>

                        <button
                          onClick={() => setActiveTraceRecord(item)}
                          className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-xl transition cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>

        {/* SIGN IN MODAL */}
        {authModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    Sign In
                  </h3>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-0.5">
                    {authStep === 'EMAIL'
                      ? 'Enter your email to receive a verification code'
                      : 'Enter the verification code sent to your email'}
                  </p>
                </div>
                <button
                  onClick={() => setAuthModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {authError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm font-semibold">
                  {authError}
                </div>
              )}

              {authMessage && (
                <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-500/15 border border-teal-200 dark:border-teal-500/30 text-teal-900 dark:text-teal-200 text-sm font-semibold">
                  {authMessage}
                </div>
              )}

              {authStep === 'EMAIL' ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      Email address
                    </label>
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-base text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {authLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      <>
                        Continue <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      Verification code
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={8}
                      required
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="Enter 6-digit code"
                      className="w-full text-center tracking-[0.35em] font-mono text-lg font-bold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-teal-600"
                    />
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setAuthStep('EMAIL')}
                      className="w-1/3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-bold cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-2/3 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {authLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Verify & Sign In'
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {activeTraceRecord && (
          <AgentTraceModal
            darkMode={darkMode}
            record={activeTraceRecord}
            onClose={() => setActiveTraceRecord(null)}
          />
        )}
      </div>
    </div>
  );
}