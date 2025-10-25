# TrackMyBird - Flight Tracker Application

## Project Overview
TrackMyBird is a real-time flight tracking application specifically designed to help US aircraft owners share tracking with authorized individuals (family, spouses, business partners) despite FAA LADD (Limiting Aircraft Data Displayed) privacy blocking. Built with Next.js, React, and Leaflet maps, it uses mathematical N-number conversion, OpenSky Network API for aircraft tracking, and FlightAware AeroAPI for flight data. **Restricted to US-registered aircraft only (N-numbers).**

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
│   │   ├── resolve/       # Resolve tail to hex (algorithmic)
│   │   ├── state/         # Aircraft state endpoint
│   │   └── track/         # Track aircraft endpoint
│   ├── components/        # React components
│   │   ├── AboutModal.tsx # About/LADD explanation modal
│   │   ├── Controls.tsx   # UI controls
│   │   └── SkyKeyApp.tsx  # Main app component
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── lib/                   # Utility libraries
│   ├── nnumber-converter.ts # N-number to ICAO hex converter
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

### Latest: US-Only N-Number Algorithmic Conversion
- **Implemented mathematical N-number converter**: Ported proven algorithm from https://github.com/guillaumemichel/icao-nnumber_converter
  - Replaces unreliable OpenSky metadata lookup (was returning wrong hex for user's N260PC)
  - Bidirectional conversion: N-number ↔ ICAO hex (N1→A00001 through N99999→ADF7C7)
  - Zero API calls, instant results, 100% accurate for US aircraft
  - Validates N-number formats: 1-5 digits with optional 1-2 letter suffix
- **US-only restriction**: App now limited to US-registered aircraft (LADD is FAA/US-specific)
  - `/api/resolve` validates tail numbers must start with 'N'
  - `/api/track` validates hex codes must start with 'A' (US range)
  - Friendly error messages for non-US aircraft
- **UI rebranding**: Updated messaging for non-technical users
  - Renamed to "TrackMyBird" with tagline "Track your aircraft and share with family and friends"
  - Added Info button with About modal explaining LADD in accessible terms
  - Updated placeholders to US examples (N260PC, AB88B6)
  - Removed technical jargon from main interface

### Earlier Changes
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
- `/api/resolve?tail=<TAIL_NUMBER>` - Resolve US tail number to ICAO hex (algorithmic conversion, US-only)
- `/api/random` - Get a random active aircraft
- `/api/opensky/active` - List active aircraft
- `/api/opensky/by-tail` - Search by tail number
- `/api/state` - Get aircraft state
- `/api/test-flightaware?tail=<TAIL>` - Test FlightAware API integration (debug endpoint)

## N-Number to ICAO Conversion Algorithm
The app uses a mathematical algorithm to convert US N-numbers to ICAO hex codes without requiring external database lookups:

### How It Works
- **Sequential mapping**: N1→A00001 through N99999→ADF7C7 (US aircraft range)
- **Bucket-based calculation**: Uses pre-calculated bucket sizes for efficient conversion
- **Bidirectional**: Supports both N-number→hex and hex→N-number conversion
- **Zero API calls**: Pure mathematical calculation, instant results
- **100% accurate**: Matches official FAA registry for all US aircraft

### Validation Rules
- N-numbers must start with 'N' followed by 1-5 characters
- Characters can be: 1-5 digits with optional 1-2 letter suffix at the end
- Letters use charset A-Z excluding I and O (to avoid confusion with 1 and 0)
- Valid examples: N1, N12345, N842QS, N260PC
- Invalid examples: N123ABC (3 letters), N1A2 (letter in middle), C-GXYZ (non-US)

### Implementation
- Library: `lib/nnumber-converter.ts`
- Functions: `nNumberToIcao()`, `icaoToNNumber()`, `isValidNNumber()`, `isValidUSIcao()`
- Reference: https://github.com/guillaumemichel/icao-nnumber_converter

## Development Notes
- The app uses Next.js App Router (not Pages Router)
- Map rendering is client-side only (dynamic import with ssr: false)
- OpenSky API has rate limits - credentials in config.json provide extended access
- Leaflet icons are custom SVG implementations for aircraft and markers
- **US-only focus**: App is restricted to US aircraft due to LADD being an FAA/US program
