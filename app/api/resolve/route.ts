import { NextResponse } from "next/server";
import { nNumberToIcao, isValidNNumber } from "@/lib/nnumber-converter";
import { resolveLimiter, getClientId } from "@/lib/rateLimiter";

export async function GET(req: Request) {
  // Check rate limit (30 requests per minute)
  const clientId = getClientId(req);
  if (!resolveLimiter.check(clientId)) {
    const status = resolveLimiter.getStatus(clientId);
    return NextResponse.json(
      {
        error: "rate_limited",
        message: "Too many requests. Maximum 30 requests per minute.",
        retryAfter: Math.ceil(status.resetMs / 1000),
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(status.resetMs / 1000)),
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': String(status.remaining),
          'X-RateLimit-Reset': String(Date.now() + status.resetMs),
        },
      }
    );
  }
  
  const { searchParams } = new URL(req.url);
  
  // Strict input sanitization: only allow alphanumeric chars, trim whitespace
  let tail = (searchParams.get("tail") || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ""); // Remove all non-alphanumeric characters
  
  // Validate required parameter
  if (!tail) {
    return NextResponse.json({ 
      error: "no_tail",
      message: "Please provide a tail number" 
    }, { status: 400 });
  }

  // Validate length (N + 1-5 chars = 2-6 total)
  if (tail.length < 2 || tail.length > 6) {
    return NextResponse.json({
      error: "invalid_format",
      message: `Invalid tail number length. US N-numbers are 2-6 characters (N + 1-5 digits/letters). Got: '${tail}'`
    }, { status: 400 });
  }

  // Check if it's a US N-number
  if (!tail.startsWith('N')) {
    return NextResponse.json({
      error: "non_us_aircraft",
      message: "This app currently supports US-registered aircraft only (N-numbers). Please enter a tail number starting with 'N'."
    }, { status: 400 });
  }

  // Validate format using built-in validator
  if (!isValidNNumber(tail)) {
    return NextResponse.json({
      error: "invalid_nnumber",
      message: `'${tail}' is not a valid US tail number format. Valid examples: N1, N12345, N260PC, N842QS. Letters must be at the end only.`
    }, { status: 400 });
  }

  // Convert using algorithm
  const hex = nNumberToIcao(tail);
  
  if (!hex) {
    // This should not happen if isValidNNumber passed, but handle it anyway
    return NextResponse.json({
      error: "conversion_failed",
      message: `Unable to convert '${tail}' to hex code. Please verify the tail number is correct.`
    }, { status: 500 });
  }

  return NextResponse.json({
    hex: hex.toUpperCase(),
    tail,
    source: "algorithm"
  });
}
