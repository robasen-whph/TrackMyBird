import { NextResponse } from "next/server";
import { osGet } from "@/lib/opensky";
import { randomLimiter, getClientId } from "@/lib/rateLimiter";

// In-memory cache for active aircraft list (5 seconds)
let cachedAircraft: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5000; // 5 seconds

async function getActiveUSAircraft(): Promise<any[]> {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedAircraft && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedAircraft;
  }
  
  // Fetch fresh data
  const j = await osGet("https://opensky-network.org/api/states/all");
  const seen = new Set<string>(), airborne: any[] = [];
  
  for (const s of (j.states || [])) {
    const hex = s[0];
    if (!hex || seen.has(hex)) continue;
    
    // Only include US aircraft (hex starting with 'a')
    if (!hex.toLowerCase().startsWith('a')) continue;
    
    // Check if airborne (has lat/lon and not on ground)
    if (s[6] != null && s[5] != null && !s[8]) {
      airborne.push({ hex, callsign: s[1]?.trim() || null });
      seen.add(hex);
    }
  }
  
  // Update cache
  cachedAircraft = airborne;
  cacheTimestamp = now;
  
  return airborne;
}

export async function GET(req: Request) {
  // Check rate limit (6 requests per minute)
  const clientId = getClientId(req);
  if (!randomLimiter.check(clientId)) {
    const status = randomLimiter.getStatus(clientId);
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many requests. Maximum 6 requests per minute.",
        retryAfter: Math.ceil(status.resetMs / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(status.resetMs / 1000)),
          'X-RateLimit-Limit': '6',
          'X-RateLimit-Remaining': String(status.remaining),
          'X-RateLimit-Reset': String(Date.now() + status.resetMs),
        },
      }
    );
  }
  
  const airborne = await getActiveUSAircraft();
  
  if (!airborne.length) {
    return NextResponse.json(
      { error: "No US aircraft currently airborne" },
      { status: 404 }
    );
  }
  
  const randomAircraft = airborne[Math.floor(Math.random() * airborne.length)];
  
  // Add Cache-Control header for browser/CDN caching
  return NextResponse.json(randomAircraft, {
    headers: {
      'Cache-Control': 'public, max-age=5, s-maxage=5',
    },
  });
}
