import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hex = (searchParams.get("hex") || "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return NextResponse.json({ message: "bad_hex" }, { status: 400 });
  }

  const r = await fetch(`https://opensky-network.org/api/states/all?icao24=${hex}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!r.ok) {
    return NextResponse.json({ message: `upstream_${r.status}` }, { status: 502 });
  }

  const j: any = await r.json();
  const row = j?.states?.[0];
  if (!row || !Number.isFinite(row[6]) || !Number.isFinite(row[5])) {
    return NextResponse.json({ hex: hex.toUpperCase(), point: null });
  }

  const point = {
    lat: row[6],
    lon: row[5],
    ts: typeof row[4] === "number" ? row[4] : undefined,    // last contact
    alt_ft: typeof row[13] === "number" ? Math.round(row[13] * 3.28084) : undefined,
    hdg: typeof row[10] === "number" ? Math.round(row[10]) : undefined,
    gs_kt: undefined,
  };

  const tail = typeof row[1] === "string" ? row[1].trim() || null : null;

  return NextResponse.json({ hex: hex.toUpperCase(), tail, point });
}
