// app/api/broadcast/route.ts
import { NextResponse } from "next/server";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_SERVICE) {
  // fail early in dev if key missing
  console.warn("Missing Supabase env for broadcast route");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { sender = "admin", message, severity = "madhyam", lat = null, lng = null, radius_meters = null } = body;

    if (!message || String(message).trim().length < 3) {
      return NextResponse.json({ ok: false, error: "message_required" }, { status: 400 });
    }

    // use server-side supabase client (service role)
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(SUPA_URL!, SUPA_SERVICE!);

    const insert = {
      sender,
      message,
      severity,
      lat,
      lng,
      radius_meters,
    };

    const { data, error } = await supa.from("broadcasts").insert(insert).select().single();

    if (error) {
      console.error("broadcast insert error", error);
      return NextResponse.json({ ok: false, error: "insert_failed", detail: error.message }, { status: 500 });
    }

    // success — return the row (realtime will notify clients)
    return NextResponse.json({ ok: true, broadcast: data });
  } catch (e: any) {
    console.error("broadcast handler failed", e);
    return NextResponse.json({ ok: false, error: "internal", detail: String(e) }, { status: 500 });
  }
}
