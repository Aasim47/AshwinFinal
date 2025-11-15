// app/api/doctor/update-status/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Generic status updater. Body:
 * {
 *   case_id: "<uuid>",
 *   status: "Under Followup" | "Escalated" | "Treated" | "New" | "Doctor Assigned",
 *   author: "doctor@example.com"
 * }
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { case_id, status, author = "system", note } = body;

    if (!case_id || !status) {
      return NextResponse.json({ ok: false, error: "missing case_id or status" }, { status: 400 });
    }

    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPA_URL || !SUPA_KEY) {
      return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPA_URL, SUPA_KEY);

    // Update cases.status
    const { data: updatedCase, error: updateErr } = await supabase
      .from("cases")
      .update({ status })
      .eq("id", case_id)
      .select()
      .single();

    if (updateErr) {
      console.error("status update error", updateErr);
      return NextResponse.json({ ok: false, error: "case_update_failed", detail: updateErr.message }, { status: 500 });
    }

    // Insert audit event
    const meta: any = { by: author, to: status };
    if (note) meta.note = note;

    const { error: evErr } = await supabase.from("case_events").insert({
      case_id,
      event_type: "status",
      meta
    });

    if (evErr) console.warn("case_events insert warning", evErr);

    return NextResponse.json({ ok: true, case: updatedCase });
  } catch (e: any) {
    console.error("update-status error", e);
    return NextResponse.json({ ok: false, error: "server_error", detail: String(e) }, { status: 500 });
  }
}
