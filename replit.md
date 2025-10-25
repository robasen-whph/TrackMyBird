# TrackMyBird - Flight Tracker Application

## Project Overview
TrackMyBird is a real-time flight tracking application built with Next.js, React, and Leaflet maps. It uses the OpenSky Network API for aircraft tracking data and FlightAware AeroAPI as the primary source for origin/destination airport information, displaying flight paths on an interactive map.

## Technology Stack
- **Frontend Framework**: Next.js 15.5.6 with React 19.2.0
- **Styling**: Tailwind CSS v4
- **Maps**: Leaflet with react-leaflet
- **Language**: TypeScript 5.6.3
- **APIs**: 
  - OpenSky Network REST API (aircraft tracking, OAuth authenticated)
  - FlightAware AeroAPI (primary origin/destination data, free tier: 500 req/month)
  - AviationStack API (fallback origin/destination, free tier: 100 req/month)
  - airport-data.com API (airport coordinates and details)

## Features
- **Real-time Aircraft Tracking**: Track aircraft by ICAO hex code or tail number
- **Interactive Map**: Visualize flight paths with Leaflet maps
- **Dual-Color Track Segments**: 
  - Purple solid line: Completed path (origin → current position)
  - Gray dashed line: Remaining path (current position → destination)
- **IFR Waypoint Routing**: 
  - Displays filed IFR flight plan waypoints from FlightAware
  - Remaining path follows actual planned route through waypoints
  - Graceful fallback to straight line for VFR flights or when waypoints unavailable
- **Flight History**: Display historical flight data and routes
- **Live Updates**: 30-second client-side polling for position updates
- **Search Functionality**: Find aircraft by tail number or hex code
- **Random Aircraft**: Discover random aircraft to track
- **Airport Markers**: 
  - Green pin: Origin airport (connected to track)
  - Red pin: Destination airport (connected to track)
  - Blue airplane: Current aircraft position (rotates based on heading)

## Project Structure
```
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── opensky/       # OpenSky Network API proxies
│   │   ├── random/        # Random aircraft endpoint
│   │   ├── resolve/       # Resolve tail to hex
│   │   ├── state/         # Aircraft state endpoint
│   │   └── track/         # Track aircraft endpoint
│   ├── components/        # React components
│   │   ├── Controls.tsx   # UI controls
│   │   └── SkyKeyApp.tsx  # Main app component
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── lib/                   # Utility libraries
│   └── opensky.ts         # OpenSky API integration
├── config.json            # OpenSky API credentials
└── next.config.mjs        # Next.js configuration
```

## API Configuration
The application uses OpenSky Network API credentials stored in `config.json`:
- Client ID: nycrobaviation-api-client
- OAuth authentication for extended API access

## Running the Application
The application runs on port 5000 in the Replit environment:
- Development: `next dev -p 5000`
- Build: `next build`
- Production: `next start -p 5000`

## Recent Changes (Oct 25, 2025)
- **Migrated OAuth credentials**: Moved from config.json to Replit Secrets for security
- **Fixed track parsing**: Corrected OpenSky API array format parsing ([time, lat, lon, alt, heading])
- **Implemented polling**: 30-second client-side updates (user testing at 5 seconds)
- **FlightAware AeroAPI integration**: PRIMARY source for origin/destination (500 free calls/month)
  - Replaces unreliable OpenSky /flights endpoint (which often returns 400)
  - Data cascade: FlightAware → OpenSky /flights → AviationStack fallback
  - City name cleaning: Removes timezone prefixes (e.g., "America/Los_Angeles" → "Los Angeles")
  - Merged with airport-data.com for coordinates (FlightAware provides codes/names/cities)
- **IFR Waypoint Routing**: Integrated FlightAware `/flights/{id}/route` endpoint
  - Fetches filed IFR flight plan waypoints with coordinates
  - Remaining path segment now follows waypoints instead of straight line
  - Graceful fallback: Returns null for VFR flights, landed flights, or when unavailable (404/429)
  - Frontend automatically uses straight line when waypoints unavailable
- **Track button always re-fits**: Clicking Track now always centers/zooms map, even for same aircraft
- **Airport coordinate lookup**: Integrated airport-data.com for lat/lon coordinates
- **Track connectivity**: Origin and destination markers now connect to flight path
- **Dual-color segments**: Purple for completed path, gray dashed for remaining
- **Improved aircraft icon**: Modern crisp airplane design with perfect track alignment
- **Fixed zoom persistence**: Map now maintains user's zoom level during polling updates (only auto-fits on initial aircraft load)
- **Fixed auto-fit for new aircraft**: Map now correctly auto-fits when loading new random or tracked aircraft (deferred lastFittedHexRef update to onFitComplete callback)
- **Perfect icon alignment**: Airplane icon now precisely aligns with track line at all zoom levels (centered SVG viewBox -24,-24 and iconAnchor [24,24])
- **Improved error handling**: 
  - Graceful handling of polling errors when aircraft land or leave coverage
  - Track API now returns proper 404 responses for non-existent aircraft instead of 500 errors

## API Endpoints
- `/api/track?hex=<ICAO_HEX>` - Get flight track with origin/destination and waypoints (uses OpenSky tracks + FlightAware flight + route endpoints → OpenSky flights → AviationStack)
- `/api/resolve?tail=<TAIL_NUMBER>` - Resolve tail number to ICAO hex
- `/api/random` - Get a random active aircraft
- `/api/opensky/active` - List active aircraft
- `/api/opensky/by-tail` - Search by tail number
- `/api/state` - Get aircraft state
- `/api/test-flightaware?tail=<TAIL>` - Test FlightAware API integration (debug endpoint)

## Development Notes
- The app uses Next.js App Router (not Pages Router)
- Map rendering is client-side only (dynamic import with ssr: false)
- OpenSky API has rate limits - credentials in config.json provide extended access
- Leaflet icons are custom SVG implementations for aircraft and markers
