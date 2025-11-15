// app/doctor/dashboard/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

// --- SVG Icons for UI Enhancement ---
const Icons = {
  Refresh: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
  Search: () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Close: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
  ChevronDown: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>,
  Inbox: () => <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0l-2.165 3.109a.5.5 0 01-.75.148L15 15.211l-2.165 2.108a.5.5 0 01-.75.148L10 15.211l-2.165 2.108a.5.5 0 01-.75.148L5 13m15 0a2 2 0 012 2v3a2 2 0 01-2 2H4a2 2 0 01-2-2v-3a2 2 0 012-2h16z" /></svg>,
  Note: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  UserPlus: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  CheckCircle: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

type CaseRow = {
  id: string;
  chid: string;
  patient_id?: string;
  summary_hindi?: string;
  symptoms?: string;
  severity?: string | null;
  audio_path?: string | null;
  photo_path?: string | null;
  extra?: any;
  created_at?: string | null;
  assigned_to?: string | null;
  status?: string | null;
};

type CaseNote = {
  id: string;
  case_id: string;
  author?: string | null;
  note: string;
  created_at?: string | null;
};

// --- FIX: Moved components outside of DoctorDashboardPage ---
// Reusable Form Components
const FormLabel = ({ children, htmlFor }: { children: React.ReactNode, htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
    {children}
  </label>
);

const FormInput = ({ ...props }) => (
  <input
    {...props}
    className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition"
  />
);

const FormSelect = ({ children, ...props }: { children: React.ReactNode, [key: string]: any }) => (
  <div className="relative">
    <select
      {...props}
      className="appearance-none block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition pr-8"
    >
      {children}
    </select>
    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
      <Icons.ChevronDown />
    </div>
  </div>
);

const FormTextarea = ({ ...props }) => (
  <textarea
    {...props}
    className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition"
  />
);
// --- End of moved components ---


export default function DoctorDashboardPage() {
  const [supabaseClient, setSupabaseClient] = useState<any | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [filter, setFilter] = useState<"all" | "kam" | "madhyam" | "zyaada">("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "New" | "Doctor Assigned" | "Under Followup" | "Escalated" | "Treated"
  >("all");
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null);
  const [noteText, setNoteText] = useState("");
  const [assignTo, setAssignTo] = useState("");

  // NEW: notes state for past diagnoses / notes
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // create supabase client on client only
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
        if (!url || !anon) {
          console.warn("Supabase env not set for doctor page.");
          setError("Supabase not configured (client).");
          return;
        }
        const client = createClient(url, anon);
        if (!cancelled) setSupabaseClient(client);
      } catch (e: any) {
        console.error("Failed to init supabase client", e);
        setError("Failed to initialize Supabase client.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // load cases
  async function loadCases() {
    if (!supabaseClient) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: supaErr } = await supabaseClient
        .from("cases")
        .select(
          "id, chid, patient_id, summary_hindi, symptoms, severity, audio_path, photo_path, extra, created_at, assigned_to, status"
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (supaErr) {
        console.error("supabase fetch error", supaErr);
        setError("Failed to fetch cases.");
      } else {
        setCases(data || []);
      }
    } catch (e: any) {
      console.error("loadCases error", e);
      setError("Network error while loading cases.");
    } finally {
      setLoading(false);
    }
  }

  // subscribe to realtime INSERTs for instant updates
  useEffect(() => {
    if (!supabaseClient) return;
    let channel: any = null;
    let subscription: any = null;
    (async () => {
      try {
        channel = supabaseClient
          .channel("public:cases")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "cases" },
            (payload: any) => {
              const newRow = payload.new as CaseRow;
              setCases((prev) => [newRow, ...prev]);
            }
          );
        subscription = await channel.subscribe();
        if (subscription?.error) console.warn("supabase subscribe error", subscription.error);
      } catch (err) {
        console.warn("subscribe exception", err);
      }
    })();

    return () => {
      try {
        if (subscription?.unsubscribe) subscription.unsubscribe();
        else if (channel?.unsubscribe) channel.unsubscribe();
      } catch { }
    };
  }, [supabaseClient]);

  // initial load when client ready
  useEffect(() => {
    if (supabaseClient) loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabaseClient]);

  // NEW: load notes for a case (past diagnoses / doctor notes)
  async function loadNotes(caseId?: string | null) {
    if (!supabaseClient) return;
    if (!caseId) {
      setNotes([]);
      return;
    }
    setNotesLoading(true);
    try {
      // try to read from 'case_notes' table; fallback to 'case_events' if needed
      const { data, error: notesErr } = await supabaseClient
        .from("case_notes")
        .select("id, case_id, author, note, created_at")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (notesErr) {
        // If notes table doesn't exist, attempt reading from 'case_events' where event_type=note
        console.warn("case_notes fetch error, attempting case_events", notesErr);
        const { data: evData, error: evErr } = await supabaseClient
          .from("case_events")
          .select("id, case_id, event_type, meta, created_at")
          .eq("case_id", caseId)
          .eq("event_type", "note")
          .order("created_at", { ascending: false })
          .limit(200);

        if (evErr) {
          console.error("case_events fallback error", evErr);
          setNotes([]);
        } else if (evData) {
          // try to map events to notes
          const mapped = evData.map((ev: any) => ({
            id: ev.id,
            case_id: ev.case_id,
            author: ev.meta?.by ?? ev.meta?.author ?? "system",
            note: ev.meta?.note ?? JSON.stringify(ev.meta ?? {}),
            created_at: ev.created_at,
          }));
          setNotes(mapped);
        } else {
          setNotes([]);
        }
      } else if (data) {
        setNotes(data as CaseNote[]);
      } else {
        setNotes([]);
      }
    } catch (e: any) {
      console.error("loadNotes error", e);
      setNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }

  // when selectedCase changes, load its notes
  useEffect(() => {
    loadNotes(selectedCase?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCase]);

  // filtered list
  const filtered = useMemo(() => {
    let list = cases;
    if (filter !== "all") {
      list = list.filter((c) => (c.severity ?? "").toLowerCase() === filter);
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => (c.status ?? "New") === statusFilter);
    }
    if (search.trim()) {
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
  }, [cases, filter, statusFilter, search]);

  // action helpers: add note, assign, update status, close
  async function addNote() {
    if (!selectedCase) return alert("Select case first");
    if (!noteText.trim()) return alert("Enter note");
    try {
      const res = await fetch("/api/doctor/add-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: selectedCase.id,
          author: "doctor", // replace with auth identity if available
          note: noteText.trim(),
          followup_ts: null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        console.error("add-note failed", json);
        alert("Failed to save note");
        return;
      }
      setNoteText("");
      alert("Note saved.");
      // refresh notes for this case immediately
      await loadNotes(selectedCase.id);
      // optionally refresh case list
      loadCases();
    } catch (e: any) {
      console.error("addNote error", e);
      alert("Network error saving note");
    }
  }

  async function assignCase() {
    if (!selectedCase) return alert("Select case first");
    if (!assignTo.trim()) return alert("Enter assignee");
    try {
      const res = await fetch("/api/doctor/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: selectedCase.id,
          assignee: assignTo.trim(),
          role: "phc",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        console.error("assign failed", json);
        alert("Assign failed");
        return;
      }
      alert("Assigned.");
      setAssignTo("");
      // optimistic update: set assigned_to locally
      setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? { ...c, assigned_to: assignTo } : c)));
      loadCases();
    } catch (e: any) {
      console.error("assignCase error", e);
      alert("Network error assigning");
    }
  }

  async function updateStatus(caseId: string, status: string, note?: string) {
    try {
      const res = await fetch("/api/doctor/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, status, author: "doctor", note }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        console.error("update-status failed", json);
        alert("Failed to update status");
        return false;
      }
      // refresh local
      loadCases();
      return true;
    } catch (e: any) {
      console.error("updateStatus error", e);
      alert("Network error updating status");
      return false;
    }
  }

  async function closeCase() {
    if (!selectedCase) return alert("Select case first");
    const ok = confirm("Mark this case as Treated/Closed?");
    if (!ok) return;
    try {
      // prefer calling the close-case wrapper (which sets Treated)
      const res = await fetch("/api/doctor/close-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: selectedCase.id, author: "doctor" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        console.error("close-case failed", json);
        alert("Close failed");
        return;
      }
      alert("Case marked Treated.");
      loadCases();
      // refresh notes and selected case after close
      if (selectedCase?.id) {
        await loadNotes(selectedCase.id);
      }
    } catch (e: any) {
      console.error("closeCase error", e);
      alert("Network error closing");
    }
  }

  // helper for pretty status badge
  function statusBadge(s?: string | null) {
    const st = s ?? "New";
    if (st === "Treated") return <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-green-100 text-green-800 font-medium">{st}</span>;
    if (st === "Doctor Assigned") return <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">{st}</span>;
    if (st === "Under Followup") return <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">{st}</span>;
    if (st === "Escalated") return <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-medium">{st}</span>;
    return <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">{st}</span>;
  }

  // helper for severity pill
  function severityPill(sev?: string | null) {
    const s = (sev ?? "").toLowerCase();
    if (s === "zyaada") return <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-red-100 text-red-700">High</span>;
    if (s === "madhyam") return <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">Medium</span>;
    if (s === "kam") return <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700">Low</span>;
    return <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">-</span>;
  }

  // helper for date formatting
  function formatDate(dateString?: string | null) {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      // check if it's today
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      // check if it was yesterday
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
      }
      // otherwise, show date
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return "";
    }
  }

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 lg:px-8">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between h-16">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Doctor Dashboard</h1>
            <p className="mt-0.5 text-xs text-slate-500">Triage, review, and manage incoming patient cases.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-slate-500">Total Cases</div>
              <div className="text-lg font-bold text-indigo-600">{cases.length}</div>
            </div>

            <button
              onClick={() => loadCases()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <Icons.Refresh />
              )}
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {error && (
         <div className="max-w-screen-2xl mx-auto p-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">{error}</div>
         </div>
      )}

      {/* --- TWO-COLUMN LAYOUT --- */}
      <div className="max-w-screen-2xl mx-auto flex h-[calc(100vh-65px)]">
        
        {/* --- LEFT: Cases list --- */}
        <aside className="w-full max-w-sm xl:max-w-md 2xl:max-w-lg border-r border-slate-200 bg-white flex flex-col">
          
          {/* Filters */}
          <div className="p-4 space-y-3 border-b border-slate-200 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Icons.Search />
              </div>
              <FormInput
                value={search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
                placeholder="Search CHID, symptoms, village..."
                className="pl-9"
              />
              {search && (
                 <button
                   onClick={() => setSearch("")}
                   title="Clear"
                   className="absolute inset-y-0 right-0 p-2 text-slate-400 hover:text-slate-600"
                 >
                   <Icons.Close />
                 </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormSelect
                value={filter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value as any)}
                title="Severity filter"
              >
                <option value="all">All Severities</option>
                <option value="kam">Low</option>
                <option value="madhyam">Medium</option>
                <option value="zyaada">High</option>
              </FormSelect>

              <FormSelect
                value={statusFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value as any)}
                title="Status filter"
              >
                <option value="all">All Statuses</option>
                <option value="New">New</option>
                <option value="Doctor Assigned">Assigned</option>
                <option value="Under Followup">Followup</option>
                <option value="Escalated">Escalated</option>
                <option value="Treated">Treated</option>
              </FormSelect>
            </div>
          </div>
          
          {/* Case List */}
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="text-sm text-slate-500 p-4 text-center">Loading cases...</div>}
            {!loading && filtered.length === 0 && <div className="text-sm text-slate-500 p-6 text-center">No cases found matching filters.</div>}

            <nav className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCase(c)}
                  className={`p-4 cursor-pointer hover:bg-indigo-50 transition relative ${selectedCase?.id === c.id ? "bg-indigo-50" : "bg-white"}`}
                >
                  {/* Selected Indicator */}
                  {selectedCase?.id === c.id && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600 rounded-r-full"></div>}
                  
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-800 truncate">{c.chid}</div>
                    <div className="text-xs text-slate-400 flex-shrink-0">{formatDate(c.created_at)}</div>
                  </div>
                  
                  <div className="mt-1 text-sm text-slate-600 truncate">{c.summary_hindi ?? c.symptoms ?? "No summary"}</div>

                  <div className="mt-2.5 flex items-center justify-between">
                    {severityPill(c.severity)}
                    {statusBadge(c.status)}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* --- RIGHT: Details / actions --- */}
        <main className="flex-1 bg-slate-50 overflow-y-auto p-6 lg:p-8">
          
          {!selectedCase && (
            <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
              <Icons.Inbox />
              <h3 className="mt-4 text-lg font-semibold text-slate-700">No Case Selected</h3>
              <p className="max-w-xs mt-1 text-sm">Select a case from the list on the left to view details, add notes, and manage the case.</p>
            </div>
          )}

          {selectedCase && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Case Header */}
              <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-slate-900">{selectedCase.chid}</h2>
                  {statusBadge(selectedCase.status)}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {severityPill(selectedCase.severity)}
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-500">{selectedCase.created_at ? new Date(selectedCase.created_at).toLocaleString() : ""}</span>
                </div>

                <div className="mt-4 text-base text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {selectedCase.summary_hindi ?? selectedCase.symptoms}
                </div>
                
                <div className="mt-3 text-sm text-slate-500">
                  {selectedCase.assigned_to ? `Assigned to: ${selectedCase.assigned_to}` : "Unassigned"}
                </div>
              </section>
              
              {/* Media Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedCase.audio_path && (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    <FormLabel>Patient Audio</FormLabel>
                    <audio controls src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${selectedCase.audio_path}`} className="w-full mt-2" />
                  </div>
                )}
                {selectedCase.photo_path && (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    <FormLabel>Attached Photo</FormLabel>
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${selectedCase.photo_path}`}
                      alt="patient"
                      className="mt-2 max-h-80 w-full object-contain rounded-lg bg-slate-100"
                    />
                  </div>
                )}
              </div>
              
              {/* Action Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Add Note Card */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                  <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                    <Icons.Note />
                    <h3 className="text-sm font-semibold text-slate-700">Add Diagnosis or Note</h3>
                  </div>
                  <div className="p-4 space-y-3">
                    <FormLabel htmlFor="noteText">Note</FormLabel>
                    <FormTextarea id="noteText" value={noteText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNoteText(e.target.value)} rows={4} placeholder="Enter diagnosis, prescription, or followup notes..." />
                    <button onClick={addNote} className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition active:scale-95">
                      Save Note
                    </button>
                  </div>
                </div>

                {/* Manage Case Card */}
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                      <Icons.UserPlus />
                      <h3 className="text-sm font-semibold text-slate-700">Manage Case</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <FormLabel htmlFor="assignTo">Assign to PHC / Doctor</FormLabel>
                        <div className="flex gap-2">
                          <FormInput id="assignTo" value={assignTo} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAssignTo(e.target.value)} placeholder="e.g. phc_dhampur@gov.in" />
                          <button onClick={assignCase} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition active:scale-95">
                            Assign
                          </button>
                        </div>
                      </div>
                      <div>
                        <FormLabel htmlFor="setStatus">Set Status</FormLabel>
                        <FormSelect
                          id="setStatus"
                          value={selectedCase.status ?? "New"}
                          onChange={async (e: React.ChangeEvent<HTMLSelectElement>) => {
                            const newStatus = e.target.value;
                            const ok = await updateStatus(selectedCase.id, newStatus);
                            if (ok) {
                              setSelectedCase((s) => (s ? { ...s, status: newStatus } : s));
                            }
                          }}
                        >
                          <option value="New">New</option>
                          <option value="Doctor Assigned">Doctor Assigned</option>
                          <option value="Under Followup">Under Followup</option>
                          <option value="Escalated">Escalated</option>
                          <option value="Treated">Treated</option>
                        </FormSelect>
                      </div>
                    </div>
                  </div>
                  
                  {/* Close Case Card */}
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
                     <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                       <Icons.CheckCircle />
                       <h3 className="text-sm font-semibold text-slate-700">Close Case</h3>
                     </div>
                     <div className="p-4">
                        <p className="text-sm text-slate-600 mb-3">Mark this case as fully treated and closed. This action is final.</p>
                        <button onClick={closeCase} className="w-full px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition active:scale-95">
                          Mark as Treated
                        </button>
                     </div>
                  </div>
                </div>
              </div>

              {/* Past Notes / Timeline */}
              <section className="mt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Case History & Notes</h3>
                
                <div className="flow-root">
                  {notesLoading && <div className="text-sm text-slate-500">Loading notes…</div>}
                  {!notesLoading && notes.length === 0 && (
                    <div className="text-sm text-slate-500 bg-white border border-slate-200 rounded-lg p-6 text-center">No past notes found for this case.</div>
                  )}

                  {notes.length > 0 && (
                    <ul className="-mb-8">
                      {notes.map((n, noteIdx) => (
                        <li key={n.id}>
                          <div className="relative pb-8">
                            {/* Connection line */}
                            {noteIdx !== notes.length - 1 ? (
                              <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200" aria-hidden="true" />
                            ) : null}
                            
                            <div className="relative flex space-x-3">
                              <div>
                                <span className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center ring-8 ring-slate-50">
                                  <span className="text-xs font-semibold text-slate-700">
                                    {n.author ? n.author.slice(0, 2).toUpperCase() : "U"}
                                  </span>
                                </span>
                              </div>
                              <div className="min-w-0 flex-1 pt-1.5">
                                <div className="flex justify-between items-center">
                                  <p className="text-sm font-medium text-slate-800">{n.author ?? "unknown"}</p>
                                  <p className="text-xs text-slate-400">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
                                </div>
                                <div className="mt-2 p-3 bg-white border border-slate-200 rounded-lg">
                                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{n.note}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}