import { NextResponse } from "next/server";
import { getFlightStatus } from "@/lib/statusAdapter";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hex = (searchParams.get("hex") || "").toLowerCase();
  
  if (!/^[0-9a-f]{6}$/.test(hex)) {
    return NextResponse.json({ 
      message: "Invalid hex code format. Must be 6 hexadecimal characters." 
    }, { status: 400 });
  }
  
  // Check if it's a US aircraft (hex must start with 'A')
  if (!hex.startsWith('a')) {
    return NextResponse.json({
      message: "This app currently supports US-registered aircraft only. US aircraft hex codes start with 'A'."
    }, { status: 400 });
  }

  try {
    const status = await getFlightStatus({ hex });
    
    return NextResponse.json(status);
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error('[TRACK ERROR]', errorMsg, error);
    
    // Handle rate limiting errors (match old error format)
    if (errorMsg.startsWith('rate_limited:')) {
      const provider = errorMsg.split(':')[1];
      const providerName = provider === 'opensky' ? 'OpenSky Network' : 
                           provider === 'flightaware' ? 'FlightAware' :
                           provider === 'aviationstack' ? 'AviationStack' : provider;
      return NextResponse.json(
        { 
          error: "rate_limited", 
          source: provider,
          message: `Rate limit exceeded for ${providerName}. Please try again in a few minutes.`
        },
        { status: 429 }
      );
    }
    
    // Handle aircraft not found
    if (errorMsg.includes('not found') || errorMsg.includes('no track data')) {
      return NextResponse.json(
        { error: "unknown" },
        { status: 404 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { message: "track_error", error: errorMsg },
      { status: 500 }
    );
  }
}
