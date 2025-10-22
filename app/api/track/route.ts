import { NextResponse } from "next/server";
import { fetchAllStates } from "@/lib/opensky";


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hex = (searchParams.get("hex")||"").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) return NextResponse.json({ error:"bad_hex" },{ status:400 });

  const now = Math.floor(Date.now()/1000);
  const state = await osGet(`https://opensky-network.org/api/states/all?icao24=${hex}`);
  const s = state.states?.[0] || null;
  const track = await osGet(`https://opensky-network.org/api/tracks/all?icao24=${hex}&time=${now}`);

  let lastFlight = null;
  try {
    const begin = now - 6*3600;
    const flights = await osGet(`https://opensky-network.org/api/flights/aircraft?icao24=${hex}&begin=${begin}&end=${now}`);
    lastFlight = flights?.sort((a:any,b:any)=>(b.timeDeparture||0)-(a.timeDeparture||0))[0] || null;
  } catch {}

  return NextResponse.json({
    pos: s ? { hex:s[0], callsign:s[1]?.trim()||null, lat:s[6], lon:s[5], gs_mps:s[9], track:s[10], last:s[4] } : null,
    track, lastFlight
  });
}
