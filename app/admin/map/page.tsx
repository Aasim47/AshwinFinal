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

// BroadcastModal component (paste into admin page file, above default export or inside it but before return)
function BroadcastModal({ onSent }: { onSent?: (b: any) => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"kam" | "madhyam" | "zyaada">("madhyam");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [radius, setRadius] = useState<number | "">("");

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
      setMessage("");
      setLat("");
      setLng("");
      setRadius("");
      setSeverity("madhyam");
      setOpen(false);
      alert("Broadcast sent.");
      if (onSent) onSent(json.broadcast || json);
    } catch (e: any) {
      console.error("broadcast error", e);
      alert("Broadcast failed: " + e?.message || e);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="ml-2 text-sm px-3 py-1 bg-rose-600 text-white rounded">Send Broadcast</button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded p-4 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Emergency Broadcast</h3>

            <div className="space-y-2">
              <textarea value={message} onChange={(e)=>setMessage(e.target.value)} placeholder="Enter broadcast message (Hindi/English)" className="w-full border rounded p-2" rows={4} />
              <div className="flex gap-2">
                <label className="text-xs">Severity</label>
                <select value={severity} onChange={(e)=> setSeverity(e.target.value as any)} className="ml-2 border rounded px-2 py-1 text-sm">
                  <option value="kam">Low</option>
                  <option value="madhyam">Medium</option>
                  <option value="zyaada">High</option>
                </select>
              </div>

              <div className="text-xs text-slate-600">Optional geofence (center + radius in meters). Leave blank to broadcast to all.</div>
              <div className="grid grid-cols-3 gap-2">
                <input value={lat} onChange={(e)=>setLat(e.target.value)} placeholder="lat" className="border rounded px-2 py-1 text-sm" />
                <input value={lng} onChange={(e)=>setLng(e.target.value)} placeholder="lng" className="border rounded px-2 py-1 text-sm" />
                <input value={radius as any} onChange={(e)=>setRadius(e.target.value === "" ? "" : Number(e.target.value))} placeholder="radius (m)" className="border rounded px-2 py-1 text-sm" />
              </div>

              <div className="flex gap-2 justify-end mt-3">
                <button onClick={() => setOpen(false)} className="px-3 py-1 border rounded">Cancel</button>
                <button onClick={sendBroadcast} className="px-3 py-1 bg-rose-600 text-white rounded">Send</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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
    const csv = [
      Object.keys(rows[0] || {}).join(","),
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
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#8884d8" fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      );
    };
  }

  // render
  return (
    <div className="min-h-screen p-4 bg-slate-50">
      <ToastContainer position="top-right" autoClose={3500} />
      <div className="max-w-6xl mx-auto">
        {/* error */}
        {error && <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-100">{error}</div>}

        <header className="flex items-center gap-4 mb-4">
          <h1 className="text-2xl font-semibold">Admin — Live Map (Pro)</h1>
          <div className="text-sm text-slate-600">Realtime cases + risk simulation</div>

          <div className="ml-4 text-xs text-slate-600">Cases: <strong>{caseCount}</strong> | Risks: <strong>{riskCount}</strong> | Broadcasts: <strong>{broadcasts.length}</strong></div>

          {/* filter */}
          <div className="ml-4">
            <label className="text-xs text-slate-600 mr-2">Filter:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="text-sm border rounded px-2 py-1">
              <option value="all">All</option>
              <option value="kam">Low</option>
              <option value="madhyam">Medium</option>
              <option value="zyaada">High</option>
            </select>
          </div>

          {/* search */}
          <div className="ml-4 flex items-center">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search CHID/village/notes" className="text-sm border px-2 py-1 rounded" />
            <button onClick={() => { setSearch(""); }} className="ml-2 text-xs px-2 py-1 border rounded">Clear</button>
          </div>

          {/* auto refresh */}
          <button onClick={() => setAutoRefresh((v) => !v)} className={`ml-4 text-sm px-3 py-1 rounded ${autoRefresh ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
            {autoRefresh ? "Stop Auto Refresh" : "Start Auto Refresh"}
          </button>

          {/* tile theme */}
          <button onClick={() => setTileTheme(tileTheme === "day" ? "night" : "day")} className="ml-4 text-sm px-3 py-1 border rounded">
            Theme: {tileTheme}
          </button>

          {/* heat toggle */}
          <button onClick={() => setHeatOn((v) => !v)} className={`ml-4 text-sm px-3 py-1 rounded ${heatOn ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-700"}`}>
            {heatOn ? "Hide Heatmap" : "Show Heatmap"}
          </button>

          {/* clustering toggle */}
          <button onClick={() => setClusterOn((v) => !v)} className="ml-4 text-sm px-3 py-1 border rounded">
            Clustering: {clusterOn ? "On" : "Off"}
          </button>

          {/* Send Broadcast Button */}
          <BroadcastModal onSent={(b) => {
            // push broadcast locally so admin sees it immediately
            setBroadcasts((prev) => [b, ...prev].slice(0, 200));
            toast.success("Broadcast queued/sent.");
          }} />

          {/* admin dropdown */}
          <div className="ml-auto relative">
            <details className="relative">
              <summary className="cursor-pointer px-3 py-1 border rounded">Admin</summary>
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow p-2 z-40">
                <button onClick={clearMapView} className="w-full text-left px-2 py-1 text-sm">Clear map view</button>
                <button onClick={exportCSV} className="w-full text-left px-2 py-1 text-sm">Export CSV</button>
                <button onClick={jumpToLatest} className="w-full text-left px-2 py-1 text-sm">Jump to latest</button>
                <button onClick={() => setShowPlayLatest((s) => !s)} className="w-full text-left px-2 py-1 text-sm">{showPlayLatest ? "Hide Play Button" : "Show Play Button"}</button>
              </div>
            </details>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white rounded shadow p-2 relative">
            {loading && <div className="absolute z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/80 p-3 rounded shadow">Loading map data…</div>}

            {/* map */}
            {isClient ? (
              <MapContainerAny whenCreated={onMapCreated} center={center} zoom={11} style={{ height: 600, width: "100%" }}>
                <TileLayerAny url={tileUrl} attribution="© OpenStreetMap contributors" />

                {/* risks unclustered */}
                {risks.map((r) => (
                  <CircleMarkerAny key={`risk-${r.id}`} center={[r.lat, r.lng]} radius={8} pathOptions={{ color: "#e11d48", fillColor: "#e11d48", fillOpacity: 0.6 }}>
                    <PopupAny>
                      <div className="max-w-xs">
                        <div className="font-semibold">{r.village}</div>
                        <div className="text-sm">Risk: {r.risk_level} ({r.risk_score})</div>
                        <div className="text-xs mt-2">{r.summary}</div>
                        <div className="text-xs text-slate-400 mt-2">Updated: {new Date(r.last_updated).toLocaleString()}</div>
                      </div>
                    </PopupAny>
                  </CircleMarkerAny>
                ))}

                {/* auto-center (latest case) */}
                {latestCase && latestCase.extra && latestCase.extra.lat && latestCase.extra.lng && <AutoCenter lat={latestCase.extra.lat} lng={latestCase.extra.lng} />}
                {latestCase && !(latestCase.extra && latestCase.extra.lat && latestCase.extra.lng) && <AutoCenter lat={pseudoLocationFromString(latestCase.chid)[0]} lng={pseudoLocationFromString(latestCase.chid)[1]} />}

                {/* broadcasts on map: center marker + optional radius */}
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
                              <div className="max-w-xs">
                                <div className="font-semibold">Broadcast ({b.severity ?? "-"})</div>
                                <div className="text-sm mt-1">{b.message}</div>
                                <div className="text-xs text-slate-500 mt-2">{new Date(b.created_at || Date.now()).toLocaleString()}</div>
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

                {/* clustered or raw case markers */}
                {clusterOn ? (
                  <MarkerClusterGroupAny>
                    {filteredCases.map((c) => {
                      const lat = c.extra?.lat ?? pseudoLocationFromString(c.chid)[0];
                      const lng = c.extra?.lng ?? pseudoLocationFromString(c.chid)[1];
                      const audio = audioUrlFor(c.audio_path ?? null);
                      const color = c.severity === "zyaada" ? "#ef4444" : c.severity === "madhyam" ? "#f59e0b" : "#2563eb";
                      return (
                        <CircleMarkerAny key={`case-${c.id}`} center={[lat, lng]} radius={7} pathOptions={{ color, fillColor: color, fillOpacity: 0.9 }}>
                          <PopupAny>
                            <div className="max-w-xs">
                              <div className="font-semibold">CHID: {c.chid}</div>
                              <div className="text-sm mt-1">{c.summary_hindi ?? c.symptoms}</div>
                              <div className="text-xs text-slate-500 mt-2">Severity: {c.severity ?? "-"}</div>
                              {audio && <div className="mt-2"><audio controls src={audio} /><div className="mt-1"><a className="text-sm text-indigo-600" href={audio} target="_blank" rel="noreferrer">Open audio</a></div></div>}
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
                          <div className="max-w-xs">
                            <div className="font-semibold">CHID: {c.chid}</div>
                            <div className="text-sm mt-1">{c.summary_hindi ?? c.symptoms}</div>
                            <div className="text-xs text-slate-500 mt-2">Severity: {c.severity ?? "-"}</div>
                            {audio && <div className="mt-2"><audio controls src={audio} /><div className="mt-1"><a className="text-sm text-indigo-600" href={audio} target="_blank" rel="noreferrer">Open audio</a></div></div>}
                          </div>
                        </PopupAny>
                      </CircleMarkerAny>
                    );
                  })
                )}
              </MapContainerAny>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">Loading map…</div>
            )}
          </div>

          <aside className="bg-white rounded shadow p-4">
            <h3 className="font-semibold mb-2">Legend</h3>
            <ul className="text-sm space-y-2">
              <li><span className="inline-block w-3 h-3 bg-[#2563eb] mr-2 align-middle rounded-full" /> Low</li>
              <li><span className="inline-block w-3 h-3 bg-[#f59e0b] mr-2 align-middle rounded-full" /> Medium</li>
              <li><span className="inline-block w-3 h-3 bg-[#ef4444] mr-2 align-middle rounded-full" /> High</li>
              <li><span className="inline-block w-3 h-3 bg-[#e11d48] mr-2 align-middle rounded-full" /> Risk</li>
              <li><span className="inline-block w-3 h-3 bg-[#9b5cff] mr-2 align-middle rounded-full" /> Broadcast (geo)</li>
            </ul>

            <div className="mt-4">
              <h4 className="font-medium">Latest broadcasts</h4>
              <div className="mt-2 space-y-2 max-h-[160px] overflow-auto text-sm">
                {broadcasts.length === 0 && <div className="text-slate-500">No broadcasts yet</div>}
                {broadcasts.map((b) => (
                  <div key={b.id} className={`p-2 rounded border ${b.severity === "zyaada" ? "border-red-500 bg-red-50" : b.severity === "madhyam" ? "border-yellow-500 bg-yellow-50" : "border-slate-300"}`}>
                    <div className="font-medium">{b.severity ?? "—"} <span className="text-xs text-slate-500 ml-2">{new Date(b.created_at || Date.now()).toLocaleString()}</span></div>
                    <div className="text-xs text-slate-700 mt-1">{b.message}</div>
                    {b.lat && b.lng && <div className="text-xs text-slate-500 mt-1">Geo: {b.lat.toFixed(4)},{b.lng.toFixed(4)} {b.radius_meters ? ` | r=${b.radius_meters}m` : ""}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-medium mb-2">Latest cases</h4>
              <div className="mt-2 space-y-2 max-h-[360px] overflow-auto text-sm">
                {cases.length === 0 && <div className="text-slate-500">No cases yet</div>}
                {cases.map((c) => (
                  <div key={c.id} className={`p-2 rounded border ${c.severity === "zyaada" ? "border-red-500 bg-red-50" : c.severity === "madhyam" ? "border-yellow-500 bg-yellow-50" : "border-slate-300"}`}>
                    <div className="font-medium">{c.chid}</div>
                    <div className="text-xs text-slate-600">{c.summary_hindi ?? c.symptoms}</div>
                    <div className="text-xs text-slate-500">{new Date(c.created_at || Date.now()).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <h4 className="font-medium mb-2">Cases (last 24 bins)</h4>
              <div>
                {/* Chart renders only on client */}
                {isClient && <RechartsArea data={chartData} />}
              </div>
            </div>
          </aside>
        </div>

        {/* floating play latest */}
        {showPlayLatest && latestCase?.audio_path && (
          <div className="fixed right-6 bottom-6 z-50">
            <button onClick={() => playAudio(audioUrlFor(latestCase.audio_path))} className="px-4 py-2 bg-emerald-600 text-white rounded shadow-lg hover:bg-emerald-700">Play latest audio</button>
          </div>
        )}
      </div>
    </div>
  );
}
