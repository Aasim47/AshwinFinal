// app/api/doctor/close-case/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Simple wrapper to mark a case 'Treated' (close).
 * Optionally enforces ADMIN_SECRET header if ADMIN_SECRET env var is set.
 *
 * Body: { case_id: "<uuid>", author?: "doctor@example.com" }
 */

export async function POST(req: NextRequest) {
  try {
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ADMIN_SECRET = process.env.ADMIN_SECRET; // optional server-side admin secret

    if (!SUPA_URL || !SUPA_KEY) {
      return NextResponse.json({ ok: false, error: "supabase_not_configured" }, { status: 500 });
    }

    // If ADMIN_SECRET is configured, require header x-admin-secret
    if (ADMIN_SECRET) {
      const sent = req.headers.get("x-admin-secret") ?? "";
      if (sent !== ADMIN_SECRET) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();
    const case_id = body?.case_id;
    const author = body?.author ?? "doctor";

    if (!case_id) {
      return NextResponse.json({ ok: false, error: "missing_case_id" }, { status: 400 });
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPA_URL, SUPA_KEY);

    // 1) update status to Treated
    const { data: updated, error: updateErr } = await supabase
      .from("cases")
      .update({ status: "Treated" })
      .eq("id", case_id)
      .select()
      .single();

    if (updateErr) {
      console.error("close-case updateErr", updateErr);
      return NextResponse.json({ ok: false, error: "case_update_failed", detail: updateErr.message }, { status: 500 });
    }

    // 2) insert audit event
    const evMeta = { by: author, to: "Treated" };
    const { error: evErr } = await supabase.from("case_events").insert({
      case_id,
      event_type: "status",
      meta: evMeta
    });

    if (evErr) console.warn("close-case event insert warning", evErr);

    return NextResponse.json({ ok: true, case: updated });
  } catch (e: any) {
    console.error("close-case server error", e);
    return NextResponse.json({ ok: false, error: "server_error", detail: String(e) }, { status: 500 });
  }
}
