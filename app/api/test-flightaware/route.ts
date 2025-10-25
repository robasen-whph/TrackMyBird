import { NextResponse } from "next/server";

/**
 * Test endpoint to explore FlightAware AeroAPI
 * 
 * Usage examples:
 * /api/test-flightaware?hex=a12345
 * /api/test-flightaware?tail=N12345
 * /api/test-flightaware?ident=UAL123
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hex = searchParams.get("hex");
  const tail = searchParams.get("tail");
  const ident = searchParams.get("ident");
  
  const apiKey = process.env.FLIGHTAWARE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "FLIGHTAWARE_API_KEY not configured" }, { status: 500 });
  }

  const results: any = {
    input: { hex, tail, ident },
    tests: [],
  };

  try {
    // Test 1: If we have a tail number, search by registration
    if (tail) {
      console.log(`[FA TEST] Searching by tail/registration: ${tail}`);
      
      const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(tail)}`;
      console.log(`[FA TEST] URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          "x-apikey": apiKey,
        },
      });
      
      const data = await response.json();
      
      results.tests.push({
        test: "Search by tail/registration",
        url,
        status: response.status,
        success: response.ok,
        data: response.ok ? data : data,
        dataSize: JSON.stringify(data).length,
      });
    }

    // Test 2: If we have a flight ident (like UAL123), search by ident
    if (ident) {
      console.log(`[FA TEST] Searching by flight ident: ${ident}`);
      
      const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(ident)}`;
      console.log(`[FA TEST] URL: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          "x-apikey": apiKey,
        },
      });
      
      const data = await response.json();
      
      results.tests.push({
        test: "Search by flight ident",
        url,
        status: response.status,
        success: response.ok,
        data: response.ok ? data : data,
        dataSize: JSON.stringify(data).length,
      });
    }

    // Test 3: Extract sample flight details if we got results
    if (results.tests.length > 0) {
      const successfulTest = results.tests.find((t: any) => t.success);
      
      if (successfulTest && successfulTest.data?.flights?.length > 0) {
        const firstFlight = successfulTest.data.flights[0];
        
        results.sampleFlight = {
          fa_flight_id: firstFlight.fa_flight_id,
          ident: firstFlight.ident,
          ident_icao: firstFlight.ident_icao,
          registration: firstFlight.registration,
          aircraft_type: firstFlight.aircraft_type,
          origin: firstFlight.origin,
          destination: firstFlight.destination,
          scheduled_out: firstFlight.scheduled_out,
          scheduled_in: firstFlight.scheduled_in,
          actual_off: firstFlight.actual_off,
          actual_on: firstFlight.actual_on,
        };
        
        // Test 4: Get detailed position data for this flight
        if (firstFlight.fa_flight_id) {
          console.log(`[FA TEST] Getting position for fa_flight_id: ${firstFlight.fa_flight_id}`);
          
          const posUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(firstFlight.fa_flight_id)}/position`;
          console.log(`[FA TEST] Position URL: ${posUrl}`);
          
          const posResponse = await fetch(posUrl, {
            headers: {
              "x-apikey": apiKey,
            },
          });
          
          const posData = await posResponse.json();
          
          results.tests.push({
            test: "Get flight position",
            url: posUrl,
            status: posResponse.status,
            success: posResponse.ok,
            data: posResponse.ok ? posData : posData,
          });
        }

        // Test 5: Get track data for this flight
        if (firstFlight.fa_flight_id) {
          console.log(`[FA TEST] Getting track for fa_flight_id: ${firstFlight.fa_flight_id}`);
          
          const trackUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(firstFlight.fa_flight_id)}/track`;
          console.log(`[FA TEST] Track URL: ${trackUrl}`);
          
          const trackResponse = await fetch(trackUrl, {
            headers: {
              "x-apikey": apiKey,
            },
          });
          
          const trackData = await trackResponse.json();
          
          results.tests.push({
            test: "Get flight track",
            url: trackUrl,
            status: trackResponse.status,
            success: trackResponse.ok,
            data: trackResponse.ok ? trackData : trackData,
            pointCount: trackResponse.ok ? trackData.positions?.length : 0,
          });
        }
      }
    }

    return NextResponse.json(results, { status: 200 });
    
  } catch (error: any) {
    console.error("[FA TEST] Error:", error);
    return NextResponse.json({
      error: error.message,
      results,
    }, { status: 500 });
  }
}
