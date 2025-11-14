import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { case_id, assignee, role } = body;
    if (!case_id || !assignee) return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });

    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(`${SUPA_URL}/rest/v1/assignments`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_ROLE,
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify([{ case_id, assignee, role }])
    });

    const json = await res.json();
    if (!res.ok) return NextResponse.json({ ok: false, detail: json }, { status: 500 });

    // optional: update case status (server-side)
    await fetch(`${SUPA_URL}/rest/v1/cases?id=eq.${case_id}`, {
      method: "PATCH",
      headers: {
        "apikey": SERVICE_ROLE,
        "Authorization": `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({ assigned_to: assignee })
    });

    return NextResponse.json({ ok: true, assignment: json[0] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
