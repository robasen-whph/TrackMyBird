// Test the /api/track endpoint with FlightAware-only implementation
const API_URL = "http://localhost:5000/api/track";

async function testTracking(identifier) {
  console.log(`\n=== Testing /api/track with ${identifier} ===\n`);
  
  try {
    const url = `${API_URL}?${identifier.startsWith('N') ? 'tail' : 'hex'}=${identifier}`;
    console.log(`Fetching: ${url}\n`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Error (${response.status}): ${data.error || 'Unknown error'}`);
      return;
    }
    
    console.log(`✅ Success!\n`);
    console.log(`Aircraft: ${data.tail || data.hex}`);
    console.log(`Track points: ${data.points?.length || 0}`);
    console.log(`Origin: ${data.originAirport || 'N/A'}`);
    console.log(`Destination: ${data.destinationAirport || 'N/A'}`);
    console.log(`Waypoints: ${data.waypoints?.length || 0}`);
    
    if (data.points && data.points.length > 0) {
      console.log(`\nFirst point:`, data.points[0]);
      console.log(`Last point:`, data.points[data.points.length - 1]);
    }
    
  } catch (error) {
    console.error(`❌ Request failed:`, error.message);
  }
}

// Test with TWY468 (the flight from the user's screenshot)
testTracking('N468KL');
