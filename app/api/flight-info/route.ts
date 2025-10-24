import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AviationStackFlight {
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string | null;
    gate: string | null;
    delay: number | null;
    scheduled: string;
    estimated: string;
    actual: string | null;
    estimated_runway: string | null;
    actual_runway: string | null;
  };
  arrival: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string | null;
    gate: string | null;
    baggage: string | null;
    delay: number | null;
    scheduled: string;
    estimated: string;
    actual: string | null;
    estimated_runway: string | null;
    actual_runway: string | null;
  };
  airline: {
    name: string;
    iata: string;
    icao: string;
  };
  flight: {
    number: string;
    iata: string;
    icao: string;
    codeshared: any | null;
  };
  aircraft: {
    registration: string | null;
    iata: string | null;
    icao: string | null;
    icao24: string | null;
  };
  live: {
    updated: string;
    latitude: number;
    longitude: number;
    altitude: number;
    direction: number;
    speed_horizontal: number;
    speed_vertical: number;
    is_ground: boolean;
  } | null;
}

interface AviationStackResponse {
  pagination: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data: AviationStackFlight[];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hex = searchParams.get("hex")?.toLowerCase();
  const tail = searchParams.get("tail")?.toUpperCase();
  
  if (!hex && !tail) {
    return NextResponse.json(
      { message: "Missing hex or tail parameter" },
      { status: 400 }
    );
  }

  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    console.error("[AVIATIONSTACK] API key not configured");
    return NextResponse.json(
      { message: "API key not configured" },
      { status: 500 }
    );
  }

  try {
    // Build query parameters - AviationStack doesn't support ICAO24 hex directly
    // We'll search by aircraft registration (tail number) if available
    const params = new URLSearchParams({
      access_key: apiKey,
      limit: "10",
    });

    if (tail) {
      // Search by aircraft registration (tail number)
      params.append("flight_iata", tail);
    }

    const url = `http://api.aviationstack.com/v1/flights?${params.toString()}`;
    console.log(`[AVIATIONSTACK] Fetching flight info for ${tail || hex}`);

    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!response.ok) {
      console.error(`[AVIATIONSTACK] API error: ${response.status}`);
      return NextResponse.json(
        { message: "AviationStack API error" },
        { status: response.status }
      );
    }

    const data: AviationStackResponse = await response.json();
    
    if (!data.data || data.data.length === 0) {
      console.log(`[AVIATIONSTACK] No flights found for ${tail || hex}`);
      return NextResponse.json({
        originAirport: null,
        destinationAirport: null,
        originIata: null,
        destinationIata: null,
      });
    }

    // Get the most recent flight (usually first in the array)
    const flight = data.data[0];
    
    console.log(
      `[AVIATIONSTACK] Found flight: ${flight.departure?.icao || flight.departure?.iata} → ${flight.arrival?.icao || flight.arrival?.iata}`
    );

    return NextResponse.json({
      originAirport: flight.departure?.icao || flight.departure?.iata || null,
      destinationAirport: flight.arrival?.icao || flight.arrival?.iata || null,
      originIata: flight.departure?.iata || null,
      destinationIata: flight.arrival?.iata || null,
      flightStatus: flight.flight_status || null,
      airline: flight.airline?.name || null,
      flightNumber: flight.flight?.iata || flight.flight?.icao || null,
    });
  } catch (error: any) {
    console.error(`[AVIATIONSTACK] Error:`, error.message);
    return NextResponse.json(
      { message: "Failed to fetch flight info", error: error.message },
      { status: 500 }
    );
  }
}
