// @ts-nocheck
"use client";

import React, { useEffect, useState, useRef } from "react";
import localforage from "localforage";

type TriagePayload = {
  patientName?: string;
  age?: number | null;
  gender?: string | null;
  village?: string | null;
  symptoms: string;
  severity?: string | null;
  pregnant?: boolean | null;
  photoBase64?: string | null;
  extra?: Record<string, any>;
};

type TriageResponse = {
  ok?: boolean;
  case?: any;
  audio_url?: string | null;
  photo_url?: string | null;
  error?: string;
  detail?: string;
};

const QUEUE_KEY = "triage-queue-v1";

// --- SVG Icons for UI Enhancement ---
const Icons = {
  Online: () => <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" /><path d="M10.97 4.97a.75.75 0 0 1 1.06 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06L5.22 9.94l4.75-4.75z" /></svg>,
  Offline: () => <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" /><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" /></svg>,
  Alert: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  Play: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>,
  Broadcast: () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M4.632 3.533A2 2 0 016.577 2h6.846a2 2 0 011.945 1.533l1.976 8.234A3.489 3.489 0 0018 11.5H2c-.473 0-.92-.086-1.332-.234L4.632 3.533zM4 14v-1h12v1a2 2 0 01-2 2H6a2 2 0 01-2-2z" /></svg>,
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function enqueue(payload: TriagePayload) {
  const arr: TriagePayload[] = (await localforage.getItem(QUEUE_KEY)) || [];
  arr.push(payload);
  await localforage.setItem(QUEUE_KEY, arr);
}

async function dequeueOne(): Promise<TriagePayload | null> {
  const arr: TriagePayload[] = (await localforage.getItem(QUEUE_KEY)) || [];
  if (arr.length === 0) return null;
  const item = arr.shift()!;
  await localforage.setItem(QUEUE_KEY, arr);
  return item;
}

async function getQueueCount(): Promise<number> {
  const arr: TriagePayload[] = (await localforage.getItem(QUEUE_KEY)) || [];
  return arr.length;
}

const SUPA_URL = "https://dtnsytmzmllfcwcumlkq.supabase.co";
const SUPA_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bnN5dG16bWxsZmN3Y3VtbGtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEwMDM2NywiZXhwIjoyMDc4Njc2MzY3fQ.o_-LHh2e0SqelWVhmB_EFabFIPZ15lVD9bPacCg9d9U";


// --- FIX: Moved components outside of TriagePage ---
// These are now defined once at the module level and won't be
// recreated on every render, thus preserving focus state.

// --- Reusable Form Label Component ---
const FormLabel = ({ children, htmlFor }: { children: React.ReactNode, htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="block text-sm font-semibold text-slate-700 mb-1.5">
    {children}
  </label>
);

// --- Reusable Input Component ---
const FormInput = ({ ...props }) => (
  <input
    {...props}
    className="mt-1 block w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition"
  />
);

// --- Reusable Select Component ---
const FormSelect = ({ children, ...props }: { children: React.ReactNode, [key: string]: any }) => (
  <select
    {...props}
    className="mt-1 block w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition"
  >
    {children}
  </select>
);
// --- End of moved components ---


export default function TriagePage() {
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<"M" | "F" | "O" | "">("");
  const [village, setVillage] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [pregnant, setPregnant] = useState<boolean | null>(null);
  const [showBroadcastPopup, setShowBroadcastPopup] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [nlpData, setNlpData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [supabaseClient, setSupabaseClient] = useState<any | null>(null);
  const [latestBroadcast, setLatestBroadcast] = useState<any | null>(null);

  // show severity returned by NLP in UI
  const [nlpSeverity, setNlpSeverity] = useState<string | null>(null);

  useEffect(() => {
    localforage.config({
      name: "rural-healthcare",
      storeName: "triage_queue",
    });

    (async () => setQueueCount(await getQueueCount()))();
  }, []);

  useEffect(() => {
    if (!SUPA_URL || !SUPA_ANON) return;

    let cancelled = false;

    (async () => {
      try {
        const mod = await import("@supabase/supabase-js");
        if (cancelled) return;
        const client = mod.createClient(SUPA_URL, SUPA_ANON);
        setSupabaseClient(client);
      } catch (e) {
        console.warn("Supabase init failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabaseClient) return;

    let subHandle: any = null;

    const channel = supabaseClient
      .channel("public:broadcasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "broadcasts" },
        (payload: any) => {
          const b = payload.new;
          setLatestBroadcast(b);
          setShowBroadcastPopup(true);
          try {
            alert(`Broadcast — ${b.severity}

${b.message}`);
          } catch { }

          try {
            const utter = new SpeechSynthesisUtterance(b.message);
            utter.lang = "hi-IN";
            speechSynthesis.cancel();
            speechSynthesis.speak(utter);
          } catch { }
        }
      );

    (async () => {
      try {
        subHandle = await channel.subscribe();
      } catch { }
    })();

    return () => {
      try {
        if (subHandle?.unsubscribe) subHandle.unsubscribe();
      } catch { }
    };
  }, [supabaseClient]);

  useEffect(() => {
    if (!SUPA_URL || !SUPA_ANON) return;

    let mounted = true;
    let pollId: NodeJS.Timeout | null = null;

    async function fetchLatestBroadcast() {
      try {
        const url = `${SUPA_URL}/rest/v1/broadcasts?select=*&order=created_at.desc&limit=1`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            apikey: SUPA_ANON,
            Authorization: `Bearer ${SUPA_ANON}`,
          },
        });

        if (!res.ok) return;

        const arr = await res.json();
        if (!mounted) return;

        if (Array.isArray(arr) && arr.length > 0) {
          const b = arr[0];
          if (!latestBroadcast || b.id !== latestBroadcast.id)
            setLatestBroadcast(b);
        }
      } catch { }
    }

    fetchLatestBroadcast();
    pollId = setInterval(fetchLatestBroadcast, 5000);

    return () => {
      mounted = false;
      if (pollId) clearInterval(pollId);
    };
  }, [latestBroadcast]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    function onOnline() {
      setIsOnline(true);
      syncQueue();
    }
    function onOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function syncQueue() {
    if (!navigator.onLine) return;

    setLoading(true);
    try {
      let next = await dequeueOne();
      while (next) {
        try {
          await sendTriage(next, false);
        } catch {
          await enqueue(next);
          break;
        }
        next = await dequeueOne();
      }
    } finally {
      setLoading(false);
      setQueueCount(await getQueueCount());
    }
  }

  async function sendTriage(
    payload: TriagePayload,
    allowEnqueue = true
  ): Promise<TriageResponse> {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({ error: "network_error" }));
      throw new Error(json?.error || json?.detail || `HTTP ${res.status}`);
    }

    return await res.json();
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setResult(null);
    setNlpData(null);

    if (!symptoms || symptoms.trim().length < 3) {
      setError("Symptoms are required.");
      return;
    }

    if (gender === "F" && pregnant === null) {
      setError("Toggle pregnancy status.");
      return;
    }

    setLoading(true);

    let photoBase64: string | null = null;
    try {
      if (photoFile) photoBase64 = await fileToBase64(photoFile);
    } catch {
      setError("Photo error.");
      setLoading(false);
      return;
    }

    const payload: TriagePayload = {
      patientName,
      age: typeof age === "number" ? age : undefined,
      gender,
      village,
      symptoms: symptoms.trim(),
      // severity intentionally omitted (removed UI)
      pregnant: pregnant ?? undefined,
      photoBase64: photoBase64 ?? undefined,
      extra: {},
    };

    try {
      const resp = await sendTriage(payload);
      setResult(resp);

      try {
        const nlpRes = await fetch("/api/nlp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chid: resp.case?.chid,
            symptoms,
            age,
            village,
          }),
        });

        const nlpJson = await nlpRes.json();
        setNlpData(nlpJson);
        // normalize severity from NLP (be tolerant of different keys/values)
        const rawSeverity =
          nlpJson?.severity ??
          nlpJson?.risk ??
          nlpJson?.level ??
          nlpJson?.severity_label ??
          null;

        let normalized: string | null = null;
        if (rawSeverity) {
          const s = String(rawSeverity).toLowerCase();
          if (s.includes("high") || s.includes("zyaada") || s.includes("severe")) normalized = "zyaada";
          else if (s.includes("medium") || s.includes("madhyam")) normalized = "madhyam";
          else if (s.includes("low") || s.includes("kam")) normalized = "kam";
          else normalized = s; // fallback: whatever NLP returned
        }

        setNlpSeverity(normalized);

        // send severity back to server to update the case row (non-blocking)
        try {
          if (resp?.case?.chid && normalized) {
            await fetch("/api/triage/update-severity", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chid: resp.case.chid,
                severity: normalized
              }),
            });
          }
        } catch (e) {
          console.warn("update severity failed", e);
        }

        // setSeverity(nlpJson.severity);
      } catch (e) {
        console.warn("NLP error", e);
      }

      if (resp.audio_url) {
        setTimeout(() => {
          try {
            audioRef.current?.load();
            audioRef.current?.play().catch(() => { });
          } catch { }
        }, 300);
      }
    } catch (err) {
      setError("Submission failed.");
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4 md:p-10 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* HEADER */}
        <header className="text-center py-4">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Patient Triage Form
          </h1>
          <p className="text-slate-600 mt-2 text-lg">
            Provide details for AI-assisted triage assessment.
          </p>

          {/* Online / Queue status */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <div className={`inline-flex items-center gap-2 py-1.5 px-4 rounded-full text-xs font-bold tracking-wide ${isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              <span className="animate-pulse">{isOnline ? <Icons.Online /> : <Icons.Offline />}</span>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
            <div className="inline-flex items-center gap-2 py-1.5 px-4 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
              PENDING IN QUEUE: <span className="text-sm">{queueCount}</span>
            </div>
          </div>

        </header>

        {/* FORM CARD */}
        <main className="bg-white/90 backdrop-blur-lg border border-slate-200 rounded-3xl shadow-xl overflow-hidden">

          <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-6">

            {/* GRID 1: Name, Age */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel htmlFor="patientName">Patient Name</FormLabel>
                <FormInput
                  id="patientName"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                />
              </div>

              <div>
                <FormLabel htmlFor="age">Age</FormLabel>
                <FormInput
                  id="age"
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  type="number"
                  placeholder="e.g. 45"
                />
              </div>
            </div>

            {/* GRID 2: Gender, Village */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FormLabel htmlFor="gender">Gender</FormLabel>
                <FormSelect
                  id="gender"
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value as any);
                    if (e.target.value !== "F") setPregnant(false);
                    else setPregnant(null);
                  }}
                >
                  <option value="">Select gender...</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </FormSelect>
              </div>

              <div>
                <FormLabel htmlFor="village">Village</FormLabel>
                <FormInput
                  id="village"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="e.g. Dhampur"
                />
              </div>
            </div>

            {/* SYMPTOMS */}
            <div>
              <FormLabel htmlFor="symptoms">Symptoms (Required)</FormLabel>
              <textarea
                id="symptoms"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                rows={4}
                className="mt-1 block w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition"
                placeholder="Describe symptoms: e.g., 'तेज़ बुखार और खांसी', 'severe headache and vomiting'..."
              />
            </div>

            {/* PHOTO UPLOAD + PREGNANCY TOGGLE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-2">
              <div>
                <FormLabel htmlFor="photo">Photo (Optional)</FormLabel>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  className="mt-1 block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition"
                />
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-slate-700">Pregnant?</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPregnant(true)}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition ${pregnant === true ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setPregnant(false)}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition ${pregnant === false ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            {/* ERROR MESSAGE */}
            {error && (
              <div className="flex items-center gap-3 text-red-700 text-sm font-medium bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                <Icons.Alert />
                <span>{error}</span>
              </div>
            )}

            {/* SUBMIT BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-3 items-center pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto flex-1 py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md shadow-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {loading ? "Submitting…" : "Submit Triage"}
              </button>
              <button
                type="button"
                onClick={() => {
                  enqueue({
                    patientName,
                    age: typeof age === 'number' ? age : undefined,
                    gender,
                    village,
                    symptoms: symptoms.trim(),
                    // severity intentionally omitted when saving locally
                    pregnant: pregnant ?? undefined,
                    photoBase64: undefined,
                    extra: {},
                  });
                  (async () => setQueueCount(await getQueueCount()))();
                }}
                className="w-full sm:w-auto px-6 py-3.5 bg-white rounded-lg text-slate-700 text-sm font-medium border border-slate-300 hover:bg-slate-50 transition active:scale-[0.98]"
              >
                Save Locally (Offline)
              </button>
            </div>

          </form>
        </main>

        {/* NLP RESULT CARD */}
        {nlpData && (
          <section className="bg-white/90 backdrop-blur-md border border-slate-200 rounded-3xl shadow-xl p-8 md:p-10 space-y-6">

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">AI Triage Result</h2>
              <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full">{nlpData.chid}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-sm text-slate-700">
                <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Assessed Risk</span>
                {nlpSeverity ? (
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${nlpSeverity === "zyaada" ? "bg-red-100 text-red-800" : nlpSeverity === "madhyam" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}
                  >
                    {nlpSeverity === "zyaada" ? "High Priority" : nlpSeverity === "madhyam" ? "Medium Priority" : nlpSeverity === "kam" ? "Low Priority" : nlpSeverity}
                  </span>
                ) : (
                  <span className="text-slate-500">Unknown</span>
                )}
              </div>
              <div className="text-sm text-slate-700">
                <span className="block text-xs font-semibold text-slate-500 uppercase mb-1">Reason</span>
                <p className="font-medium">{nlpData.reason}</p>
              </div>
            </div>

            <div className="space-y-3 text-slate-700">
              <p className="text-sm font-semibold text-slate-500 uppercase">Recommended Action (Hindi)</p>
              <p className="text-lg font-medium text-slate-800 bg-slate-50 p-4 rounded-lg border">
                {nlpData.advice || nlpData.summary || nlpData.summary_text || nlpData.nlp_summary}
              </p>
            </div>

            <div className="pt-4 flex items-center gap-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  if (nlpData.audio_url) new Audio(nlpData.audio_url).play();
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow shadow-emerald-500/30 transition active:scale-95"
              >
                <Icons.Play />
                Play Hindi Audio
              </button>

              <button
                type="button"
                onClick={() => {
                  try {
                    const txt = nlpData.advice || nlpData.summary || '';
                    navigator.clipboard.writeText(txt);
                  } catch { }
                }}
                className="ml-auto text-sm px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg border border-slate-200"
              >
                Copy Advice
              </button>

              {nlpData.audio_url && (
                <a
                  href={nlpData.audio_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline text-sm font-medium"
                >
                  Download Audio
                </a>
              )}
            </div>
          </section>
        )}

        {/* BROADCAST POPUP */}
        {showBroadcastPopup && latestBroadcast && (
          <div className="fixed bottom-6 right-6 bg-rose-600 text-white w-full max-w-sm p-5 rounded-2xl shadow-2xl z-[999] ring-4 ring-rose-500/30 animate-in slide-in-from-bottom-5 duration-300">
            <div className="flex items-start gap-3">
              <span className="mt-1"><Icons.Broadcast /></span>
              <div>
                <div className="text-lg font-bold tracking-wide">
                  Broadcast Alert — {latestBroadcast.severity?.toUpperCase()}
                </div>
                <p className="mt-1.5 text-sm text-rose-50">{latestBroadcast.message}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowBroadcastPopup(false)}
                className="flex-1 w-full bg-white text-rose-600 py-2 rounded-lg text-sm font-medium hover:bg-rose-50 transition"
              >
                Dismiss
              </button>
              {latestBroadcast?.link && (
                <a
                  href={latestBroadcast.link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-sm font-medium hover:bg-white/30 transition"
                >
                  Details
                </a>
              )}
            </div>
          </div>
        )}

        <audio
          ref={audioRef}
          className="hidden"
          src={result?.audio_url ?? undefined}
        />

        <footer className="text-center text-xs text-slate-500 pt-6 pb-2">
          AI-Powered Rural Healthcare Continuity System
        </footer>
      </div>
    </div>
  );
}