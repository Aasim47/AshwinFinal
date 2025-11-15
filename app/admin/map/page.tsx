// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useMap } from "react-leaflet";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// dynamic react-leaflet components (client-only)
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import("react-leaflet").then((m) => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
// Circle (for radius)
const Circle = dynamic(() => import("react-leaflet").then((m) => m.Circle), { ssr: false });

// cluster
const MarkerClusterGroup = dynamic(() => import("react-leaflet-markercluster"), { ssr: false });

// Heat / chart libs will be used client-side via dynamic import or global
let LHeat: any = null; // will be set after dynamic import of leaflet.heat

// cast to any to avoid build-time TS fights
const MapContainerAny: any = MapContainer;
const TileLayerAny: any = TileLayer;
const CircleMarkerAny: any = CircleMarker;
const PopupAny: any = Popup;
const CircleAny: any = Circle;
const MarkerClusterGroupAny: any = MarkerClusterGroup;

// ENV
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Types
type CaseRow = {
  id: string;
  chid: string;
  patient_id?: string;
  summary_hindi?: string;
  symptoms?: string;
  severity?: string;
  audio_path?: string | null;
  photo_path?: string | null;
  extra?: any;
  created_at?: string;
};

type RiskCard = {
  id: string;
  village: string;
  lat: number;
  lng: number;
  risk_score: number;
  risk_level: string;
  summary: string;
  last_updated: string;
};

type BroadcastRow = {
  id: string;
  sender?: string;
  message: string;
  severity?: "kam" | "madhyam" | "zyaada";
  lat?: number | null;
  lng?: number | null;
  radius_meters?: number | null;
  created_at?: string;
};

// --- ICONS (SVG) for UI Enhancement ---
const Icons = {
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Close: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  Play: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  Broadcast: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
  Refresh: () => <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
};

// AutoCenter component (uses react-leaflet useMap)
function AutoCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !lat || !lng) return;
    try {
      map.flyTo([lat, lng], 14, { duration: 1 });
    } catch (e) {}
  }, [lat, lng, map]);
  return null;
}

// BroadcastModal component (REFACTORED to be controlled)
function BroadcastModalContent({ 
  open, 
  onClose, 
  onSent 
}: { 
  open: boolean; 
  onClose: () => void; 
  onSent?: (b: any) => void 
}) {
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"kam" | "madhyam" | "zyaada">("madhyam");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [radius, setRadius] = useState<number | "">("");

  // Reset fields when opening
  useEffect(() => {
    if (open) {
      setMessage("");
      setSeverity("madhyam");
      setLat("");
      setLng("");
      setRadius("");
    }
  }, [open]);

  async function sendBroadcast() {
    if (!message || message.trim().length < 3) {
      alert("Enter a message (min 3 chars)");
      return;
    }
    const payload = {
      sender: "admin",
      message: message.trim(),
      severity,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      radius_meters: radius === "" ? null : Number(radius),
    };

    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        alert("Send failed: " + (json?.detail || json?.error || res.statusText));
        return;
      }
      // feedback
      onClose(); // Use callback
      toast.success("Broadcast sent.");
      if (onSent) onSent(json.broadcast || json);
    } catch (e: any) {
      console.error("broadcast error", e);
      alert("Broadcast failed: " + (e?.message || e));
    }
  }

  if (!open) return null; // Render nothing if not open

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
             <h3 className="text-lg font-bold text-slate-800">Emergency Broadcast</h3>
             <p className="text-xs text-slate-500">Send alert to users in the field</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition">
            <Icons.Close />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Message</label>
            <textarea 
              value={message} 
              onChange={(e)=>setMessage(e.target.value)} 
              placeholder="Type your alert message here (Hindi/English)..." 
              className="w-full border border-slate-300 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all placeholder:text-slate-400" 
              rows={4} 
            />
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1">
               <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">Severity Level</label>
               <select 
                 value={severity} 
                 onChange={(e)=> setSeverity(e.target.value as any)} 
                 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
               >
                <option value="kam">Low Priority</option>
                <option value="madhyam">Medium Priority</option>
                <option value="zyaada">High Priority</option>
               </select>
            </div>
            <div className="text-xs text-slate-400 pb-2">
                Define urgency level for recipients.
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
             <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase">Geofence (Optional)</span>
                <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border">Lat/Lng + Radius</span>
             </div>
             <div className="grid grid-cols-3 gap-3">
                <input value={lat} onChange={(e)=>setLat(e.target.value)} placeholder="Latitude" className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                <input value={lng} onChange={(e)=>setLng(e.target.value)} placeholder="Longitude" className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
                <input value={radius as any} onChange={(e)=>setRadius(e.target.value === "" ? "" : Number(e.target.value))} placeholder="Radius (m)" className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
             </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition">Cancel</button>
          <button onClick={sendBroadcast} className="px-5 py-2 text-sm font-medium bg-rose-600 text-white rounded-lg shadow-md hover:bg-rose-700 hover:shadow-lg transition-all">Send Alert</button>
        </div>
      </div>
    </div>
  );
}

// util: pseudo-locations
function pseudoLocationFromString(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h << 5) - h + key.charCodeAt(i);
    h = h & h;
  }
  const lat = 21.1458 + (Math.abs(h) % 1000) * 0.00005;
  const lng = 81.9036 + ((Math.abs(h) >> 5) % 1000) * 0.00005;
  return [lat, lng];
}

export default function AdminMapPage(): JSX.Element {
  // core state
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [risks, setRisks] = useState<RiskCard[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [supabaseClient, setSupabaseClient] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // features state
  const [filter, setFilter] = useState<"all" | "kam" | "madhyam" | "zyaada">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showPlayLatest, setShowPlayLatest] = useState(true);
  const [heatOn, setHeatOn] = useState(false);
  const [clusterOn, setClusterOn] = useState(true);
  const [tileTheme, setTileTheme] = useState<"day" | "night">("day");
  const [search, setSearch] = useState("");

  // *** FIX: Modal state lifted to parent ***
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);

  const mapRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  const center = useMemo(() => [21.1458, 81.9036] as [number, number], []);

  // latestCase (by created_at)
  const latestCase = useMemo(() => {
    if (!cases || cases.length === 0) return null;
    const sorted = [...cases].sort(
      (a, b) =>
        (new Date(b.created_at || 0).getTime() || 0) - (new Date(a.created_at || 0).getTime() || 0)
    );
    return sorted[0] ?? null;
  }, [cases]);

  // init supabase client client-side
  useEffect(() => {
    setIsClient(true);
    if (!SUPA_URL || !SUPA_ANON) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@supabase/supabase-js");
        if (cancelled) return;
        const client = mod.createClient(SUPA_URL, SUPA_ANON);
        setSupabaseClient(client);
      } catch (e: any) {
        console.error("supabase import error", e);
        setError("Failed to initialize Supabase.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // load heat library on client
  useEffect(() => {
    (async () => {
      if (!isClient) return;
      try {
        await import("leaflet.heat");
        LHeat = (window as any).L?.heatLayer ?? null;
      } catch (e) {
        console.warn("leaflet.heat import failed", e);
      }
    })();
  }, [isClient]);

  // build audio URL
  function audioUrlFor(path?: string | null) {
    if (!path) return null;
    return `${SUPA_URL}/storage/v1/object/public/audio/${path}`;
  }

  // load data
  async function loadInitial() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/simulate");
      if (resp.ok) {
        const json = await resp.json();
        setRisks(json as RiskCard[]);
      }
      if (isClient && supabaseClient) {
        const { data, error: supaErr } = await supabaseClient
          .from<CaseRow>("cases")
          .select("id, chid, summary_hindi, symptoms, severity, audio_path, photo_path, extra, created_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (supaErr) {
          console.error("supabase cases fetch error", supaErr);
          setError("Failed to fetch cases from Supabase.");
        } else if (data) {
          setCases(data);
          buildChartData(data);
        }

        // also fetch recent broadcasts (last 100)
        const { data: bdata } = await supabaseClient
          .from<BroadcastRow>("broadcasts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);
        if (bdata) {
          setBroadcasts(bdata);
        }
      }
    } catch (e: any) {
      console.error("loadInitial error", e);
      setError("Network or server error while loading data.");
    } finally {
      setLoading(false);
    }
  }

  // Realtime subscribe (safe) - includes cases + broadcasts
  useEffect(() => {
    if (isClient) loadInitial();
    let channelCases: any = null;
    let channelBroadcasts: any = null;
    let subscriptionCases: any = null;
    let subscriptionBroadcasts: any = null;

    if (supabaseClient) {
      (async () => {
        try {
          // cases subscription
          channelCases = supabaseClient
            .channel("public:cases")
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "cases" },
              (payload: any) => {
                const newRow: CaseRow = payload.new;
                setCases((prev) => {
                  const next = [newRow, ...prev];
                  buildChartData(next);
                  return next;
                });
                toast.info(`New case: ${newRow.chid} — ${newRow.severity ?? "-"}`);
              }
            );
          subscriptionCases = await channelCases.subscribe();
          if (subscriptionCases?.error) {
            console.warn("supabase cases subscribe returned error", subscriptionCases.error);
          }
        } catch (err) {
          console.warn("supabase cases subscription failed:", err);
          try {
            if (channelCases?.unsubscribe) channelCases.unsubscribe();
          } catch {}
        }

        try {
          // broadcasts subscription
          channelBroadcasts = supabaseClient
            .channel("public:broadcasts")
            .on(
              "postgres_changes",
              { event: "INSERT", schema: "public", table: "broadcasts" },
              (payload: any) => {
                const b: BroadcastRow = payload.new;
                // insert at top of list
                setBroadcasts((prev) => [b, ...prev].slice(0, 200));
                // show admin toast & TTS
                try {
                  toast.warn(`Broadcast — ${b.severity ?? ""}: ${b.message}`);
                } catch {}
                try {
                  const utter = new SpeechSynthesisUtterance(b.message);
                  utter.lang = "hi-IN";
                  speechSynthesis.cancel();
                  speechSynthesis.speak(utter);
                } catch {}
              }
            );
          subscriptionBroadcasts = await channelBroadcasts.subscribe();
          if (subscriptionBroadcasts?.error) {
            console.warn("supabase broadcasts subscribe returned error", subscriptionBroadcasts.error);
          }
        } catch (err) {
          console.warn("supabase broadcasts subscription failed:", err);
          try {
            if (channelBroadcasts?.unsubscribe) channelBroadcasts.unsubscribe();
          } catch {}
        }
      })();
    }

    return () => {
      try {
        if (subscriptionCases?.unsubscribe) subscriptionCases.unsubscribe();
      } catch {}
      try {
        if (subscriptionBroadcasts?.unsubscribe) subscriptionBroadcasts.unsubscribe();
      } catch {}
      try {
        if (channelCases?.unsubscribe) channelCases.unsubscribe();
      } catch {}
      try {
        if (channelBroadcasts?.unsubscribe) channelBroadcasts.unsubscribe();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, supabaseClient]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      if (isClient) loadInitial();
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, isClient, supabaseClient]);

  // filter/searched cases
  const filteredCases = useMemo(() => {
    let list = cases;
    if (filter !== "all") list = list.filter((c) => (c.severity ?? "").toLowerCase() === filter);
    if (search && search.trim().length > 0) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.chid ?? "").toLowerCase().includes(s) ||
          (c.summary_hindi ?? "").toLowerCase().includes(s) ||
          (c.symptoms ?? "").toLowerCase().includes(s) ||
          (c.extra?.village ?? "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [cases, filter, search]);

  // counts
  const caseCount = filteredCases.length;
  const riskCount = risks.length;

  // play audio helper
  function playAudio(url?: string | null) {
    if (!url) return;
    try {
      const a = new Audio(url);
      a.play().catch(() => {});
    } catch {}
  }

  // heatmap toggle effect
  useEffect(() => {
    if (!isClient) return;
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (!LHeat) return;
    if (heatLayerRef.current) {
      try {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      } catch {}
    }
    if (heatOn) {
      const pts = filteredCases.map((c) => {
        const lat = c.extra?.lat ?? pseudoLocationFromString(c.chid)[0];
        const lng = c.extra?.lng ?? pseudoLocationFromString(c.chid)[1];
        return [lat, lng, 0.6];
      });
      try {
        heatLayerRef.current = (window as any).L?.heatLayer?.(pts, { radius: 25, blur: 15, maxZoom: 17 });
        if (heatLayerRef.current) heatLayerRef.current.addTo(map);
      } catch (e) {
        console.warn("heat add error", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatOn, isClient, filteredCases]);

  // Build chart data (cases per hour)
  function buildChartData(list: CaseRow[]) {
    const bins: Record<string, number> = {};
    list.forEach((c) => {
      const d = new Date(c.created_at || Date.now());
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:00`;
      bins[key] = (bins[key] || 0) + 1;
    });
    const arr = Object.keys(bins)
      .sort()
      .map((k) => ({ time: k, count: bins[k] }));
    setChartData(arr.slice(-24));
  }

  // Admin tools
  function exportCSV() {
    const rows = filteredCases.map((c) => ({
      chid: c.chid,
      severity: c.severity,
      summary: c.summary_hindi ?? c.symptoms,
      created_at: c.created_at,
    }));
    if (rows.length === 0) {
      toast.info("No cases to export");
      return;
    }
    const csv = [
      Object.keys(rows[0]).join(","),
      ...rows.map((r) => Object.values(r).map((v) => `"${String(v ?? "")}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cases_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearMapView() {
    setCases([]);
    setRisks([]);
    setBroadcasts([]);
    setError(null);
  }

  function jumpToLatest() {
    if (!latestCase) return;
    const lat = latestCase.extra?.lat ?? pseudoLocationFromString(latestCase.chid)[0];
    const lng = latestCase.extra?.lng ?? pseudoLocationFromString(latestCase.chid)[1];
    if (mapRef.current) {
      try {
        mapRef.current.flyTo([lat, lng], 13, { duration: 0.9 });
      } catch {}
    }
  }

  // tile choices
  const tileUrl = tileTheme === "day"
    ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    : "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png";

  // map ready callback to capture map instance
  function onMapCreated(mapInstance: any) {
    mapRef.current = mapInstance;
  }

  // timeline chart dynamic import (Recharts) - render client-only
  const RechartsArea = dynamicChart();

  // helper: dynamic import of Recharts components wrapped to a small component
  function dynamicChart() {
    return function ChartWrapper({ data }: { data: any[] }) {
      const R = require("recharts");
      const { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } = R;
      return (
        <div style={{ width: "100%", height: 140 }}>
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis allowDecimals={false} hide />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#4f46e5', fontSize: '12px', fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    };
  }

  // small helper to pan-to-case from list
  function panToCase(c: CaseRow) {
    const lat = c.extra?.lat ?? pseudoLocationFromString(c.chid)[0];
    const lng = c.extra?.lng ?? pseudoLocationFromString(c.chid)[1];
    if (mapRef.current) {
      try {
        mapRef.current.flyTo([lat, lng], 13, { duration: 0.8 });
      } catch {}
    }
  }

  // UI Components for internal usage
  const StatBadge = ({ label, value, color = "bg-slate-100 text-slate-700" }: { label: string, value: string | number, color?: string }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border border-transparent ${color}`}>
      <span className="opacity-70">{label}</span>
      <span className="font-bold text-sm">{value}</span>
    </div>
  );

  // render
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-rose-100 selection:text-rose-900">
      <ToastContainer position="bottom-right" autoClose={3500} toastClassName="rounded-lg shadow-lg font-sans text-sm" />
      
      {/* *** FIX: Render modal at root level, outside of sticky header *** */}
      <BroadcastModalContent
        open={broadcastModalOpen}
        onClose={() => setBroadcastModalOpen(false)}
        onSent={(b) => {
          setBroadcasts((prev) => [b, ...prev].slice(0, 200));
          toast.success("Broadcast queued/sent.");
          setBroadcastModalOpen(false); // Close on sent
        }}
      />
      
      {/* Floating Header */}
      <header className="sticky top-0 z-[500] bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          
          {/* Brand + Title */}
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-rose-500 to-pink-600 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md shadow-rose-200">
              <span className="text-lg">H</span>
            </div>
            <div className="flex flex-col leading-none">
              <h1 className="text-lg font-bold text-slate-800 tracking-tight">Admin Command Center</h1>
              <div className="text-xs text-slate-500 font-medium mt-1">Real-time Surveillance & Response</div>
            </div>
          </div>

          {/* Center Stats */}
          <div className="hidden md:flex items-center gap-3 bg-slate-50/50 p-1 rounded-full border border-slate-100">
             <StatBadge label="Total Cases" value={caseCount} color="bg-white text-slate-700 shadow-sm border-slate-200" />
             <StatBadge label="Active Risks" value={riskCount} color="bg-white text-slate-700 shadow-sm border-slate-200" />
             <StatBadge label="Broadcasts" value={broadcasts.length} color="bg-white text-slate-700 shadow-sm border-slate-200" />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-rose-500 transition-colors">
                <Icons.Search />
              </div>
              <input 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                placeholder="Search CHID, village..." 
                className="pl-9 pr-8 py-1.5 w-48 text-sm bg-slate-100 border border-transparent rounded-full focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-100 outline-none transition-all placeholder:text-slate-400" 
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600">
                  <Icons.Close />
                </button>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200 mx-1"></div>

            {/* Toggles */}
            <button onClick={() => setAutoRefresh((v) => !v)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${autoRefresh ? "bg-green-50 text-green-700 border border-green-200" : "bg-slate-100 text-slate-500"}`}>
               {autoRefresh && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
               {!autoRefresh && <Icons.Refresh />}
               {autoRefresh ? "Live" : "Paused"}
            </button>

            <div className="flex bg-slate-100 p-1 rounded-lg">
               <button onClick={() => setTileTheme(tileTheme === "day" ? "night" : "day")} className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white hover:shadow-sm rounded transition">
                 {tileTheme === "day" ? "☀️" : "🌙"}
               </button>
               <button onClick={() => setHeatOn((v) => !v)} className={`px-2 py-1 text-xs font-medium rounded transition ${heatOn ? "bg-white shadow-sm text-orange-600" : "text-slate-600 hover:bg-white/50"}`}>
                 🔥
               </button>
               <button onClick={() => setClusterOn((v) => !v)} className={`px-2 py-1 text-xs font-medium rounded transition ${clusterOn ? "bg-white shadow-sm text-indigo-600" : "text-slate-600 hover:bg-white/50"}`}>
                 ●●
               </button>
            </div>

            {/* *** FIX: Replaced modal component with a trigger button *** */}
            <button 
              onClick={() => setBroadcastModalOpen(true)} 
              className="flex items-center gap-2 ml-2 text-sm font-medium px-4 py-2 bg-rose-600 text-white rounded-lg shadow-sm hover:bg-rose-700 hover:shadow-md transition-all active:scale-95"
            >
              <Icons.Broadcast />
              <span>Send Broadcast</span>
            </button>
            
            {/* Admin Menu Dropdown */}
             <details className="relative group">
                <summary className="list-none cursor-pointer">
                  <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center hover:bg-slate-300 transition text-slate-600 font-bold text-xs">AD</div>
                </summary>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-xl p-1 z-[600] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                  <div className="px-3 py-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-50 mb-1">Actions</div>
                  <button onClick={jumpToLatest} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition">📍 Jump to latest case</button>
                  <button onClick={exportCSV} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition">📄 Export Data (CSV)</button>
                  <button onClick={() => setShowPlayLatest((s) => !s)} className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition">{showPlayLatest ? "🔇 Hide Auto-Play" : "🔊 Show Auto-Play"}</button>
                  <div className="h-px bg-slate-100 my-1"></div>
                  <button onClick={clearMapView} className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition">🗑️ Clear Map View</button>
                </div>
              </details>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-120px)] min-h-[600px]">
          
          {/* Left Column: Map (Flexible width) */}
          <div className="lg:col-span-9 flex flex-col gap-4 h-full relative group">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden h-full relative">
              {loading && (
                 <div className="absolute inset-0 z-[400] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-slate-500">
                    <div className="w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <div className="text-sm font-medium">Loading intelligence map...</div>
                 </div>
              )}
              
              {/* Map Container */}
              {isClient ? (
                <MapContainerAny whenCreated={onMapCreated} center={center} zoom={11} style={{ height: "100%", width: "100%" }} className="z-0">
                  <TileLayerAny url={tileUrl} attribution="© OpenStreetMap contributors" />

                  {/* risks unclustered */}
                  {risks.map((r) => (
                    <CircleMarkerAny key={`risk-${r.id}`} center={[r.lat, r.lng]} radius={10} pathOptions={{ color: "#e11d48", fillColor: "#e11d48", fillOpacity: 0.6 }}>
                      <PopupAny>
                        <div className="min-w-[200px] p-1">
                          <div className="font-bold text-rose-700 text-sm border-b pb-1 mb-1 flex justify-between">{r.village} <span className="text-[10px] bg-rose-100 px-1 rounded pt-0.5">{r.risk_score}</span></div>
                          <div className="text-xs font-semibold text-slate-700">Level: {r.risk_level}</div>
                          <div className="text-xs text-slate-600 mt-1 leading-snug">{r.summary}</div>
                          <div className="text-[10px] text-slate-400 mt-2 text-right italic">Updated: {new Date(r.last_updated).toLocaleTimeString()}</div>
                        </div>
                      </PopupAny>
                    </CircleMarkerAny>
                  ))}

                  {/* auto-center (latest case) */}
                  {latestCase && latestCase.extra && latestCase.extra.lat && latestCase.extra.lng && <AutoCenter lat={latestCase.extra.lat} lng={latestCase.extra.lng} />}
                  {latestCase && !(latestCase.extra && latestCase.extra.lat && latestCase.extra.lng) && <AutoCenter lat={pseudoLocationFromString(latestCase.chid)[0]} lng={pseudoLocationFromString(latestCase.chid)[1]} />}

                  {/* broadcasts */}
                  {broadcasts.map((b) => {
                    const hasGeo = typeof b.lat === "number" && typeof b.lng === "number";
                    const lat = hasGeo ? (b.lat as number) : null;
                    const lng = hasGeo ? (b.lng as number) : null;
                    const color = b.severity === "zyaada" ? "#ef4444" : b.severity === "madhyam" ? "#f59e0b" : "#2563eb";
                    return (
                      <React.Fragment key={`bc-${b.id}`}>
                        {hasGeo && (
                          <>
                            <CircleMarkerAny center={[lat!, lng!]} radius={10} pathOptions={{ color, fillColor: color, fillOpacity: 0.7 }}>
                              <PopupAny>
                                <div className="min-w-[200px]">
                                  <div className="font-bold text-sm mb-1">📢 Broadcast ({b.severity})</div>
                                  <div className="text-sm bg-slate-50 p-2 rounded border">{b.message}</div>
                                  <div className="text-[10px] text-slate-400 mt-1">{new Date(b.created_at || Date.now()).toLocaleString()}</div>
                                </div>
                              </PopupAny>
                            </CircleMarkerAny>
                            {b.radius_meters ? (
                              <CircleAny center={[lat!, lng!]} radius={b.radius_meters} pathOptions={{ color: color, fillColor: color, fillOpacity: 0.08 }} />
                            ) : null}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* cases */}
                  {clusterOn ? (
                    <MarkerClusterGroupAny>
                      {filteredCases.map((c) => {
                        const lat = c.extra?.lat ?? pseudoLocationFromString(c.chid)[0];
                        const lng = c.extra?.lng ?? pseudoLocationFromString(c.chid)[1];
                        const audio = audioUrlFor(c.audio_path ?? null);
                        const color = c.severity === "zyaada" ? "#ef4444" : c.severity === "madhyam" ? "#f59e0b" : "#2563eb";
                        return (
                          <CircleMarkerAny key={`case-${c.id}`} center={[lat, lng]} radius={8} pathOptions={{ color, fillColor: color, fillOpacity: 0.95 }}>
                            <PopupAny>
                              <div className="min-w-[240px] p-1">
                                <div className="flex justify-between items-center border-b pb-2 mb-2">
                                    <span className="font-bold text-indigo-700">{c.chid}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full text-white uppercase font-bold ${c.severity === "zyaada" ? "bg-red-500" : c.severity === "madhyam" ? "bg-amber-500" : "bg-blue-500"}`}>{c.severity ?? "N/A"}</span>
                                </div>
                                <div className="text-sm text-slate-700 mb-2">{c.summary_hindi ?? c.symptoms}</div>
                                {audio && <div className="mt-2 bg-slate-100 p-2 rounded"><audio className="w-full h-6" controls src={audio} /></div>}
                              </div>
                            </PopupAny>
                          </CircleMarkerAny>
                        );
                      })}
                    </MarkerClusterGroupAny>
                  ) : (
                    filteredCases.map((c) => {
                        const lat = c.extra?.lat ?? pseudoLocationFromString(c.chid)[0];
                        const lng = c.extra?.lng ?? pseudoLocationFromString(c.chid)[1];
                        const audio = audioUrlFor(c.audio_path ?? null);
                        const color = c.severity === "zyaada" ? "#ef4444" : c.severity === "madhyam" ? "#f59e0b" : "#2563eb";
                        return (
                          <CircleMarkerAny key={`case-${c.id}`} center={[lat, lng]} radius={6} pathOptions={{ color, fillColor: color, fillOpacity: 0.8 }}>
                            <PopupAny>
                               <div className="min-w-[240px] p-1">
                                <div className="flex justify-between items-center border-b pb-2 mb-2">
                                    <span className="font-bold text-indigo-700">{c.chid}</span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full text-white uppercase font-bold ${c.severity === "zyaada" ? "bg-red-500" : c.severity === "madhyam" ? "bg-amber-500" : "bg-blue-500"}`}>{c.severity ?? "N/A"}</span>
                                </div>
                                <div className="text-sm text-slate-700 mb-2">{c.summary_hindi ?? c.symptoms}</div>
                                {audio && <div className="mt-2 bg-slate-100 p-2 rounded"><audio className="w-full h-6" controls src={audio} /></div>}
                              </div>
                            </PopupAny>
                          </CircleMarkerAny>
                        );
                      })
                  )}
                </MapContainerAny>
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400 bg-slate-100">Map is initializing...</div>
              )}

              {/* floating play latest */}
              {showPlayLatest && latestCase?.audio_path && (
                <div className="absolute right-6 bottom-8 z-[400] animate-in slide-in-from-bottom-4 duration-500">
                  <button onClick={() => playAudio(audioUrlFor(latestCase.audio_path))} className="pl-4 pr-5 py-3 bg-emerald-600 text-white rounded-full shadow-xl hover:bg-emerald-700 hover:scale-105 transition-all flex items-center gap-2 ring-4 ring-emerald-600/20">
                    <div className="bg-white text-emerald-600 rounded-full p-1"><Icons.Play /></div>
                    <span className="font-semibold text-sm">Play Latest Incoming</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Sidebar/Feed (Fixed width) */}
          <aside className="lg:col-span-3 flex flex-col gap-4 h-full overflow-hidden">
            
            {/* Chart Widget */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Trend (24h)</h3>
                 <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500">Live</span>
              </div>
              {isClient && <RechartsArea data={chartData} />}
            </div>

            {/* Legend */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 flex-shrink-0">
              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                 <div className="flex items-center bg-slate-50 px-2 py-1 rounded border border-slate-100"><span className="w-2 h-2 rounded-full bg-[#2563eb] mr-1.5"></span> Low</div>
                 <div className="flex items-center bg-slate-50 px-2 py-1 rounded border border-slate-100"><span className="w-2 h-2 rounded-full bg-[#f59e0b] mr-1.5"></span> Medium</div>
                 <div className="flex items-center bg-slate-50 px-2 py-1 rounded border border-slate-100"><span className="w-2 h-2 rounded-full bg-[#ef4444] mr-1.5"></span> High</div>
                 <div className="flex items-center bg-slate-50 px-2 py-1 rounded border border-slate-100"><span className="w-2 h-2 rounded-full bg-[#e11d48] mr-1.5"></span> Risk Zone</div>
                 <div className="flex items-center bg-slate-50 px-2 py-1 rounded border border-slate-100"><span className="w-2 h-2 rounded-full bg-[#9b5cff] mr-1.5"></span> Broadcast</div>
              </div>
            </div>

            {/* Tabbed Feeds Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 overflow-hidden flex flex-col min-h-0">
               
               {/* Section: Broadcasts */}
               <div className="flex-shrink-0 p-4 pb-0 border-b border-slate-100 bg-slate-50/50">
                 <h4 className="font-bold text-sm text-slate-700 mb-2 flex items-center gap-2"><span className="text-rose-500">📢</span> Recent Broadcasts</h4>
                 <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 mb-3 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {broadcasts.length === 0 && <div className="text-xs text-slate-400 text-center py-4 italic">No active broadcasts</div>}
                    {broadcasts.map((b) => (
                      <div key={b.id} className={`p-2.5 rounded-lg border text-xs relative pl-3 ${b.severity === "zyaada" ? "border-rose-200 bg-rose-50/50" : b.severity === "madhyam" ? "border-amber-200 bg-amber-50/50" : "border-blue-200 bg-blue-50/50"}`}>
                         <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-r ${b.severity === "zyaada" ? "bg-rose-400" : b.severity === "madhyam" ? "bg-amber-400" : "bg-blue-400"}`}></div>
                         <div className="flex justify-between items-start mb-1">
                           <span className="font-bold uppercase opacity-80 text-[10px]">{b.severity ?? "Info"}</span>
                           <span className="text-[10px] text-slate-400">{new Date(b.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                         </div>
                         <div className="text-slate-800 leading-snug font-medium">{b.message}</div>
                      </div>
                    ))}
                 </div>
               </div>

               {/* Section: Cases */}
               <div className="flex-1 flex flex-col min-h-0 p-4 pt-3 bg-white">
                 <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><span className="text-indigo-500">📋</span> Incoming Cases</h4>
                 <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {cases.length === 0 && <div className="text-sm text-slate-400 text-center py-10">Waiting for incoming cases...</div>}
                    {cases.map((c) => (
                      <button 
                        key={c.id} 
                        onClick={() => panToCase(c)} 
                        className="w-full text-left p-3 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 transition-all group relative overflow-hidden"
                      >
                        {/* Severity Indicator Bar */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${c.severity === "zyaada" ? "bg-rose-500" : c.severity === "madhyam" ? "bg-amber-400" : "bg-blue-400"}`}></div>
                        
                        <div className="pl-2">
                           <div className="flex justify-between items-start mb-1">
                             <span className="font-mono font-bold text-xs text-slate-500 group-hover:text-indigo-600 transition-colors">{c.chid}</span>
                             <span className="text-[10px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{new Date(c.created_at || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                           </div>
                           <div className="text-sm font-medium text-slate-800 line-clamp-2 leading-relaxed">{c.summary_hindi ?? c.symptoms}</div>
                           {c.audio_path && <div className="mt-2 flex items-center gap-1 text-[10px] text-indigo-500 font-semibold"><Icons.Play /> <span>Audio available</span></div>}
                        </div>
                      </button>
                    ))}
                 </div>
               </div>

            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}