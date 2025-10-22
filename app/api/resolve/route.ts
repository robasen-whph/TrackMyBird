import { NextResponse } from "next/server";
import { fetchAllStates } from "@/lib/opensky";


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  let tail = (searchParams.get("tail")||"").toUpperCase().replace(/\s+/g,"");
  if (!tail) return NextResponse.json({ error:"no_tail" }, { status:400 });

  // OpenSky metadata supports registration → icao24 on many aircraft
  // Endpoint: /api/metadata/aircraft/registration/{reg}
  try {
    const meta = await osGet(`https://opensky-network.org/api/metadata/aircraft/registration/${encodeURIComponent(tail)}`);
    if (meta?.icao24) return NextResponse.json({ hex: String(meta.icao24).toLowerCase(), meta });
  } catch {}

  return NextResponse.json({ error:"not_found" }, { status:404 });
}
