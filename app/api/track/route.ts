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

// Clean city names by removing timezone prefixes like "America/Los_Angeles" -> "Los Angeles"
function cleanCityName(city: string | undefined): string | undefined {
  if (!city) return undefined;
  
  // Remove timezone prefix (e.g., "America/Los_Angeles" -> "Los_Angeles")
  const withoutTimezone = city.includes('/') ? city.split('/').pop() || city : city;
  
  // Replace underscores with spaces (e.g., "Los_Angeles" -> "Los Angeles")
  return withoutTimezone.replace(/_/g, ' ');
}

// Fetch flight data from FlightAware by tail number
async function fetchFlightAwareData(tail: string) {
  const apiKey = process.env.FLIGHTAWARE_API_KEY;
  if (!apiKey) {
    console.log('[FLIGHTAWARE] API key not configured');
    return null;
  }

  try {
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(tail)}`;
    console.log(`[FLIGHTAWARE] Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "x-apikey": apiKey,
      },
      cache: "no-store",
    });
    
    if (!response.ok) {
      console.log(`[FLIGHTAWARE] Request failed: ${response.status}`);
      return null;
    }
    
    const data: any = await response.json();
    
    // Get the most recent flight (first in the array, sorted by scheduled_out desc)
    if (data.flights && data.flights.length > 0) {
      const flight = data.flights[0];
      
      return {
        origin: flight.origin ? {
          code: flight.origin.code_icao || flight.origin.code_iata || flight.origin.code,
          name: flight.origin.name,
          city: cleanCityName(flight.origin.city),
          lat: undefined, // FlightAware doesn't provide coordinates directly
          lon: undefined,
        } : null,
        destination: flight.destination ? {
          code: flight.destination.code_icao || flight.destination.code_iata || flight.destination.code,
          name: flight.destination.name,
          city: cleanCityName(flight.destination.city),
          lat: undefined,
          lon: undefined,
        } : null,
        fa_flight_id: flight.fa_flight_id,
        ident: flight.ident || flight.ident_icao,
        scheduled_out: flight.scheduled_out,
        scheduled_in: flight.scheduled_in,
        actual_off: flight.actual_off,
        actual_on: flight.actual_on,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[FLIGHTAWARE] Error:', error);
    return null;
  }
}

// Fetch IFR route waypoints from FlightAware
async function fetchFlightAwareRoute(faFlightId: string) {
  const apiKey = process.env.FLIGHTAWARE_API_KEY;
  if (!apiKey) {
    console.log('[FLIGHTAWARE ROUTE] API key not configured');
    return null;
  }

  try {
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(faFlightId)}/route`;
    console.log(`[FLIGHTAWARE ROUTE] Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "x-apikey": apiKey,
      },
      cache: "no-store",
    });
    
    if (!response.ok) {
      console.log(`[FLIGHTAWARE ROUTE] Request failed: ${response.status}`);
      return null;
    }
    
    const data: any = await response.json();
    
    // Extract waypoints with coordinates
    if (data.waypoints && Array.isArray(data.waypoints)) {
      const waypoints = data.waypoints
        .filter((wp: any) => 
          wp.latitude !== undefined && 
          wp.longitude !== undefined &&
          Number.isFinite(wp.latitude) && 
          Number.isFinite(wp.longitude)
        )
        .map((wp: any) => ({
          name: wp.name || wp.ident || 'WAYPOINT',
          lat: wp.latitude,
          lon: wp.longitude,
        }));
      
      console.log(`[FLIGHTAWARE ROUTE] Found ${waypoints.length} waypoints`);
      return waypoints;
    }
    
    console.log('[FLIGHTAWARE ROUTE] No waypoints in response');
    return null;
  } catch (error) {
    console.error('[FLIGHTAWARE ROUTE] Error:', error);
    return null;
  }
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
      lat: data.latitude ? parseFloat(data.latitude) : undefined,
      lon: data.longitude ? parseFloat(data.longitude) : undefined,
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
    
    let trackData: any;
    try {
      trackData = await fetchWithAuth(trackUrl, token);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      // If OpenSky returns 404, the aircraft doesn't exist or has no track data
      if (errorMsg.includes('404')) {
        console.log(`[TRACK ${hex}] Aircraft not found (404)`);
        return NextResponse.json({ message: "Aircraft not found or no track data available" }, { status: 404 });
      }
      // For other errors, rethrow
      throw e;
    }
    
    console.log(`[TRACK ${hex}] Response: path=${trackData?.path?.length || 0} points, callsign=${trackData?.callsign}`);

    // Extract track points
    let points: Array<{ lat: number; lon: number; ts?: number; alt_ft?: number; hdg?: number }> = [];
    const path: any[] = trackData?.path || [];
    
    if (path.length > 0) {
      // OpenSky /tracks/all returns: [time, latitude, longitude, baroAltitude, trueTrack, onGround]
      points = path
        .map((p) => ({
          lat: p[1],  // latitude
          lon: p[2],  // longitude
          ts: p[0],   // time
          alt_ft: typeof p[3] === "number" ? Math.round(p[3] * 3.28084) : undefined,  // baroAltitude
          hdg: typeof p[4] === "number" ? Math.round(p[4]) : undefined,  // trueTrack
        }))
        .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lon));
      
      console.log(`[TRACK ${hex}] Extracted ${points.length} valid points`);
    }

    // Extract flight metadata
    const tail = trackData?.callsign?.trim() || null;
    let originAirport: string | null = null;
    let destinationAirport: string | null = null;
    let originInfo: any = null;
    let destinationInfo: any = null;
    let firstSeen: number | null = null;
    let lastSeen: number | null = null;
    let waypoints: Array<{ name: string; lat: number; lon: number }> | null = null;

    // PRIMARY: Try FlightAware first (most reliable for origin/destination)
    // Only call FlightAware if we have a valid-looking callsign (at least 3 chars)
    // OpenSky sometimes returns incomplete callsigns like "N" which will fail
    if (tail && tail.length >= 3) {
      const faData = await fetchFlightAwareData(tail);
      
      if (faData) {
        console.log(`[TRACK ${hex}] FlightAware success: ${faData.origin?.code} → ${faData.destination?.code}`);
        
        // Fetch waypoints if we have a fa_flight_id (IFR flights only)
        if (faData.fa_flight_id) {
          waypoints = await fetchFlightAwareRoute(faData.fa_flight_id);
        }
        
        if (faData.origin) {
          originAirport = faData.origin.code;
          originInfo = {
            icao: faData.origin.code,
            name: faData.origin.name,
            city: faData.origin.city,
            country: "Unknown", // FlightAware doesn't provide country in flights endpoint
            country_code: "XX",
            lat: faData.origin.lat,
            lon: faData.origin.lon,
          };
        }
        
        if (faData.destination) {
          destinationAirport = faData.destination.code;
          destinationInfo = {
            icao: faData.destination.code,
            name: faData.destination.name,
            city: faData.destination.city,
            country: "Unknown",
            country_code: "XX",
            lat: faData.destination.lat,
            lon: faData.destination.lon,
          };
        }
        
        // Use FlightAware timing data
        if (faData.scheduled_out) {
          firstSeen = new Date(faData.scheduled_out).getTime() / 1000;
        }
        if (faData.scheduled_in) {
          lastSeen = new Date(faData.scheduled_in).getTime() / 1000;
        }
      } else {
        console.log(`[TRACK ${hex}] FlightAware returned no data for tail ${tail}`);
      }
    } else if (tail && tail.length < 3) {
      console.log(`[TRACK ${hex}] Skipping FlightAware - callsign too short: "${tail}"`);
    }

    // FALLBACK: Try OpenSky /flights endpoint if FlightAware didn't work
    if (!originAirport || !destinationAirport) {
      try {
        const now = Math.floor(Date.now() / 1000);
        const begin = now - 7 * 24 * 3600; // last 7 days
        const flightUrl = `https://opensky-network.org/api/flights/aircraft?icao24=${hex}&begin=${begin}&end=${now}`;
        const flights: any = await fetchWithAuth(flightUrl, token);
        
        if (flights && flights.length > 0) {
          const latestFlight = flights[flights.length - 1];
          if (!originAirport) {
            originAirport = latestFlight.estDepartureAirport || null;
          }
          if (!destinationAirport) {
            destinationAirport = latestFlight.estArrivalAirport || null;
          }
          if (!firstSeen) {
            firstSeen = latestFlight.firstSeen || null;
          }
          if (!lastSeen) {
            lastSeen = latestFlight.lastSeen || null;
          }
          console.log(`[TRACK ${hex}] OpenSky flight: ${originAirport} → ${destinationAirport}`);
        }
      } catch (e) {
        console.log(`[TRACK ${hex}] Could not fetch OpenSky flight metadata:`, e);
      }
    }

    // FALLBACK 2: Try AviationStack if still no data
    if ((!originAirport || !destinationAirport) && tail && process.env.AVIATIONSTACK_API_KEY) {
      try {
        console.log(`[TRACK ${hex}] Trying AviationStack with tail ${tail}`);
        const aviationStackUrl = `http://api.aviationstack.com/v1/flights?access_key=${process.env.AVIATIONSTACK_API_KEY}&flight_iata=${tail}&limit=1`;
        const asResponse = await fetch(aviationStackUrl);
        
        if (asResponse.ok) {
          const asData: any = await asResponse.json();
          if (asData.data && asData.data.length > 0) {
            const flight = asData.data[0];
            if (!originAirport) {
              originAirport = flight.departure?.icao || flight.departure?.iata || null;
            }
            if (!destinationAirport) {
              destinationAirport = flight.arrival?.icao || flight.arrival?.iata || null;
            }
            console.log(`[TRACK ${hex}] AviationStack flight: ${originAirport} → ${destinationAirport}`);
          }
        }
      } catch (e) {
        console.log(`[TRACK ${hex}] Could not fetch AviationStack data:`, e);
      }
    }

    // Fetch airport coordinates from airport-data.com if missing
    // FlightAware doesn't provide coordinates, so we always need to fetch them
    if (originAirport && (!originInfo?.lat || !originInfo?.lon)) {
      const airportData = await fetchAirportInfo(originAirport);
      if (airportData) {
        // Merge FlightAware data (name, city) with airport-data.com coordinates
        originInfo = {
          ...airportData,
          name: originInfo?.name || airportData.name,
          city: originInfo?.city || airportData.city,
        };
      }
    }
    
    if (destinationAirport && (!destinationInfo?.lat || !destinationInfo?.lon)) {
      const airportData = await fetchAirportInfo(destinationAirport);
      if (airportData) {
        // Merge FlightAware data (name, city) with airport-data.com coordinates
        destinationInfo = {
          ...airportData,
          name: destinationInfo?.name || airportData.name,
          city: destinationInfo?.city || airportData.city,
        };
      }
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
      waypoints, // IFR route waypoints (null for VFR or if unavailable)
    });

  } catch (error: any) {
    console.error(`[TRACK ${hex}] Error:`, error.message);
    return NextResponse.json(
      { message: "track_error", error: error.message },
      { status: 500 }
    );
  }
}
