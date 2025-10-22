import { NextResponse } from "next/server";
import { osGet } from "@/lib/opensky";

export async function GET() {
  const j = await osGet("https://opensky-network.org/api/states/all");
  const seen = new Set<string>(), airborne:any[] = [];
  for (const s of (j.states||[])) {
    const hex=s[0]; if (!hex || seen.has(hex)) continue;
    if (s[6]!=null && s[5]!=null && !s[8]) { airborne.push({ hex, callsign:s[1]?.trim()||null }); seen.add(hex); }
  }
  if (!airborne.length) return NextResponse.json({ error:"none" },{ status:404 });
  return NextResponse.json(airborne[Math.floor(Math.random()*airborne.length)]);
}
