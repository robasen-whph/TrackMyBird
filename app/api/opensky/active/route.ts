import { NextResponse } from "next/server";
import { fetchAllStates } from "@/lib/opensky";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const bbox = url.searchParams.get("bbox")?.split(",").map(Number);
    const states = bbox?.length===4
      ? await fetchAllStates({ lamin:bbox[0], lomin:bbox[1], lamax:bbox[2], lomax:bbox[3] })
      : await fetchAllStates();
    if (!states.length) return NextResponse.json({ icao24:null, count:0 });
    const s = states[Math.floor(Math.random()*states.length)];
    const [icao24, callsign, origin_country] = s;
    return NextResponse.json({ icao24, callsign, origin_country, count: states.length });
  } catch (e:any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
