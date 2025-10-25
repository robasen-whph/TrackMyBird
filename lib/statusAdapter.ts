/**
 * Flight status adapter with provider cascade and caching
 * Providers: FlightAware → OpenSky → AviationStack → airport-data.com
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { appConfig } from "@/config/app";

// Types
export interface FlightStatusParams {
  hex?: string;
  tail?: string;
}

export interface Point {
  lat: number;
  lon: number;
  ts?: number;
  alt_ft?: number;
  hdg?: number;
}

export interface AirportInfo {
  icao: string;
  name: string;
  city?: string;
  country: string;
  country_code: string;
  lat?: number;
  lon?: number;
}

export interface Waypoint {
  name: string;
  lat: number;
  lon: number;
}

export interface FlightStatus {
  hex: string;
  tail: string | null;
  points: Point[];
  originAirport: string | null;
  destinationAirport: string | null;
  originInfo: AirportInfo | null;
  destinationInfo: AirportInfo | null;
  firstSeen: number | null;
  lastSeen: number | null;
  waypoints: Waypoint[] | null;
}

// In-memory cache with 15-second TTL
interface CacheEntry {
  data: FlightStatus;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15000; // 15 seconds

function getCacheKey(params: FlightStatusParams): string {
  if (params.hex) return `hex:${params.hex}`;
  if (params.tail) return `tail:${params.tail}`;
  return "";
}

function getFromCache(key: string): FlightStatus | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

function setInCache(key: string, data: FlightStatus): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// OpenSky token management
function getConfig() {
  const configPath = join(process.cwd(), "config.json");
  const configFile = readFileSync(configPath, "utf-8");
  return JSON.parse(configFile);
}

function updateConfig(updates: Partial<{OS_ACCESS_TOKEN: string; OS_TOKEN_EXPIRATION: number}>) {
  const configPath = join(process.cwd(), "config.json");
  const config = getConfig();
  const newConfig = { ...config, ...updates };
  writeFileSync(configPath, JSON.stringify(newConfig, null, 2), "utf-8");
}

async function refreshOpenSkyToken() {
  const config = getConfig();
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: appConfig.opensky.clientId,
    client_secret: process.env.OPENSKY_CLIENT_SECRET || "",
  });
  
  const r = await fetch(config.OS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  
  if (!r.ok) {
    throw new Error(`OpenSky token refresh failed: ${r.status}`);
  }
  
  const data = await r.json();
  const newToken = data.access_token;
  const expiresIn = data.expires_in || 1800;
  const expiration = Date.now() + (expiresIn * 1000);
  
  updateConfig({
    OS_ACCESS_TOKEN: newToken,
    OS_TOKEN_EXPIRATION: expiration,
  });
  
  return newToken;
}

async function getValidOpenSkyToken(): Promise<string> {
  const config = getConfig();
  const now = Date.now();
  const expiration = config.OS_TOKEN_EXPIRATION || 0;
  
  if (now >= expiration - 60000) {
    return await refreshOpenSkyToken();
  }
  
  return config.OS_ACCESS_TOKEN;
}

// Provider error types
class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

// Utility: Clean city names
function cleanCityName(city: string | undefined): string | undefined {
  if (!city) return undefined;
  const withoutTimezone = city.includes('/') ? city.split('/').pop() || city : city;
  return withoutTimezone.replace(/_/g, ' ');
}

// FlightAware provider
async function fetchFromFlightAware(tail: string): Promise<Partial<FlightStatus> | null> {
  const apiKey = process.env.FLIGHTAWARE_API_KEY;
  if (!apiKey) return null;
  
  try {
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(tail)}`;
    const response = await fetch(url, {
      headers: { "x-apikey": apiKey },
      cache: "no-store",
    });
    
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("Unauthorized", "flightaware", response.status, false);
    }
    
    if (response.status === 429) {
      throw new ProviderError("Rate limited", "flightaware", 429, true);
    }
    
    if (response.status >= 500) {
      throw new ProviderError("Server error", "flightaware", response.status, true);
    }
    
    if (!response.ok) {
      return null;
    }
    
    const data: any = await response.json();
    
    if (!data.flights || data.flights.length === 0) {
      return null;
    }
    
    const flight = data.flights[0];
    const result: Partial<FlightStatus> = {};
    
    if (flight.origin) {
      result.originAirport = flight.origin.code_icao || flight.origin.code_iata || flight.origin.code;
      result.originInfo = {
        icao: result.originAirport,
        name: flight.origin.name,
        city: cleanCityName(flight.origin.city),
        country: "Unknown",
        country_code: "XX",
        lat: undefined,
        lon: undefined,
      };
    }
    
    if (flight.destination) {
      result.destinationAirport = flight.destination.code_icao || flight.destination.code_iata || flight.destination.code;
      result.destinationInfo = {
        icao: result.destinationAirport,
        name: flight.destination.name,
        city: cleanCityName(flight.destination.city),
        country: "Unknown",
        country_code: "XX",
        lat: undefined,
        lon: undefined,
      };
    }
    
    if (flight.scheduled_out) {
      result.firstSeen = new Date(flight.scheduled_out).getTime() / 1000;
    }
    if (flight.scheduled_in) {
      result.lastSeen = new Date(flight.scheduled_in).getTime() / 1000;
    }
    
    // Fetch waypoints if available
    if (flight.fa_flight_id && apiKey) {
      try {
        const routeUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(flight.fa_flight_id)}/route`;
        const routeResponse = await fetch(routeUrl, {
          headers: { "x-apikey": apiKey },
          cache: "no-store",
        });
        
        if (routeResponse.ok) {
          const routeData: any = await routeResponse.json();
          if (routeData.waypoints && Array.isArray(routeData.waypoints)) {
            result.waypoints = routeData.waypoints
              .filter((wp: any) => 
                Number.isFinite(wp.latitude) && 
                Number.isFinite(wp.longitude)
              )
              .map((wp: any) => ({
                name: wp.name || wp.ident || 'WAYPOINT',
                lat: wp.latitude,
                lon: wp.longitude,
              }));
          }
        }
      } catch (e) {
        // Waypoints are optional, don't fail the whole request
      }
    }
    
    return result;
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    throw new ProviderError(
      error instanceof Error ? error.message : String(error),
      "flightaware",
      undefined,
      true
    );
  }
}

// OpenSky provider
async function fetchFromOpenSky(hex: string, token: string): Promise<Partial<FlightStatus> | null> {
  try {
    // Try /flights endpoint for flight metadata
    const now = Math.floor(Date.now() / 1000);
    const begin = now - 7 * 24 * 3600;
    const flightUrl = `https://opensky-network.org/api/flights/aircraft?icao24=${hex}&begin=${begin}&end=${now}`;
    
    const response = await fetch(flightUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("Unauthorized", "opensky", response.status, false);
    }
    
    if (response.status === 429) {
      throw new ProviderError("Rate limited", "opensky", 429, true);
    }
    
    if (response.status >= 500) {
      throw new ProviderError("Server error", "opensky", response.status, true);
    }
    
    if (!response.ok) {
      return null;
    }
    
    const flights: any = await response.json();
    
    if (!flights || flights.length === 0) {
      return null;
    }
    
    const latestFlight = flights[flights.length - 1];
    const result: Partial<FlightStatus> = {
      originAirport: latestFlight.estDepartureAirport || null,
      destinationAirport: latestFlight.estArrivalAirport || null,
      firstSeen: latestFlight.firstSeen || null,
      lastSeen: latestFlight.lastSeen || null,
    };
    
    return result;
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    throw new ProviderError(
      error instanceof Error ? error.message : String(error),
      "opensky",
      undefined,
      true
    );
  }
}

// AviationStack provider
async function fetchFromAviationStack(tail: string): Promise<Partial<FlightStatus> | null> {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) return null;
  
  try {
    const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${tail}&limit=1`;
    const response = await fetch(url);
    
    if (response.status === 401 || response.status === 403) {
      throw new ProviderError("Unauthorized", "aviationstack", response.status, false);
    }
    
    if (response.status === 429) {
      throw new ProviderError("Rate limited", "aviationstack", 429, true);
    }
    
    if (response.status >= 500) {
      throw new ProviderError("Server error", "aviationstack", response.status, true);
    }
    
    if (!response.ok) {
      return null;
    }
    
    const data: any = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return null;
    }
    
    const flight = data.data[0];
    return {
      originAirport: flight.departure?.icao || flight.departure?.iata || null,
      destinationAirport: flight.arrival?.icao || flight.arrival?.iata || null,
    };
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    throw new ProviderError(
      error instanceof Error ? error.message : String(error),
      "aviationstack",
      undefined,
      true
    );
  }
}

// Airport data provider
async function fetchAirportInfo(icao: string): Promise<AirportInfo | null> {
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

/**
 * Get flight status with provider cascade and caching
 * Validates US-only aircraft (hex must start with 'a')
 */
export async function getFlightStatus(params: FlightStatusParams): Promise<FlightStatus> {
  // Prefer hex if both provided
  const hex = params.hex?.toLowerCase();
  const tail = params.tail?.toUpperCase();
  
  if (!hex && !tail) {
    throw new Error("Either hex or tail must be provided");
  }
  
  // Check cache first
  const cacheKey = getCacheKey(params);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }
  
  // For now, we need hex to fetch track data from OpenSky
  // If only tail provided, we'd need to convert it first
  if (!hex) {
    throw new Error("Hex code required for track data");
  }
  
  // Validate US-only (hex must start with 'a')
  if (!hex.startsWith('a')) {
    throw new Error("US-registered aircraft only (hex must start with 'a')");
  }
  
  // Fetch track data from OpenSky (this is always needed for points)
  // Only get token when actually making the request
  const trackUrl = `https://opensky-network.org/api/tracks/all?icao24=${hex}&time=0`;
  let token: string;
  
  try {
    token = await getValidOpenSkyToken();
  } catch (e) {
    throw new Error("Failed to get OpenSky token");
  }
  
  const trackResponse = await fetch(trackUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  
  if (trackResponse.status === 404) {
    throw new Error("Aircraft not found or no track data available");
  }
  
  if (!trackResponse.ok) {
    throw new Error(`OpenSky track error: ${trackResponse.status}`);
  }
  
  const trackData: any = await trackResponse.json();
  
  // Extract track points
  const path: any[] = trackData?.path || [];
  const points: Point[] = path
    .map((p) => ({
      lat: p[1],
      lon: p[2],
      ts: p[0],
      alt_ft: typeof p[3] === "number" ? Math.round(p[3] * 3.28084) : undefined,
      hdg: typeof p[4] === "number" ? Math.round(p[4]) : undefined,
    }))
    .filter((pt) => Number.isFinite(pt.lat) && Number.isFinite(pt.lon));
  
  const callsign = trackData?.callsign?.trim() || tail || null;
  
  // Start with base data
  let result: FlightStatus = {
    hex: hex.toUpperCase(),
    tail: callsign,
    points,
    originAirport: null,
    destinationAirport: null,
    originInfo: null,
    destinationInfo: null,
    firstSeen: null,
    lastSeen: null,
    waypoints: null,
  };
  
  // Try provider cascade for flight metadata (origin/destination)
  let providerData: Partial<FlightStatus> | null = null;
  let rateLimitedProvider: string | null = null;
  
  if (callsign && callsign.length >= 3) {
    // Try FlightAware first
    try {
      providerData = await fetchFromFlightAware(callsign);
      if (providerData) {
        Object.assign(result, providerData);
      }
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.statusCode === 429) {
          rateLimitedProvider = error.provider;
        } else if (!error.retryable) {
          // Non-retryable error (401/403), throw immediately
          rateLimitedProvider = error.provider;
        }
      }
      // Fall through to next provider
    }
    
    // If FlightAware didn't work, try OpenSky
    if (!result.originAirport || !result.destinationAirport) {
      try {
        // Re-use token we already got earlier
        providerData = await fetchFromOpenSky(hex, token);
        if (providerData) {
          result.originAirport = result.originAirport || providerData.originAirport || null;
          result.destinationAirport = result.destinationAirport || providerData.destinationAirport || null;
          result.firstSeen = result.firstSeen || providerData.firstSeen || null;
          result.lastSeen = result.lastSeen || providerData.lastSeen || null;
        }
      } catch (error) {
        if (error instanceof ProviderError && error.statusCode === 429) {
          rateLimitedProvider = rateLimitedProvider || error.provider;
        }
        // Fall through to next provider
      }
    }
    
    // If still no data, try AviationStack
    if (!result.originAirport || !result.destinationAirport) {
      try {
        providerData = await fetchFromAviationStack(callsign);
        if (providerData) {
          result.originAirport = result.originAirport || providerData.originAirport || null;
          result.destinationAirport = result.destinationAirport || providerData.destinationAirport || null;
        }
      } catch (error) {
        if (error instanceof ProviderError && error.statusCode === 429) {
          rateLimitedProvider = rateLimitedProvider || error.provider;
        }
        // This is the last provider, errors are logged but not thrown
      }
    }
  }
  
  // If all providers rate-limited, throw error
  if (rateLimitedProvider && !result.originAirport && !result.destinationAirport) {
    throw new Error(`rate_limited:${rateLimitedProvider}`);
  }
  
  // Fetch airport coordinates if we have airport codes
  if (result.originAirport && (!result.originInfo?.lat || !result.originInfo?.lon)) {
    const airportData = await fetchAirportInfo(result.originAirport);
    if (airportData) {
      result.originInfo = {
        ...airportData,
        name: result.originInfo?.name || airportData.name,
        city: result.originInfo?.city || airportData.city,
      };
    }
  }
  
  if (result.destinationAirport && (!result.destinationInfo?.lat || !result.destinationInfo?.lon)) {
    const airportData = await fetchAirportInfo(result.destinationAirport);
    if (airportData) {
      result.destinationInfo = {
        ...airportData,
        name: result.destinationInfo?.name || airportData.name,
        city: result.destinationInfo?.city || airportData.city,
      };
    }
  }
  
  // Cache the result
  setInCache(cacheKey, result);
  
  return result;
}
