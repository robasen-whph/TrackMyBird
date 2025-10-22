"use client";
import { useState } from "react";

export default function Controls() {
  const [hex,setHex]=useState(""); const [tail,setTail]=useState(""); const [status,setStatus]=useState("");

  async function getRandom(bbox?:string){
    try{
      setStatus("loading");
      const res = await fetch(bbox?`/api/opensky/active?bbox=${bbox}`:"/api/opensky/active");
      const d = await res.json();
      if(!res.ok) throw new Error(d?.error || "request_failed");
      if(!d.icao24) setStatus("no aircraft found");
      else { setHex(d.icao24); setStatus(`picked ${d.icao24}${d.callsign?` (${d.callsign.trim()})`:""}`); }
    }catch(e:any){ setStatus(`error: ${e?.message || e}`); }
  }
  async function lookupTail(){
    try{
      if(!tail) return;
      setStatus("loading");
      const res = await fetch(`/api/opensky/by-tail?tail=${encodeURIComponent(tail)}`);
      const d = await res.json();
      if(!res.ok) throw new Error(d?.error || "request_failed");
      if(!d.active) setStatus("tail not active now");
      else { setHex(d.icao24); setStatus(`active as ${d.callsign}`); }
    }catch(e:any){ setStatus(`error: ${e?.message || e}`); }
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
      <div className="text-sm opacity-80 whitespace-pre-wrap">{status}</div>
    </div>
  );
}
