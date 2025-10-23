import { NextResponse } from "next/server";
import { fetchAllStates } from "@/lib/opensky";


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let tail = (searchParams.get("tail")||"").toUpperCase().replace(/\s+/g,"");
  if (!tail) return NextResponse.json({ error:"no_tail" }, { status:400 });

  // Strategy 1: Try OpenSky metadata API (registration → icao24)
  try {
    const r = await fetch(
      `https://opensky-network.org/api/metadata/aircraft/registration/${encodeURIComponent(tail)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (r.ok) {
      const meta = await r.json();
      if (meta?.icao24) {
        return NextResponse.json({ hex: String(meta.icao24).toLowerCase(), tail, meta });
      }
    }
  } catch (e) {
    console.error("Metadata API error:", e);
  }

  // Strategy 2: Fallback - search all active aircraft states for matching callsign
  try {
    const states = await fetchAllStates();
    if (states && states.length > 0) {
      // Search for aircraft with matching callsign (often contains tail number)
      const match = states.find((s) => {
        const callsign = (s[1] || "").trim().toUpperCase();
        // Require non-empty callsign to avoid false matches with empty strings
        if (!callsign) return false;
        return callsign === tail || callsign.includes(tail) || tail.includes(callsign);
      });
      
      if (match && match[0]) {
        const hex = String(match[0]).toLowerCase();
        return NextResponse.json({ 
          hex, 
          tail, 
          source: "live_states",
          callsign: match[1]?.trim() || null 
        });
      }
    }
  } catch (e) {
    console.error("Live states fallback error:", e);
  }

  return NextResponse.json({ error:"not_found" }, { status:404 });
}
