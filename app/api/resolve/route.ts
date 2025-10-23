import { NextResponse } from "next/server";
import { fetchAllStates } from "@/lib/opensky";


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let tail = (searchParams.get("tail")||"").toUpperCase().replace(/\s+/g,"");
  if (!tail) return NextResponse.json({ error:"no_tail" }, { status:400 });

  // OpenSky metadata supports registration → icao24 on many aircraft
  // Endpoint: /api/metadata/aircraft/registration/{reg}
  try {
    const r = await fetch(
      `https://opensky-network.org/api/metadata/aircraft/registration/${encodeURIComponent(tail)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const meta = await r.json();
    if (meta?.icao24) return NextResponse.json({ hex: String(meta.icao24).toLowerCase(), tail, meta });
  } catch {}

  return NextResponse.json({ error:"not_found" }, { status:404 });
}
