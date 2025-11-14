import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import googleTTS from "google-tts-api";
import { v4 as uuidv4 } from "uuid";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CHID_PREFIX = process.env.CHID_PREFIX ?? "CHID-2025";
const TTS_LANG = process.env.GOOGLE_TTS_LANGUAGE ?? "hi";

const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY, {
    auth: { persistSession: false }
});

function hindiSummary({ name, age, village, symptoms, severity, pregnant }: any) {
    const n = name ? `Mareez ${name}` : "Mareez";
    const a = age ? `${age} saal` : "";
    const v = village ? `, gaon ${village}` : "";
    const s = symptoms || "lakshan uplabdh nahi";
    const r = severity || "madhyam";

    const preg = pregnant === true
        ? "Patient garbhwati hai. "
        : pregnant === false
            ? ""
            : "";  // skip if unknown

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
            severity,
            pregnant,
            photoBase64,
            extra = {}
        } = body;

        if (!symptoms) {
            return NextResponse.json({ error: "symptoms required" }, { status: 400 });
        }

        // ---------------------------
        // STEP 1: Create Patient Row
        // ---------------------------
        let patient_id = null;

        const { data: existing } = await supabase
            .from("patients")
            .select("id")
            .eq("name", patientName ?? "")
            .limit(1);

        if (existing && existing.length > 0) {
            patient_id = existing[0].id;
        } else {
            const insertP = await supabase
                .from("patients")
                .insert({
                    name: patientName ?? null,
                    age: age ?? null,
                    gender: gender ?? null,
                    village: village ?? null
                })
                .select("id")
                .single();

            patient_id = insertP.data?.id ?? null;
        }

        // ---------------------------
        // STEP 2: Build Hindi Summary
        // ---------------------------
        const summaryHindi = hindiSummary({
            name: patientName,
            age,
            village,
            symptoms,
            severity,
            pregnant
        });

        // ---------------------------
        // STEP 3: Generate MP3 (TTS)
        // ---------------------------
        const base64 = await googleTTS.getAudioBase64(summaryHindi, {
            lang: TTS_LANG,
            slow: false
        });

        const mp3Buffer = Buffer.from(base64, "base64");
        const chid = `${CHID_PREFIX}-${uuidv4().slice(0, 8).toUpperCase()}`;
        const audioFile = `${chid}.mp3`;

        const audioUpload = await supabase.storage
            .from("audio")
            .upload(audioFile, mp3Buffer, {
                contentType: "audio/mpeg",
                upsert: true
            });

        let audio_url = null;
        if (!audioUpload.error) {
            audio_url = `${SUPA_URL}/storage/v1/object/public/audio/${audioUpload.data.path}`;
        }

        // ---------------------------
        // STEP 4: Optional Photo Upload
        // ---------------------------
        let photo_url = null;
        if (photoBase64) {
            try {
                const photoBuffer = Buffer.from(photoBase64, "base64");
                const photoFile = `${chid}-photo.jpg`;

                const photoUpload = await supabase.storage
                    .from("photos")
                    .upload(photoFile, photoBuffer, {
                        contentType: "image/jpeg",
                        upsert: true
                    });

                if (!photoUpload.error) {
                    photo_url = `${SUPA_URL}/storage/v1/object/public/photos/${photoUpload.data.path}`;
                }
            } catch (e) {
                console.warn("Photo upload failed", e);
            }
        }

        // ---------------------------
        // STEP 5: Insert Case Row
        // ---------------------------
        const newCase = {
            chid,
            patient_id,
            symptoms,
            severity,
            summary_hindi: summaryHindi,
            audio_path: audioUpload.data?.path ?? null,
            photo_path: photo_url,
            extra: {
                pregnant: pregnant ?? null,
                ...extra
            }
        };


        const insertCase = await supabase
            .from("cases")
            .insert(newCase)
            .select()
            .single();

        if (insertCase.error) {
            return NextResponse.json(
                { error: "database insert failed", detail: insertCase.error.message },
                { status: 500 }
            );
        }

        return NextResponse.json(
            {
                ok: true,
                case: insertCase.data,
                audio_url,
                photo_url
            },
            { status: 201 }
        );
    } catch (err: any) {
        console.error("triage error", err);
        return NextResponse.json(
            { error: "internal_error", detail: err.message },
            { status: 500 }
        );
    }
}
