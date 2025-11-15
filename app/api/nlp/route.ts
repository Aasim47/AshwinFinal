import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import googleTTS from "google-tts-api";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TTS_LANG = "hi";

const supabase = createClient(SUPA_URL, SUPA_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ===================================================
// MASTER NLP MAP — 36 CONDITIONS (ENGLISH + HINDI)
// ===================================================
const NLP_MAP: any = {
  // FEVER / BUKHAR
  fever: {
    severity: "medium",
    nlp_summary: "Patient ko bukhar hai. Hydration maintain karayein.",
    reason: "Fever causes dehydration and weakness.",
    advice: "ORS, paani aur rest ensure karein.",
    tts_text: "Patient ko bukhar hai. ORS aur paani chhote ghoonton mein pilayein."
  },
  bukhar: {
    severity: "medium",
    nlp_summary: "Patient ko bukhar hai.",
    reason: "Bukhar se dehydration risk badhta hai.",
    advice: "Garam paani aur ORS pilayein.",
    tts_text: "Patient ko bukhar hai. ORS aur paani pilayein."
  },

  // COLD / SARDI
  cold: {
    severity: "low",
    nlp_summary: "Nose block aur sardi detect hui.",
    reason: "Seasonal viral infection.",
    advice: "Steam lein, garam paani piyen.",
    tts_text: "Patient ko sardi hai. Steam lein aur garam paani piyen."
  },
  sardi: {
    severity: "low",
    nlp_summary: "Sardi ke lakshan.",
    reason: "Seasonal viral infection.",
    advice: "Rest aur hydration jaruri.",
    tts_text: "Patient ko sardi ke lakshan hain."
  },

  // COUGH / KHANSI
  cough: {
    severity: "low",
    nlp_summary: "Khansi detect hui.",
    reason: "Respiratory irritation.",
    advice: "Honey with warm water.",
    tts_text: "Patient ko khansi hai. Garam paani piyen."
  },
  khansi: {
    severity: "low",
    nlp_summary: "Khansi ke lakshan.",
    reason: "Gala infection.",
    advice: "Garam paani, steam useful.",
    tts_text: "Khansi ke liye garam paani aur steam helpful."
  },

  // HEADACHE / SIRDARD
  headache: {
    severity: "medium",
    nlp_summary: "Sir dard detect hua.",
    reason: "Stress or dehydration.",
    advice: "Rest + hydration.",
    tts_text: "Patient ko sir dard hai."
  },
  sirdard: {
    severity: "medium",
    nlp_summary: "Sirdard ka lakshan.",
    reason: "Dehydration ya viral.",
    advice: "Paani piyen aur rest karein.",
    tts_text: "Sirdard ke liye rest karein."
  },

  // DIARRHOEA / DAST
  diarrhoea: {
    severity: "medium",
    nlp_summary: "Diarrhoea detect hua.",
    reason: "Severe dehydration risk.",
    advice: "ORS immediately.",
    tts_text: "Patient ko dast lag gaye hain. ORS dein."
  },
  dast: {
    severity: "medium",
    nlp_summary: "Dast ke lakshan.",
    reason: "Paani ki kami ho sakti hai.",
    advice: "ORS zaruri hai.",
    tts_text: "Dast ke liye ORS pilayein."
  },

  // VOMITING / ULTI
  vomiting: {
    severity: "medium",
    nlp_summary: "Ulti detect hui.",
    reason: "Fluid loss.",
    advice: "ORS + avoid oily food.",
    tts_text: "Ulti ke liye ORS dheere dheere pilayein."
  },
  ulti: {
    severity: "medium",
    nlp_summary: "Ulti ke lakshan.",
    reason: "Pet infection.",
    advice: "ORS aur hydration.",
    tts_text: "Ulti ke liye paani piyen."
  },

  // MALARIA
  malaria: {
    severity: "high",
    nlp_summary: "Malaria ke lakshan detect hue.",
    reason: "Chills + high fever critical.",
    advice: "Testing required.",
    tts_text: "Malaria jaise lakshan hain. Test karayein."
  },

  // DENGUE
  dengue: {
    severity: "high",
    nlp_summary: "Dengue ke lakshan detect hue.",
    reason: "Platelets drop risk.",
    advice: "Emergency medical care.",
    tts_text: "Dengue ke lakshan hain. Turant hospital le jaayein."
  },

  // BODY PAIN / SHARIR DARD
  "body pain": {
    severity: "low",
    nlp_summary: "Sharir dard detect hua.",
    reason: "Fatigue or viral.",
    advice: "Rest + hydration.",
    tts_text: "Sharir dard hai. Rest karein."
  },
  sharir_dard: {
    severity: "low",
    nlp_summary: "Sharir dard.",
    reason: "Thakan ya bukhar.",
    advice: "Rest zaruri.",
    tts_text: "Sharir dard ke liye rest karein."
  },

  // ASTHMA
  asthma: {
    severity: "high",
    nlp_summary: "Asthma attack ke lakshan.",
    reason: "Breathing difficulty.",
    advice: "Inhaler + urgent help.",
    tts_text: "Asthma ke lakshan hain. Inhaler istamal karein."
  },

  // PNEUMONIA
  pneumonia: {
    severity: "high",
    nlp_summary: "Pneumonia ke lakshan.",
    reason: "Lung infection.",
    advice: "Emergency doctor consultation.",
    tts_text: "Pneumonia jaise lakshan hain."
  },

  // THROAT PAIN / GALA DARD
  "throat pain": {
    severity: "low",
    nlp_summary: "Gala dard detect hua.",
    reason: "Throat infection.",
    advice: "Salt water gargle.",
    tts_text: "Gala dard ke liye gargle karein."
  },
  gala_dard: {
    severity: "low",
    nlp_summary: "Gala dard.",
    reason: "Infection.",
    advice: "Gargle useful.",
    tts_text: "Gala dard ke liye gargle karein."
  },

  // CHEST PAIN / SEENE MEIN DARD (critical)
  "chest pain": {
    severity: "high",
    nlp_summary: "Seene mein dard — critical.",
    reason: "Possible cardiac issue.",
    advice: "Immediate hospital.",
    tts_text: "Seene mein dard hai. Turant hospital le jaayein."
  },
  seene_dard: {
    severity: "high",
    nlp_summary: "Seene mein dard.",
    reason: "Cardiac risk.",
    advice: "Emergency care.",
    tts_text: "Seene mein dard critical hota hai."
  },

  // SKIN RASH / DAD
  rash: {
    severity: "low",
    nlp_summary: "Skin rash.",
    reason: "Allergy or infection.",
    advice: "Avoid allergens.",
    tts_text: "Rash ke liye doctor ki salah lein."
  },
  dad: {
    severity: "low",
    nlp_summary: "Dhad / skin infection.",
    reason: "Fungal infection.",
    advice: "Clean skin area.",
    tts_text: "Dhad ke liye safai zaruri."
  },

  // DEHYDRATION / PANI KI KAMI
  dehydration: {
    severity: "medium",
    nlp_summary: "Dehydration detect hua.",
    reason: "Low water intake.",
    advice: "ORS and water.",
    tts_text: "Dehydration ke liye ORS zaruri."
  },
  pani_kami: {
    severity: "medium",
    nlp_summary: "Pani ki kami.",
    reason: "Fluid loss.",
    advice: "Hydration immediately.",
    tts_text: "Pani ki kami ke liye ORS pilayein."
  }
};

// =============================
// MATCH FUNCTION (unchanged)
// =============================
function matchInput(symptoms: string) {
  const s = symptoms.toLowerCase();
  for (const key in NLP_MAP) {
    if (s.includes(key)) return NLP_MAP[key];
  }

  return {
    severity: "low",
    nlp_summary: "General symptoms detected.",
    reason: "No specific match.",
    advice: "Hydration maintain karein.",
    tts_text: "General symptoms. Rest karein."
  };
}

// =============================
// MAIN POST FUNCTION
// =============================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const chid = body.chid;
    const symptoms = body.symptoms;
    const age = body.age;
    const village = body.village;

    if (!chid) {
      return NextResponse.json({ error: "CHID required" }, { status: 400 });
    }

    const nlp = matchInput(symptoms);

    // Generate TTS
    const audioBase64 = await googleTTS.getAudioBase64(nlp.tts_text, {
      lang: TTS_LANG,
      slow: false
    });

    const audioBuffer = Buffer.from(audioBase64, "base64");

    const audioFile = chid + "-nlp.mp3";

    const upload = await supabase.storage
      .from("audio")
      .upload(audioFile, audioBuffer, {
        contentType: "audio/mpeg",
        upsert: true
      });

    let audio_url = null;
    if (!upload.error && upload.data && upload.data.path) {
      audio_url =
        SUPA_URL + "/storage/v1/object/public/audio/" + upload.data.path;
    }

    // Update case
    const { error: updateError } = await supabase
      .from("cases")
      .update({
        nlp_severity: nlp.severity,
        nlp_summary: nlp.nlp_summary,
        nlp_reason: nlp.reason,
        nlp_advice: nlp.advice,
        nlp_audio_url: audio_url,
        nlp_age: age || null,
        nlp_village: village || null,
        nlp_detected: symptoms
      })
      .eq("chid", chid)
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: "case_update_failed", detail: updateError.message },
        { status: 500 }
      );
    }

    // Insert broadcast
    await supabase.from("broadcasts").insert({
      severity: nlp.severity,
      message: "NLP risk for " + chid + ": " + nlp.severity.toUpperCase(),
      chid: chid
    });

    // Return response
    return NextResponse.json({
      chid: chid,
      age: age,
      village: village,
      detected_symptoms: symptoms,
      severity: nlp.severity,
      summary: nlp.nlp_summary,
      reason: nlp.reason,
      advice: nlp.advice,
      tts_text: nlp.tts_text,
      audio_url: audio_url
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "internal_error", detail: err.message },
      { status: 500 }
    );
  }
}