// app/api/doctor/add-note/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { case_id, author = "unknown", note } = body;

    if (!case_id || !note) {
      return NextResponse.json({ ok: false, error: "missing case_id or note" }, { status: 400 });
    }

    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // server key

    if (!SUPA_URL || !SUPA_KEY) {
      return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPA_URL, SUPA_KEY);

    // Insert note
    const { data: noteRow, error: noteErr } = await supabase
      .from("case_notes")
      .insert({ case_id, author, note })
      .select()
      .single();

    if (noteErr) {
      console.error("note insert error", noteErr);
      return NextResponse.json({ ok: false, error: "db_insert_failed", detail: noteErr.message }, { status: 500 });
    }

    // Also insert an event row into case_events for audit
    const evMeta = { author, note };
    const { error: evErr } = await supabase.from("case_events").insert({
      case_id,
      event_type: "note",
      meta: evMeta
    });

    if (evErr) console.warn("case_events insert warning", evErr);

    return NextResponse.json({ ok: true, note: noteRow });
  } catch (e: any) {
    console.error("add-note error", e);
    return NextResponse.json({ ok: false, error: "server_error", detail: String(e) }, { status: 500 });
  }
}
