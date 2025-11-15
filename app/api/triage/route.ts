// app/api/triage/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import googleTTS from "google-tts-api";
import { v4 as uuidv4 } from "uuid";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CHID_PREFIX = process.env.CHID_PREFIX ?? "CHID-2025";
const TTS_LANG = process.env.GOOGLE_TTS_LANGUAGE ?? "hi";

if (!SUPA_URL || !SUPA_SERVICE_KEY) {
    console.error(
        "Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY). Ensure they are set."
    );
}

const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY, {
    auth: { persistSession: false },
});

function hindiSummary({
    name,
    age,
    village,
    symptoms,
    severity,
    pregnant,
}: any) {
    const n = name ? `Mareez ${name}` : "Mareez";
    const a = age ? `${age} saal` : "";
    const v = village ? `, gaon ${village}` : "";
    const s = symptoms || "lakshan uplabdh nahi";
    const r = severity || "madhyam";

    const preg =
        pregnant === true ? "Patient garbhwati hai. " : pregnant === false ? "" : "";

    return `${n} ${a}${v}. ${preg}Lakshan: ${s}. Risk: ${r}. Salah: najdiki PHC se sampark karein.`;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const {
            patientName,
            age,
            gender,
            village,
            symptoms,
            // severity intentionally not trusted from frontend
            pregnant,
            photoBase64,
            extra = {},
        } = body;

        if (!symptoms || String(symptoms).trim().length < 1) {
            return NextResponse.json({ error: "symptoms required" }, { status: 400 });
        }

        // generate exactly one CHID for this request and reuse it everywhere
        const CHID = `${CHID_PREFIX}-${uuidv4().slice(0, 8).toUpperCase()}`;



        // make severityFinal available to the whole handler
        let severityFinal: string = "madhyam"; // default fallback

        // ----------------------
        // ----------------------
        // STEP 1: CALL NLP FIRST
        // ----------------------
        const originHeader = req.headers.get("origin");
        const base =
            (originHeader && String(originHeader)) ||
            process.env.NEXT_PUBLIC_BASE_URL ||
            "http://localhost:3000";

        let nlpJson: any = null;
        try {
            // IMPORTANT: include CHID so NLP route that requires it will work
            const nlpRes = await fetch(`${base.replace(/\/$/, "")}/api/nlp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chid: CHID, symptoms, age, village }),
            });

            if (nlpRes.ok) {
                nlpJson = await nlpRes.json();
            } else {
                const txt = await nlpRes.text().catch(() => null);
                console.warn("NLP returned non-OK:", nlpRes.status, txt);
                nlpJson = null;
            }
        } catch (e) {
            console.warn("NLP call failed:", e);
            nlpJson = null;
        }

        // --------------------------
        // STEP 1B: Normalize severity from NLP
        // --------------------------
        const raw = nlpJson?.severity ?? nlpJson?.risk ?? nlpJson?.level ?? null;

        if (raw) {
            const s = String(raw).toLowerCase();
            if (s.includes("low") || s.includes("kam")) severityFinal = "kam";
            else if (s.includes("medium") || s.includes("madhyam")) severityFinal = "madhyam";
            else if (s.includes("high") || s.includes("zyaada") || s.includes("severe")) severityFinal = "zyaada";
        } else {
            // fallback if NLP fails
            const txt = String(symptoms || "").toLowerCase();

            if (txt.match(/\b(bleed|vomit blood|heavy bleeding|unconscious|severe pain|seizure|breathless)\b/))
                severityFinal = "zyaada";
            else if (txt.match(/\b(fever|dengue|vomit|diarrhea|pain|cough|cold)\b/))
                severityFinal = "madhyam";
            else if (txt.match(/\b(mild|slight|itch|rash|small pain)\b/))
                severityFinal = "kam";
        }



        // --------------------------
        // STEP 2: Create / find patient
        // --------------------------
        let patient_id: string | null = null;
        try {
            const { data: existing } = await supabase
                .from("patients")
                .select("id")
                .eq("name", patientName ?? "")
                .limit(1);

            if (existing && Array.isArray(existing) && existing.length > 0) {
                patient_id = existing[0].id;
            } else {
                const insertP = await supabase
                    .from("patients")
                    .insert({
                        name: patientName ?? null,
                        age: age ?? null,
                        gender: gender ?? null,
                        village: village ?? null,
                    })
                    .select("id")
                    .single();

                patient_id = insertP.data?.id ?? null;
            }
        } catch (e) {
            console.warn("Patient insert/find failed:", e);
            // continue; patient_id may remain null
        }

        // --------------------------
        // STEP 3: Build Hindi summary (uses NLP severity)
        // --------------------------
        const summaryHindi = hindiSummary({
            name: patientName,
            age,
            village,
            symptoms,
            severity: severityFinal,
            pregnant,
        });

        // --------------------------
        // STEP 4: Generate TTS (use single CHID)
        // --------------------------
        let audio_url: string | null = null;
        let audioPath: string | null = null;
        try {
            const base64 = await googleTTS.getAudioBase64(summaryHindi, {
                lang: TTS_LANG,
                slow: false,
            });
            const mp3Buffer = Buffer.from(base64, "base64");
            const audioFile = `${CHID}.mp3`;

            const audioUpload = await supabase.storage.from("audio").upload(
                audioFile,
                mp3Buffer,
                {
                    contentType: "audio/mpeg",
                    upsert: true,
                }
            );

            if (!audioUpload.error) {
                audioPath = audioUpload.data.path;
                audio_url = `${SUPA_URL}/storage/v1/object/public/audio/${audioUpload.data.path}`;
            } else {
                console.warn("Audio upload error:", audioUpload.error);
            }
        } catch (e) {
            console.warn("TTS/generate/upload failed:", e);
        }

        // --------------------------
        // STEP 5: Optional photo upload (use same CHID)
        // --------------------------
        let photo_url: string | null = null;
        let photoUploadPath: string | null = null;
        if (photoBase64) {
            try {
                const photoBuffer = Buffer.from(photoBase64, "base64");
                const photoFile = `${CHID}-photo.jpg`;

                const photoUpload = await supabase.storage
                    .from("photos")
                    .upload(photoFile, photoBuffer, {
                        contentType: "image/jpeg",
                        upsert: true,
                    });

                if (!photoUpload.error) {
                    photoUploadPath = photoUpload.data.path;
                    photo_url = `${SUPA_URL}/storage/v1/object/public/photos/${photoUpload.data.path}`;
                } else {
                    console.warn("Photo upload error:", photoUpload.error);
                }
            } catch (e) {
                console.warn("Photo upload exception:", e);
            }
        }

        // --------------------------
        // STEP 6: Insert Case WITH severityFinal and single CHID
        // --------------------------
        try {
            const newCase = {
                chid: CHID,
                patient_id,
                symptoms,
                severity: severityFinal,
                summary_hindi: summaryHindi,
                audio_path: audioPath ?? null,
                photo_path: photoUploadPath ?? null,
                extra: {
                    pregnant: pregnant ?? null,
                    ...extra,
                },
            };

            const insertCase = await supabase
                .from("cases")
                .insert(newCase)
                .select()
                .single();

            if (insertCase.error) {
                console.error("Insert case error:", insertCase.error);
                return NextResponse.json(
                    { error: "database insert failed", detail: insertCase.error.message },
                    { status: 500 }
                );
            }

            // Success response: include NLP raw and normalized severity for frontend verification
            return NextResponse.json(
                {
                    ok: true,
                    case: insertCase.data,
                    audio_url,
                    photo_url,
                    severity_from_nlp: severityFinal,
                    nlp_raw: nlpJson ?? null,
                },
                { status: 201 }
            );
        } catch (e: any) {
            console.error("Case creation error:", e);
            return NextResponse.json(
                { error: "case_create_failed", detail: e?.message ?? String(e) },
                { status: 500 }
            );
        }
    } catch (err: any) {
        console.error("triage route error:", err);
        return NextResponse.json(
            { error: "internal_error", detail: err?.message ?? String(err) },
            { status: 500 }
        );
    }
}
