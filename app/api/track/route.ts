import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

// Read config.json server-side only
function getConfig() {
  const configPath = join(process.cwd(), "config.json");
  const configFile = readFileSync(configPath, "utf-8");
  return JSON.parse(configFile);
}

// Update config.json with new token and expiration
function updateConfig(updates: Partial<{OS_ACCESS_TOKEN: string; OS_TOKEN_EXPIRATION: number}>) {
  const configPath = join(process.cwd(), "config.json");
  const config = getConfig();
  const newConfig = { ...config, ...updates };
  writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf-8");
}

// Refresh OAuth token using client credentials
async function refreshToken() {
  const config = getConfig();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.OPENSKY_CLIENT_ID || "",
    client_secret: process.env.OPENSKY_CLIENT_SECRET || "",
  });
  
  console.log("[TOKEN] Refreshing OAuth token...");
  const r = await fetch(config.OS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  
  if (!r.ok) {
    const errorText = await r.text();
    console.error(`[TOKEN] Refresh failed: ${r.status} - ${errorText}`);
    throw new Error(`Token refresh failed: ${r.status}`);
  }
  
  const data = await r.json();
  const newToken = data.access_token;
  const expiresIn = data.expires_in || 1800; // default 30 min
  const expiration = Date.now() + (expiresIn * 1000);
  
  // Update config.json
  updateConfig({
    OS_ACCESS_TOKEN: newToken,
    OS_TOKEN_EXPIRATION: expiration,
  });
  
  console.log(`[TOKEN] Refreshed successfully, expires in ${expiresIn}s`);
  return newToken;
}

// Get valid Bearer token (refresh if expired)
async function getValidToken(): Promise<string> {
  const config = getConfig();
  const now = Date.now();
  const expiration = config.OS_TOKEN_EXPIRATION || 0;
  
  // Refresh if expired or about to expire (within 60 seconds)
  if (now >= expiration - 60000) {
    console.log("[TOKEN] Token expired or expiring soon, refreshing...");
    return await refreshToken();
  }
  
  return config.OS_ACCESS_TOKEN;
}

// Make authenticated API call with retry on 401
async function fetchWithAuth<T>(url: string, token: string): Promise<T> {
  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  
  // If 401, refresh token and retry once
  if (r.status === 401) {
    console.log("[API] Got 401, refreshing token and retrying...");
    const newToken = await refreshToken();
    const retry = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${newToken}`,
      },
      cache: "no-store",
    });
    
    if (!retry.ok) {
      throw new Error(`API error after retry: ${retry.status}`);
    }
    return retry.json();
  }
  
  if (!r.ok) {
    throw new Error(`API error: ${r.status}`);
  }
  
  return r.json();
}

// Fetch airport info (unauthenticated, separate API)
async function fetchAirportInfo(icao: string) {
  try {
    const r = await fetch(
      `https://airport-data.com/api/ap_info.json?icao=${icao}`,
      { cache: "force-cache", next: { revalidate: 86400 } }
    );
    if (!r.ok) return null;
    const data: any = await r.json();
    return {
      icao: data.icao || icao,
      name: data.name || icao,
      city: data.location || undefined,
      country: data.country || "Unknown",
      country_code: data.country_code || "XX",
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hex = (searchParams.get("hex") || "").toLowerCase();
  
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return NextResponse.json({ message: "bad_hex" }, { status: 400 });
  }

  try {
    // Get valid Bearer token (will refresh if needed)
    const token = await getValidToken();
    console.log(`[TRACK ${hex}] Using Bearer token`);

    // Fetch flight track from /tracks/all with time=0 (current/latest)
    const trackUrl = `https://opensky-network.org/api/tracks/all?icao24=${hex}&time=0`;
    console.log(`[TRACK ${hex}] Fetching: ${trackUrl}`);
    
    const trackData: any = await fetchWithAuth(trackUrl, token);
    console.log(`[TRACK ${hex}] Response: path=${trackData?.path?.length || 0} points, callsign=${trackData?.callsign}`);

    // Extract track points
    let points: Array<{ lat: number; lon: number; ts?: number; alt_ft?: number; hdg?: number }> = [];
    const path: any[] = trackData?.path || [];
    
    if (path.length > 0) {
      points = path
        .map((p) => ({
          lat: p.latitude,
          lon: p.longitude,
          ts: p.time,
          alt_ft: typeof p.baroAltitude === "number" ? Math.round(p.baroAltitude * 3.28084) : undefined,
          hdg: typeof p.trueTrack === "number" ? Math.round(p.trueTrack) : undefined,
        }))
        .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lon));
      
      console.log(`[TRACK ${hex}] Extracted ${points.length} valid points`);
    }

    // Extract flight metadata
    const tail = trackData?.callsign?.trim() || null;
    let originAirport: string | null = null;
    let destinationAirport: string | null = null;
    let firstSeen: number | null = null;
    let lastSeen: number | null = null;

    // Try to get flight metadata from /flights endpoint
    try {
      const now = Math.floor(Date.now() / 1000);
      const begin = now - 7 * 24 * 3600; // last 7 days
      const flightUrl = `https://opensky-network.org/api/flights/aircraft?icao24=${hex}&begin=${begin}&end=${now}`;
      const flights: any = await fetchWithAuth(flightUrl, token);
      
      if (flights && flights.length > 0) {
        const latestFlight = flights[flights.length - 1];
        originAirport = latestFlight.estDepartureAirport || null;
        destinationAirport = latestFlight.estArrivalAirport || null;
        firstSeen = latestFlight.firstSeen || null;
        lastSeen = latestFlight.lastSeen || null;
        console.log(`[TRACK ${hex}] Flight: ${originAirport} → ${destinationAirport}`);
      }
    } catch (e) {
      console.log(`[TRACK ${hex}] Could not fetch flight metadata:`, e);
    }

    // Fetch airport details
    let originInfo = null;
    let destinationInfo = null;
    
    if (originAirport) {
      originInfo = await fetchAirportInfo(originAirport);
    }
    if (destinationAirport) {
      destinationInfo = await fetchAirportInfo(destinationAirport);
    }

    return NextResponse.json({
      hex: hex.toUpperCase(),
      tail,
      points,
      originAirport,
      destinationAirport,
      originInfo,
      destinationInfo,
      firstSeen,
      lastSeen,
    });

  } catch (error: any) {
    console.error(`[TRACK ${hex}] Error:`, error.message);
    return NextResponse.json(
      { message: "track_error", error: error.message },
      { status: 500 }
    );
  }
}
