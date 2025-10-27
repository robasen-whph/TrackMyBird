#!/usr/bin/env node
/**
 * Development Tool: Find Random Flying US Aircraft
 * 
 * This script queries the OpenSky Network API to find a random US-registered
 * aircraft currently in flight within ~1000 miles of the center of the United States.
 * 
 * Usage: npm run find-aircraft
 * 
 * NOTE: This is for INTERNAL DEVELOPMENT USE ONLY.
 * It helps developers quickly find real aircraft to test tracking features.
 */

import { icaoToNNumber } from '../lib/nnumber-converter';

const CENTER_LAT = 39.5;   // Kansas (geographic center of USA)
const CENTER_LON = -98.35;

// ~1000 mile radius = ±14° lat/lon
const BOUNDING_BOX = {
  lamin: CENTER_LAT - 14,  // ~25.5°N
  lamax: CENTER_LAT + 14,  // ~53.5°N
  lomin: CENTER_LON - 14,  // ~-112.35°W
  lomax: CENTER_LON + 14,  // ~-84.35°W
};

interface OpenSkyState {
  icao24: string;
  callsign: string | null;
  origin_country: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  velocity: number | null;
  heading: number | null;
}

async function getOAuth2Token(): Promise<string> {
  const clientId = process.env.OPENSKY_CLIENT_ID || 'nycrobaviation-api-client';
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET || 'pMJGSS9HV60PGBDyf1dwohan8qo6ZzLN';

  const authUrl = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
  
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth2 authentication failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getUSAircraftInRegion(): Promise<OpenSkyState[]> {
  const token = await getOAuth2Token();
  
  const params = new URLSearchParams({
    lamin: BOUNDING_BOX.lamin.toString(),
    lamax: BOUNDING_BOX.lamax.toString(),
    lomin: BOUNDING_BOX.lomin.toString(),
    lomax: BOUNDING_BOX.lomax.toString(),
  });

  const url = `https://opensky-network.org/api/states/all?${params}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenSky API request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.states || data.states.length === 0) {
    return [];
  }

  // Filter for US-registered aircraft (ICAO24 starts with 'A')
  // and must have valid position data
  const usAircraft = data.states
    .filter((state: any[]) => {
      const icao24 = state[0]?.toUpperCase();
      const latitude = state[6];
      const longitude = state[5];
      
      // US aircraft have ICAO24 starting with 'A'
      return icao24?.startsWith('A') && 
             latitude !== null && 
             longitude !== null;
    })
    .map((state: any[]): OpenSkyState => ({
      icao24: state[0].toUpperCase(),
      callsign: state[1]?.trim() || null,
      origin_country: state[2],
      latitude: state[6],
      longitude: state[5],
      altitude: state[7],
      velocity: state[9],
      heading: state[10],
    }));

  return usAircraft;
}

async function main() {
  try {
    console.log('🔍 Searching for US-registered aircraft...');
    console.log(`📍 Region: ~1000 mile radius from center of USA (${CENTER_LAT}°N, ${CENTER_LON}°W)\n`);

    const aircraft = await getUSAircraftInRegion();

    if (aircraft.length === 0) {
      console.error('❌ ERROR: No US-registered aircraft found in the search area.');
      console.error('   This is extremely unlikely - there may be an issue with the OpenSky API.');
      console.error('   Please try again in a few moments.\n');
      process.exit(1);
    }

    // Randomly select one aircraft
    const selected = aircraft[Math.floor(Math.random() * aircraft.length)];
    
    // Convert ICAO24 to N-number
    const nNumber = icaoToNNumber(selected.icao24);

    console.log(`✅ Found ${aircraft.length} US-registered aircraft in flight\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛩️  RANDOM AIRCRAFT SELECTED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`N-Number:  ${nNumber}`);
    console.log(`ICAO24:    ${selected.icao24}`);
    console.log(`Callsign:  ${selected.callsign || 'N/A'}`);
    console.log(`Position:  ${selected.latitude?.toFixed(4)}°N, ${Math.abs(selected.longitude || 0).toFixed(4)}°W`);
    if (selected.altitude) {
      console.log(`Altitude:  ${Math.round(selected.altitude)} meters (${Math.round(selected.altitude * 3.28084)} feet)`);
    }
    if (selected.velocity) {
      console.log(`Speed:     ${Math.round(selected.velocity * 1.94384)} knots`);
    }
    if (selected.heading !== null) {
      console.log(`Heading:   ${Math.round(selected.heading)}°`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`🔗 Track this aircraft: http://localhost:5000/track/${nNumber}`);
    console.log(`🔗 Or use hex code:     http://localhost:5000/track/${selected.icao24}\n`);

  } catch (error) {
    console.error('❌ ERROR:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
