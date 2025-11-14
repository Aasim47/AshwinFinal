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

/* ---------- NEW: supabase envs (client) ---------- */
const SUPA_URL = "https://dtnsytmzmllfcwcumlkq.supabase.co";
const SUPA_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bnN5dG16bWxsZmN3Y3VtbGtxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEwMDM2NywiZXhwIjoyMDc4Njc2MzY3fQ.o_-LHh2e0SqelWVhmB_EFabFIPZ15lVD9bPacCg9d99U";

export default function TriagePage() {
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState<"M" | "F" | "O" | "">("");
  const [village, setVillage] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [severity, setSeverity] = useState<"kam" | "madhyam" | "zyaada" | "">("");
  const [pregnant, setPregnant] = useState<boolean | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ---------- NEW: supabase client state & latest broadcast ---------- */
  const [supabaseClient, setSupabaseClient] = useState<any | null>(null);
  const [latestBroadcast, setLatestBroadcast] = useState<any | null>(null);

  // init localforage config
  useEffect(() => {
    localforage.config({
      name: "rural-healthcare",
      storeName: "triage_queue"
    });

    (async () => setQueueCount(await getQueueCount()))();
  }, []);

  // create supabase client on client only (used for broadcast listener)
  useEffect(() => {
    if (!SUPA_URL || !SUPA_ANON) {
      // env not configured — skip
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@supabase/supabase-js");
        if (cancelled) return;
        const client = mod.createClient(SUPA_URL, SUPA_ANON);
        setSupabaseClient(client);
      } catch (e) {
        console.warn("Supabase init failed on triage page:", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // volunteer broadcast listener (client-side)
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

          // quick visual fallback
          try { alert(`Broadcast — ${b.severity ?? "info"}\n\n${b.message}`); } catch { }

          // try simple TTS in Hindi if available
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
        if (subHandle?.error) console.warn("supabase broadcast subscribe error:", subHandle.error);
      } catch (err) {
        console.warn("broadcast channel subscribe failed:", err);
      }
    })();

    return () => {
      try {
        if (subHandle?.unsubscribe) subHandle.unsubscribe();
        else if (channel?.unsubscribe) channel.unsubscribe();
      } catch { }
    };
  }, [supabaseClient]);

  /* ------------------- POLLING FALLBACK (ADDED) -------------------
     Polls Supabase REST endpoint for the latest broadcast every 5s.
     Keeps realtime subscription as-is; polling only ensures triage
     page shows broadcasts even if realtime doesn't deliver events.
  -----------------------------------------------------------------*/
  useEffect(() => {
    if (!SUPA_URL || !SUPA_ANON) return;
    let mounted = true;
    let pollId: number | null = null;

    async function fetchLatestBroadcast() {
      try {
        const url = `${SUPA_URL}/rest/v1/broadcasts?select=*&order=created_at.desc&limit=1`;
        const res = await fetch(url, {
          method: "GET",
          headers: {
            apikey: SUPA_ANON,
            Authorization: `Bearer ${SUPA_ANON}`,
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          // ignore non-OK for polling
          return;
        }
        const arr = await res.json();
        if (!mounted) return;
        if (Array.isArray(arr) && arr.length > 0) {
          const b = arr[0];
          if (!latestBroadcast || (b && b.id !== latestBroadcast.id)) {
            setLatestBroadcast(b);
          }
        }
      } catch (e) {
        // ignore polling errors
      }
    }

    // run immediately then poll
    fetchLatestBroadcast();
    pollId = window.setInterval(fetchLatestBroadcast, 5000) as unknown as number;

    return () => {
      mounted = false;
      if (pollId) clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [SUPA_URL, SUPA_ANON, latestBroadcast]);
  /* ----------------------------------------------------------------- */

  // monitor online changes
  useEffect(() => {
    function onOnline() {
      setIsOnline(true);
      syncQueue(); // attempt sync when back online
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

  // try syncing queued items
  async function syncQueue() {
    if (!navigator.onLine) return;
    setLoading(true);
    try {
      let next = await dequeueOne();
      while (next) {
        try {
          await sendTriage(next, false); // send but don't re-enqueue on fail
        } catch (e) {
          // if failure, push it back and stop to avoid infinite loop
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

  // Build payload and POST to server
  async function sendTriage(payload: TriagePayload, allowEnqueue = true): Promise<TriageResponse> {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({ error: "network_error" }));
      throw new Error(json?.error || json?.detail || `HTTP ${res.status}`);
    }

    const json: TriageResponse = await res.json();
    return json;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setResult(null);

    // Simple validation
    if (!symptoms || symptoms.trim().length < 3) {
      setError("Symptoms are required (brief).");
      return;
    }
    if (!severity) {
      setError("Select severity.");
      return;
    }
    if (gender === "F" && pregnant === null) {
      // try to be helpful — default to false if user doesn't set
      setError("Please toggle pregnancy status (or set to 'No').");
      return;
    }

    setLoading(true);

    let photoBase64: string | null = null;
    try {
      if (photoFile) {
        photoBase64 = await fileToBase64(photoFile);
      }
    } catch (err) {
      console.warn("photo convert failed", err);
      setError("Failed to process photo. Try again without photo.");
      setLoading(false);
      return;
    }

    const payload: TriagePayload = {
      patientName: patientName || undefined,
      age: typeof age === "number" ? age : undefined,
      gender: gender || undefined,
      village: village || undefined,
      symptoms: symptoms.trim(),
      severity: severity || undefined,
      pregnant: pregnant ?? undefined,
      photoBase64: photoBase64 ?? undefined,
      extra: {}
    };

    // If offline, enqueue and return
    if (!navigator.onLine) {
      if (allowEnqueue()) {
        await enqueue(payload);
        setQueueCount(await getQueueCount());
        setLoading(false);
        setResult({
          ok: false,
          case: null,
          audio_url: null,
          photo_url: null,
          error: "queued_offline",
          detail: "Submission queued locally and will be sent when online."
        });
        return;
      } else {
        setLoading(false);
        setError("You are offline and queueing is disabled.");
        return;
      }
    }

    try {
      const resp = await sendTriage(payload);
      setResult(resp);
      setQueueCount(await getQueueCount());
      // play audio automatically if returned
      if (resp.audio_url) {
        setTimeout(() => {
          try {
            if (audioRef.current) {
              audioRef.current.load();
              audioRef.current.play().catch(() => { });
            }
          } catch { }
        }, 300);
      }
    } catch (err: any) {
      console.error("submit error", err);
      // On network/server error, try enqueueing if allowed
      if (allowEnqueue()) {
        await enqueue(payload);
        setQueueCount(await getQueueCount());
        setResult({
          ok: false,
          error: "queued_after_failure",
          detail: "Server error — submission queued locally and will retry."
        });
      } else {
        setError(err.message || "Submission failed");
      }
    } finally {
      setLoading(false);
    }
  }

  function allowEnqueue() {
    // We do queueing by default. If you want to disable it in some contexts, change here.
    return true;
  }

  // manual sync button
  async function handleSyncNow() {
    if (!navigator.onLine) {
      setError("You are offline. Connect to the internet to sync.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await syncQueue();
    } catch (e: any) {
      setError(e.message || "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  // Clear form helper
  function clearForm() {
    setPatientName("");
    setAge("");
    setGender("");
    setVillage("");
    setSymptoms("");
    setSeverity("");
    setPregnant(null);
    setPhotoFile(null);
    setError(null);
    setResult(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Triage — Volunteer / Patient</h1>
          <p className="text-sm text-slate-600 mt-1">
            Submit basic case details. System will generate a Hindi summary & audio.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className={`text-xs px-2 py-1 rounded ${isOnline ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}>
              {isOnline ? "Online" : "Offline (queue enabled)"}
            </div>
            <div className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">
              Queue: {queueCount}
            </div>
            <button
              onClick={handleSyncNow}
              className="ml-auto text-xs px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Sync Now
            </button>
          </div>
        </header>

        {latestBroadcast && (
          <div className="mb-4 p-3 rounded border-l-4 border-amber-400 bg-amber-50 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">Broadcast — {latestBroadcast.severity ?? "info"}</div>
                <div className="mt-1">{latestBroadcast.message}</div>
                {latestBroadcast.lat && latestBroadcast.lng && (
                  <div className="text-xs text-slate-500 mt-1">
                    Geo: {Number(latestBroadcast.lat).toFixed(4)}, {Number(latestBroadcast.lng).toFixed(4)}
                    {latestBroadcast.radius_meters ? ` — radius ${latestBroadcast.radius_meters} m` : ""}
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <button
                  onClick={() => setLatestBroadcast(null)}
                  className="px-2 py-1 bg-slate-100 text-xs rounded"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block">
                <div className="text-xs text-slate-600">Patient name</div>
                <input
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2"
                  placeholder="e.g., Raju"
                />
              </label>

              <label className="block">
                <div className="text-xs text-slate-600">Age</div>
                <input
                  value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full border rounded px-3 py-2"
                  placeholder="e.g., 28"
                  type="number"
                  min={0}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label>
                <div className="text-xs text-slate-600">Gender</div>
                <select
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value as any);
                    if (e.target.value !== "F") setPregnant(false);
                    else setPregnant(null);
                  }}
                  className="mt-1 w-full border rounded px-3 py-2"
                >
                  <option value="">Select</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </label>

              <label>
                <div className="text-xs text-slate-600">Village</div>
                <input
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="mt-1 w-full border rounded px-3 py-2"
                  placeholder="Village name"
                />
              </label>

              <label>
                <div className="text-xs text-slate-600">Severity</div>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as any)}
                  className="mt-1 w-full border rounded px-3 py-2"
                >
                  <option value="">Select</option>
                  <option value="kam">Kam (Low)</option>
                  <option value="madhyam">Madhyam (Medium)</option>
                  <option value="zyaada">Zyaada (High)</option>
                </select>
              </label>
            </div>

            <div>
              <div className="text-xs text-slate-600">Symptoms / Short description</div>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                className="mt-1 w-full border rounded px-3 py-2 min-h-[88px]"
                placeholder="e.g., bukhar, ulti, thakaan"
              />
            </div>

            <div className="flex items-center gap-4">
              {/* Pregnancy toggle appears if female, else still allow manual toggle */}
              <div className="flex items-center gap-2">
                <input
                  id="pregnant"
                  type="checkbox"
                  checked={!!pregnant}
                  onChange={(e) => setPregnant(e.target.checked ? true : false)}
                  className="h-4 w-4"
                />
                <label htmlFor="pregnant" className="text-sm text-slate-700">
                  Pregnant
                </label>
                <span className="ml-2 text-xs text-slate-500">(show only if female)</span>
              </div>

              <div className="ml-auto text-xs text-slate-500">Optional: upload photo</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files ? e.target.files[0] : null)}
                className="ml-2 text-xs"
              />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <div className="flex gap-3 items-center">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Submit Triage"}
              </button>

              <button
                type="button"
                onClick={clearForm}
                className="px-3 py-2 border rounded text-sm"
              >
                Clear
              </button>

              <div className="text-xs text-slate-500 ml-auto">Pro tip: Keep summary short for better audio</div>
            </div>
          </form>
        </main>

        {/* result section */}
        {result && (
          <section className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-medium">Result</h2>

            {result.ok ? (
              <>
                <div className="mt-3 text-sm text-slate-700">
                  <div><strong>CHID:</strong> {result.case?.chid}</div>
                  <div className="mt-2"><strong>Summary (Hindi):</strong></div>
                  <div className="mt-1 p-3 bg-slate-50 rounded">{result.case?.summary_hindi}</div>
                </div>

                {result.audio_url && (
                  <div className="mt-4">
                    <audio ref={audioRef} controls>
                      <source src={result.audio_url} />
                      Your browser does not support the audio element.
                    </audio>
                    <div className="mt-2 flex gap-2">
                      <a
                        className="text-sm px-3 py-2 bg-emerald-600 text-white rounded"
                        href={result.audio_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open audio
                      </a>

                      <a
                        className="text-sm px-3 py-2 bg-green-600 text-white rounded"
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `${result.case?.summary_hindi}\n\nAudio: ${result.audio_url}`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Share to WhatsApp
                      </a>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 text-sm">
                <div className="text-slate-700">Status: {result.error || "Queued"}</div>
                {result.detail && <div className="text-slate-500 mt-2">{result.detail}</div>}
              </div>
            )}
          </section>
        )}

        <footer className="mt-6 text-xs text-slate-500">
          Built for hackathon demo — keep form short and focused.
        </footer>
      </div>
    </div>
  );
}
