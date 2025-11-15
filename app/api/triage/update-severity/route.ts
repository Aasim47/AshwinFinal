import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPA_URL || !SUPA_SERVICE_KEY) {
  throw new Error("Supabase env missing for update-severity route");
}

const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY, {
  auth: { persistSession: false }
});

export async function POST(req: Request) {
  try {
    const { chid, severity } = await req.json();

    if (!chid || !severity) {
      return NextResponse.json({ ok: false, error: "missing chid or severity" }, { status: 400 });
    }

    const { error } = await supabase
      .from("cases")
      .update({ severity })
      .eq("chid", chid);

    if (error) {
      console.error("update severity error", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("update-severity route error", err);
    return NextResponse.json({ ok: false, error: err.message || "internal" }, { status: 500 });
  }
}
