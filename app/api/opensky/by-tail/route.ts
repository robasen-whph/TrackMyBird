import { NextResponse } from "next/server";
import { fetchAllStates } from "@/lib/opensky";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const tail = (url.searchParams.get("tail") || "").trim().toUpperCase();
    if (!tail) return NextResponse.json({ error:"tail required" }, { status:400 });

    const states = await fetchAllStates();
    const match = states.find(s => (s[1]?.trim().toUpperCase() || "") === tail);
    if (!match) return NextResponse.json({ icao24:null, active:false });
    const [icao24, callsign, , , last_contact, lon, lat] = match;
    return NextResponse.json({ icao24, callsign, active:true, last_contact, lon, lat });
  } catch (e:any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}

