# setup_trackmybird.ps1
$base = "C:\Users\rober\Coding-Local\TrackMyBird"
$files = @{
  "$base\next.config.mjs" = @'
/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true };
export default nextConfig;
'@;

  "$base\lib\opensky.ts" = @'
export type StateVector = [
  icao24: string, callsign: string | null, origin_country: string,
  time_position: number | null, last_contact: number, longitude: number | null,
  latitude: number | null, baro_altitude: number | null, on_ground: boolean,
  velocity: number | null, true_track: number | null, vertical_rate: number | null,
  sensors: number[] | null, geo_altitude: number | null, squawk: string | null,
  spi: boolean, position_source: number, category?: number
];

const authHeader = () => {
  const u = process.env.OPENSKY_USER;
  const p = process.env.OPENSKY_PASS;
  if (!u || !p) return {};
  const token = Buffer.from(`${u}:${p}`).toString("base64");
  return { Authorization: `Basic ${token}` };
};

export async function fetchAllStates(bbox?: { lamin: number; lomin: number; lamax: number; lomax: number; }) {
  const params = new URLSearchParams();
  if (bbox) { params.set("lamin", String(bbox.lamin)); params.set("lomin", String(bbox.lomin)); params.set("lamax", String(bbox.lamax)); params.set("lomax", String(bbox.lomax)); }
  const res = await fetch(`https://opensky-network.org/api/states/all?${params}`, { headers: { ...authHeader() }, cache: "no-store" });
  if (!res.ok) throw new Error(`OpenSky error ${res.status}`);
  const json = await res.json() as { time: number; states: StateVector[] | null };
  return json.states ?? [];
}
'@;

  "$base\app\api\opensky\active\route.ts" = @'
import { NextResponse } from "next/server";
import { fetchAllStates } from "@/lib/opensky";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bbox = url.searchParams.get("bbox")?.split(",").map(Number);
  const states = bbox?.length===4
    ? await fetchAllStates({ lamin:bbox[0], lomin:bbox[1], lamax:bbox[2], lomax:bbox[3] })
    : await fetchAllStates();

  if (!states.length) return NextResponse.json({ icao24: null, count: 0 });
  const s = states[Math.floor(Math.random()*states.length)];
  const [icao24, callsign, origin_country] = s;
  return NextResponse.json({ icao24, callsign, origin_country, count: states.length });
}
'@;

  "$base\app\api\opensky\by-tail\route.ts" = @'
import { NextResponse } from "next/server";
import { fetchAllStates } from "@/lib/opensky";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tail = (url.searchParams.get("tail") || "").trim().toUpperCase();
  if (!tail) return NextResponse.json({ error: "tail required" }, { status: 400 });

  const states = await fetchAllStates();
  const match = states.find(s => (s[1]?.trim().toUpperCase() || "") === tail);
  if (!match) return NextResponse.json({ icao24: null, active: false });

  const [icao24, callsign, , , last_contact, lon, lat] = match;
  return NextResponse.json({ icao24, callsign, active: true, last_contact, lon, lat });
}
'@;

  "$base\app\components\Controls.tsx" = @'
"use client";
import { useState } from "react";

export default function Controls() {
  const [hex,setHex]=useState(""); const [tail,setTail]=useState(""); const [status,setStatus]=useState("");

  async function getRandom(bbox?:string){
    setStatus("loading");
    const res = await fetch(bbox?`/api/opensky/active?bbox=${bbox}`:"/api/opensky/active");
    const d = await res.json();
    if(!d.icao24) setStatus("no aircraft found");
    else { setHex(d.icao24); setStatus(`picked ${d.icao24}${d.callsign?` (${d.callsign.trim()})`:""}`); }
  }
  async function lookupTail(){
    if(!tail) return;
    setStatus("loading");
    const d = await (await fetch(`/api/opensky/by-tail?tail=${encodeURIComponent(tail)}`)).json();
    if(!d.active) setStatus("tail not active now"); else { setHex(d.icao24); setStatus(`active as ${d.callsign}`); }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 p-6">
      <div className="flex gap-2">
        <button onClick={()=>getRandom()} className="px-3 py-2 rounded-2xl shadow">random</button>
        <button onClick={()=>getRandom("40.0,-75.5,41.5,-72.5")} className="px-3 py-2 rounded-2xl shadow">random NYC area</button>
      </div>
      <div className="flex gap-2">
        <input value={hex} onChange={e=>setHex(e.target.value)} placeholder="enter hex (icao24)" className="border rounded-xl px-3 py-2 w-full"/>
      </div>
      <div className="flex gap-2">
        <input value={tail} onChange={e=>setTail(e.target.value)} placeholder="enter tail (e.g., N123AB)" className="border rounded-xl px-3 py-2 w-full"/>
        <button onClick={lookupTail} className="px-3 py-2 rounded-2xl shadow">lookup</button>
      </div>
      <div className="text-sm opacity-80">{status}</div>
    </div>
  );
}
'@;

  "$base\app\page.tsx" = @'
import dynamic from "next/dynamic";
const Controls = dynamic(()=>import("./components/Controls"),{ssr:false});

export default function Page(){
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold mb-4">TrackMyBird</h1>
      <p className="mb-6">Pick a live ICAO24 hex or enter one manually.</p>
      {/* @ts-expect-error Server component importing client component */}
      <Controls/>
    </main>
  );
}
'@
}

foreach ($path in $files.Keys) {
  $dir = Split-Path $path
  if (!(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -Path $path -Value $files[$path] -Encoding UTF8
}

Write-Host "✅ TrackMyBird core files written.  Run 'npm run dev' next."
