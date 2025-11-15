"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function BroadcastListener() {
  const [broadcast, setBroadcast] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(SUPA_URL, SUPA_ANON);

    const channel = supabase
      .channel("public:broadcasts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "broadcasts" },
        (payload) => {
          setBroadcast(payload.new);
          setShowPopup(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!showPopup || !broadcast) return null;

  return (
    <div className="fixed bottom-6 right-6 bg-red-600 text-white p-4 rounded-lg shadow-lg z-50 w-80">
      <div className="font-bold text-lg">
        Broadcast — {broadcast.severity?.toUpperCase()}
      </div>
      <div className="mt-2 text-sm">{broadcast.message}</div>

      <button
        onClick={() => setShowPopup(false)}
        className="mt-3 px-3 py-1 bg-white text-red-600 rounded text-sm"
      >
        Close
      </button>
    </div>
  );
}