import { NextResponse } from "next/server";
import { randomLimiter, getClientId } from "@/lib/rateLimiter";

/**
 * Random aircraft endpoint - TEMPORARILY DISABLED
 * 
 * This endpoint previously used OpenSky Network to fetch a random airborne US aircraft.
 * After removing OpenSky due to severe rate limiting issues, this feature needs reimplementation.
 * 
 * Possible future approaches:
 * - Return random aircraft from user's registered aircraft database
 * - Use FlightAware's search API (if available)
 * - Maintain a curated list of commonly tracked US aircraft
 */

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
  
  return NextResponse.json(
    {
      error: "feature_unavailable",
      message: "Random aircraft feature temporarily unavailable after removing OpenSky Network integration.",
    },
    { status: 503 }
  );
}
