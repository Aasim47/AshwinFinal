
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { case_id, status = "treated" } = await req.json();
    if (!case_id) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(`${SUPA_URL}/rest/v1/cases?id=eq.${case_id}`, {
      method: "PATCH",
      headers: {
        "apikey": SERVICE_ROLE,
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ status })
    });

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ ok: false, detail: json }, { status: 500 });

    return NextResponse.json({ ok: true, case: json[0] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
