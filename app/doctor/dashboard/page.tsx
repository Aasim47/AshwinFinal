// app/doctor/dashboard/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

/**
 * Doctor Dashboard (client-only)
 *
 * - client-only to avoid SSR hydration mismatches
 * - uses dynamic import of supabase client on mount
 * - simple UI: filter, search, case list, case detail, add note, assign, close
 *
 * Replace existing file with this. Restart dev server after saving.
 */

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

export default function DoctorDashboardPage() {
    const [supabaseClient, setSupabaseClient] = useState<any | null>(null);
    const [cases, setCases] = useState<CaseRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // UI state
    const [filter, setFilter] = useState<"all" | "kam" | "madhyam" | "zyaada">("all");
    const [search, setSearch] = useState("");
    const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null);
    const [noteText, setNoteText] = useState("");
    const [assignTo, setAssignTo] = useState("");

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
                console.log("Doctor page: SUPABASE URL present?", !!url, "ANON key len:", anon?.length ?? 0);
                console.log("Supabase client created:", !!client);
                setSupabaseClient(client);
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

    // subscribe to realtime INSERTs for instant updates (safe pattern)
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
                if (subscription?.error) {
                    console.warn("supabase subscribe error", subscription.error);
                }
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

    // filtered list
    const filtered = useMemo(() => {
        let list = cases;
        if (filter !== "all") {
            list = list.filter((c) => (c.severity ?? "").toLowerCase() === filter);
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
    }, [cases, filter, search]);

    // action helpers: add note, assign, close
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
        } catch (e: any) {
            console.error("assignCase error", e);
            alert("Network error assigning");
        }
    }

    async function closeCase() {
        if (!selectedCase) return alert("Select case first");
        const ok = confirm("Mark this case as treated/closed?");
        if (!ok) return;
        try {
            const res = await fetch("/api/doctor/close-case", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ case_id: selectedCase.id, status: "treated" }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                console.error("close failed", json);
                alert("Close failed");
                return;
            }
            alert("Case marked treated.");
            // update local state
            setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? { ...c, status: "treated" } : c)));
        } catch (e: any) {
            console.error("closeCase error", e);
            alert("Network error closing");
        }
    }

    // render
    return (
        <div className="min-h-screen p-4 bg-slate-50">
            <div className="max-w-7xl mx-auto">
                <header className="flex items-center gap-4 mb-4">
                    <h1 className="text-2xl font-semibold">Doctor — Dashboard</h1>
                    <div className="text-sm text-slate-600">Cases list & quick actions</div>

                    <div className="ml-4 text-xs text-slate-600">
                        Cases: <strong>{cases.length}</strong>
                    </div>

                    <div className="ml-4 flex items-center gap-2">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                            className="border px-2 py-1 rounded text-sm"
                        >
                            <option value="all">All</option>
                            <option value="kam">Low</option>
                            <option value="madhyam">Medium</option>
                            <option value="zyaada">High</option>
                        </select>

                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="search CHID/village"
                            className="border px-2 py-1 rounded flex-1"
                        />

                        <button
                            onClick={() => loadCases()}
                            className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                        >
                            Refresh
                        </button>
                    </div>
                </header>

                {error && <div className="mb-4 text-red-600">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 bg-white rounded shadow p-3">
                        <h3 className="font-semibold mb-2">Cases</h3>
                        <div className="space-y-2 max-h-[60vh] overflow-auto">
                            {loading && <div className="text-sm text-slate-500">Loading…</div>}
                            {!loading && filtered.length === 0 && <div className="text-sm text-slate-500">No cases</div>}
                            {filtered.map((c) => (
                                <div
                                    key={c.id}
                                    onClick={() => setSelectedCase(c)}
                                    className={`p-2 rounded cursor-pointer ${selectedCase?.id === c.id ? "bg-indigo-50 border border-indigo-200" : "border border-slate-100"}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="font-medium">{c.chid}</div>
                                        <div className="text-xs text-slate-500">{(c.severity ?? "-")}</div>
                                    </div>
                                    <div className="text-xs text-slate-600 mt-1">{c.summary_hindi ?? c.symptoms}</div>
                                    <div className="text-xs text-slate-400 mt-1">{c.assigned_to ? `Assigned: ${c.assigned_to}` : ""}</div>
                                    <div className="text-xs text-slate-400 mt-1">{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-white rounded shadow p-4">
                        <h3 className="font-semibold mb-2">Details</h3>

                        {!selectedCase && <div className="text-sm text-slate-500">Select a case to view details</div>}

                        {selectedCase && (
                            <>
                                <div className="mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="font-medium text-lg">{selectedCase.chid}</div>
                                        <div className="text-xs text-slate-500">{selectedCase.severity}</div>
                                        <div className="text-xs text-slate-500">{selectedCase.status ?? ""}</div>
                                        <div className="ml-auto text-xs text-slate-400">{selectedCase.created_at ? new Date(selectedCase.created_at).toLocaleString() : ""}</div>
                                    </div>

                                    <div className="mt-2 text-sm text-slate-700">{selectedCase.summary_hindi ?? selectedCase.symptoms}</div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                    <div className="md:col-span-2">
                                        <label className="text-xs text-slate-600">Add note</label>
                                        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} className="w-full border rounded p-2" rows={3} />
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={addNote} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm">Save note</button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-slate-600">Assign to</label>
                                        <input value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full border rounded px-2 py-1" placeholder="PHC / Dr email" />
                                        <div className="flex gap-2 mt-2">
                                            <button onClick={assignCase} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm">Assign</button>
                                            <button onClick={closeCase} className="px-3 py-1 bg-slate-100 rounded text-sm">Mark Treated</button>
                                        </div>
                                    </div>
                                </div>

                                {/* audio/photo */}
                                <div className="space-y-2">
                                    {selectedCase.audio_path && (
                                        <div>
                                            <div className="text-xs text-slate-600">Audio</div>
                                            <audio controls src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/audio/${selectedCase.audio_path}`} />
                                        </div>
                                    )}

                                    {selectedCase.photo_path && (
                                        <div>
                                            <div className="text-xs text-slate-600">Photo</div>
                                            <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${selectedCase.photo_path}`} alt="photo" className="max-h-48 rounded border" />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
