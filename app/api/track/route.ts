import { NextResponse } from "next/server";

// ---- OAuth token ----
async function getToken() {
  const id = process.env.OPENSKY_CLIENT_ID!;
  const secret = process.env.OPENSKY_CLIENT_SECRET!;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: id,
    client_secret: secret,
  });
  const r = await fetch(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" }
  );
  if (!r.ok) throw new Error(`token ${r.status}`);
  const j = await r.json();
  return j.access_token as string;
}

async function getJSON<T>(url: string, headers: Record<string, string>) {
  const r = await fetch(url, { headers, cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return r.json() as Promise<T>;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hex = (searchParams.get("hex") || "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(hex)) return NextResponse.json({ message: "bad_hex" }, { status: 400 });

  // try OAuth tracks at several times
  let points: Array<{ lat: number; lon: number; ts?: number; alt_ft?: number; hdg?: number; gs_kt?: number }> = [];
  let tail: string | null = null;

  try {
    const token = await getToken();
    const auth = { Accept: "application/json", Authorization: `Bearer ${token}` };

    const now = Math.floor(Date.now() / 1000);
    const tries = [0, now, now - 1800, now - 3600, now - 2 * 3600];

    for (const t of tries) {
      try {
        const trk: any = await getJSON<any>(
          `https://opensky-network.org/api/tracks/all?icao24=${hex}&time=${t}`,
          auth
        );
        const path: any[] = trk?.path || [];
        if (path.length) {
          points = path
            .map((p) => ({
              lat: p.latitude,
              lon: p.longitude,
              ts: p.time,
              alt_ft: typeof p.baroAltitude === "number" ? Math.round(p.baroAltitude * 3.28084) : undefined,
              hdg: typeof p.trueTrack === "number" ? Math.round(p.trueTrack) : undefined,
              gs_kt: undefined,
            }))
            .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lon));
          tail = trk?.callsign ?? null;
          if (points.length) break;
        }
      } catch (e) {
        // ignore 404s and keep trying
      }
    }
  } catch (e) {
    // token failure: fall through to state fallback below
  }

  // fallback: live state (unauthenticated)
  if (!points.length) {
    try {
      const state: any = await getJSON<any>(
        `https://opensky-network.org/api/states/all?icao24=${hex}`,
        { Accept: "application/json" }
      );
      const row = state?.states?.[0];
      if (row && Number.isFinite(row[6]) && Number.isFinite(row[5])) {
        points = [
          {
            lat: row[6], // latitude
            lon: row[5], // longitude
            ts: typeof row[4] === "number" ? row[4] : undefined, // last contact
            alt_ft: typeof row[13] === "number" ? Math.round(row[13] * 3.28084) : undefined, // geo alt
            hdg: typeof row[10] === "number" ? Math.round(row[10]) : undefined, // true track
            gs_kt: undefined,
          },
        ];
        tail = typeof row[1] === "string" ? row[1].trim() || null : tail;
      }
    } catch {}
  }

  return NextResponse.json({
    hex: hex.toUpperCase(),
    tail,
    points,
  });
}
