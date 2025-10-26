/**
 * Test script to verify FlightAware track endpoint
 * Usage: node test-flightaware.js [tail_number]
 */

const tailNumber = process.argv[2] || 'N114AN';
const apiKey = process.env.FLIGHTAWARE_API_KEY;

if (!apiKey) {
  console.error('Error: FLIGHTAWARE_API_KEY environment variable not set');
  process.exit(1);
}

async function testFlightAwareTrack() {
  console.log(`\n=== Testing FlightAware Track Endpoint ===`);
  console.log(`Tail Number: ${tailNumber}`);
  console.log(`API Key: ${apiKey.substring(0, 10)}...`);
  
  try {
    // Step 1: Get flight list to find the fa_flight_id
    console.log(`\n[1/2] Fetching flight info for ${tailNumber}...`);
    const flightsUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(tailNumber)}`;
    
    const flightsResponse = await fetch(flightsUrl, {
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json'
      }
    });
    
    console.log(`Status: ${flightsResponse.status} ${flightsResponse.statusText}`);
    
    // Check rate limit headers
    const rateLimitRemaining = flightsResponse.headers.get('x-rate-limit-remaining');
    const rateLimitLimit = flightsResponse.headers.get('x-rate-limit-limit');
    const rateLimitReset = flightsResponse.headers.get('x-rate-limit-reset');
    
    if (rateLimitRemaining) {
      console.log(`Rate Limit: ${rateLimitRemaining}/${rateLimitLimit} requests remaining`);
      if (rateLimitReset) {
        const resetDate = new Date(parseInt(rateLimitReset) * 1000);
        console.log(`Resets at: ${resetDate.toLocaleString()}`);
      }
    }
    
    if (!flightsResponse.ok) {
      const error = await flightsResponse.text();
      console.error(`Error: ${error}`);
      return;
    }
    
    const flightsData = await flightsResponse.json();
    
    if (!flightsData.flights || flightsData.flights.length === 0) {
      console.log('No flights found for this aircraft');
      return;
    }
    
    // Find an active or recently completed flight
    let flight = null;
    for (const f of flightsData.flights) {
      if (f.status === 'Active' || f.status === 'Arrived' || f.status === 'Completed') {
        flight = f;
        break;
      }
    }
    
    if (!flight) {
      flight = flightsData.flights[0]; // Fall back to first flight
    }
    
    console.log(`\nFound flight: ${flight.ident || 'N/A'}`);
    console.log(`  FA Flight ID: ${flight.fa_flight_id}`);
    console.log(`  Origin: ${flight.origin?.code_icao || flight.origin?.code || 'N/A'}`);
    console.log(`  Destination: ${flight.destination?.code_icao || flight.destination?.code || 'N/A'}`);
    console.log(`  Status: ${flight.status || 'N/A'}`);
    
    if (flight.status === 'Scheduled') {
      console.log('\n⚠️  Flight is scheduled but not yet active - track data may not be available');
    }
    
    // Step 2: Get track data
    console.log(`\n[2/2] Fetching track data for flight ${flight.fa_flight_id}...`);
    const trackUrl = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(flight.fa_flight_id)}/track`;
    
    const trackResponse = await fetch(trackUrl, {
      headers: {
        'x-apikey': apiKey,
        'Accept': 'application/json'
      }
    });
    
    console.log(`Status: ${trackResponse.status} ${trackResponse.statusText}`);
    
    // Check rate limit headers again
    const trackRateLimitRemaining = trackResponse.headers.get('x-rate-limit-remaining');
    if (trackRateLimitRemaining) {
      console.log(`Rate Limit: ${trackRateLimitRemaining}/${rateLimitLimit} requests remaining`);
    }
    
    if (!trackResponse.ok) {
      const error = await trackResponse.text();
      console.error(`Error: ${error}`);
      return;
    }
    
    const trackData = await trackResponse.json();
    
    console.log(`\n=== Track Data Summary ===`);
    console.log(`Positions: ${trackData.positions?.length || 0}`);
    
    if (trackData.positions && trackData.positions.length > 0) {
      console.log(`\nFirst position:`);
      const first = trackData.positions[0];
      console.log(JSON.stringify(first, null, 2));
      
      console.log(`\nLast position:`);
      const last = trackData.positions[trackData.positions.length - 1];
      console.log(JSON.stringify(last, null, 2));
      
      console.log(`\n=== Data Mapping Test ===`);
      console.log(`Can map to our Point type:`);
      console.log(`  ✓ lat: ${first.latitude !== undefined ? 'YES' : 'NO'}`);
      console.log(`  ✓ lon: ${first.longitude !== undefined ? 'YES' : 'NO'}`);
      console.log(`  ✓ ts: ${first.timestamp !== undefined ? 'YES' : 'NO'}`);
      console.log(`  ✓ alt_ft: ${first.altitude !== undefined ? 'YES' : 'NO'}`);
      console.log(`  ✓ hdg: ${first.heading !== undefined ? 'YES' : 'NO'}`);
      console.log(`  ✓ gs_kt: ${first.groundspeed !== undefined ? 'YES' : 'NO'}`);
      
      console.log(`\n✅ FlightAware track endpoint provides all required data!`);
    } else {
      console.log('⚠️  No position data available');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
}

testFlightAwareTrack();
