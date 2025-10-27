/**
 * Flight status adapter with provider cascade and caching
 * Providers: FlightAware (primary) → AviationStack (fallback) → airport-data.com
 */

import { icaoToNNumber } from './nnumber-converter';

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

// FlightAware provider - fetches metadata, track points, and waypoints
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
    
    console.log('[FlightAware] Raw response:', JSON.stringify(data, null, 2));
    
    if (!data.flights || data.flights.length === 0) {
      console.log('[FlightAware] No flights array or empty flights array');
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
    
    // Fetch track data and waypoints if available
    if (flight.fa_flight_id && apiKey) {
      // Fetch track points
      try {
        const trackUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(flight.fa_flight_id)}/track`;
        console.log(`[FlightAware] Fetching track from: ${trackUrl}`);
        const trackResponse = await fetch(trackUrl, {
          headers: { "x-apikey": apiKey },
          cache: "no-store",
        });
        
        console.log(`[FlightAware] Track response status: ${trackResponse.status}`);
        
        if (trackResponse.ok) {
          const trackData: any = await trackResponse.json();
          console.log(`[FlightAware] Track data:`, JSON.stringify(trackData, null, 2));
          if (trackData.positions && Array.isArray(trackData.positions)) {
            result.points = trackData.positions
              .filter((pos: any) => 
                Number.isFinite(pos.latitude) && 
                Number.isFinite(pos.longitude)
              )
              .map((pos: any) => ({
                lat: pos.latitude,
                lon: pos.longitude,
                ts: pos.timestamp ? Math.floor(new Date(pos.timestamp).getTime() / 1000) : undefined,
                alt_ft: typeof pos.altitude === "number" ? Math.round(pos.altitude) : undefined,
                hdg: typeof pos.heading === "number" ? Math.round(pos.heading) : undefined,
              }));
            console.log(`[FlightAware] Parsed ${result.points.length} track points`);
          } else {
            console.log(`[FlightAware] No positions array in track data`);
          }
        } else {
          console.log(`[FlightAware] Track request failed with status ${trackResponse.status}`);
        }
      } catch (e) {
        // Track data is optional for now, don't fail the whole request
        console.error('[FlightAware] Track fetch failed:', e);
      }
      
      // Fetch waypoints
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
 * Uses FlightAware as primary data source
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
  
  // Validate US-only (hex must start with 'a')
  if (hex && !hex.startsWith('a')) {
    throw new Error("US-registered aircraft only (hex must start with 'a')");
  }
  
  // Start with base data structure
  let result: FlightStatus = {
    hex: hex ? hex.toUpperCase() : '',
    tail: tail || null,
    points: [],
    originAirport: null,
    destinationAirport: null,
    originInfo: null,
    destinationInfo: null,
    firstSeen: null,
    lastSeen: null,
    waypoints: null,
  };
  
  let providerData: Partial<FlightStatus> | null = null;
  let rateLimitedProvider: string | null = null;
  
  // Determine identifier to use for FlightAware lookup
  // FlightAware requires tail numbers, so convert hex to tail if needed
  let identifier = tail;
  if (!identifier && hex) {
    // Convert hex to tail number for FlightAware
    const converted = icaoToNNumber(hex);
    if (converted) {
      identifier = converted;
      result.tail = converted; // Store the converted tail number
      console.log(`[Converter] Converted ${hex.toUpperCase()} → ${converted}`);
    } else {
      throw new Error("Failed to convert hex code to N-number");
    }
  }
  
  if (identifier) {
    // Try FlightAware (primary provider for everything)
    try {
      console.log(`[FlightAware] Fetching data for: ${identifier}`);
      providerData = await fetchFromFlightAware(identifier);
      if (providerData) {
        console.log(`[FlightAware] Success! Got ${providerData.points?.length || 0} points`);
        // Merge all data from FlightAware including track points
        Object.assign(result, providerData);
      } else {
        console.log(`[FlightAware] No data returned for ${identifier}`);
      }
    } catch (error) {
      console.log(`[FlightAware] Error:`, error);
      if (error instanceof ProviderError) {
        if (error.statusCode === 429) {
          rateLimitedProvider = error.provider;
        } else if (!error.retryable) {
          throw new Error(`FlightAware error: ${error.message}`);
        }
      }
    }
    
    // If FlightAware didn't provide origin/destination, try AviationStack as fallback
    if ((!result.originAirport || !result.destinationAirport) && tail) {
      try {
        providerData = await fetchFromAviationStack(tail);
        if (providerData) {
          result.originAirport = result.originAirport || providerData.originAirport || null;
          result.destinationAirport = result.destinationAirport || providerData.destinationAirport || null;
        }
      } catch (error) {
        if (error instanceof ProviderError && error.statusCode === 429) {
          rateLimitedProvider = rateLimitedProvider || error.provider;
        }
        // AviationStack is last fallback, don't throw
      }
    }
  }
  
  // If we got rate limited and have no data at all, throw
  if (rateLimitedProvider && result.points.length === 0 && !result.originAirport) {
    throw new Error(`rate_limited:${rateLimitedProvider}`);
  }
  
  // If we have no track data at all, aircraft not found
  if (result.points.length === 0) {
    throw new Error("Aircraft not found or no track data available");
  }
  
  // Fetch airport coordinates if we have airport codes but missing lat/lon
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
