# TrackMyBird - Flight Tracker Application

**Current Version:** v0.41.0  
**Last Updated:** October 25, 2025

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
│   │   ├── health/        # Health check endpoint
│   │   ├── opensky/       # OpenSky Network API proxies
│   │   ├── random/        # Random US aircraft endpoint (cached, rate-limited)
│   │   ├── resolve/       # Resolve tail to hex (validated, rate-limited)
│   │   └── track/         # Track aircraft endpoint (uses statusAdapter)
│   ├── components/        # React components
│   │   ├── AboutModal.tsx # About/LADD explanation modal
│   │   ├── Controls.tsx   # UI controls
│   │   └── SkyKeyApp.tsx  # Main app component
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── config/                # Configuration
│   ├── app.ts             # Non-sensitive config (public values with defaults)
│   └── secrets.ts         # Sensitive secret validation
├── lib/                   # Utility libraries
│   ├── nnumber-converter.ts # N-number to ICAO hex converter
│   ├── opensky.ts         # OpenSky API integration
│   ├── rateLimiter.ts     # Sliding window rate limiter
│   └── statusAdapter.ts   # Provider cascade with caching
├── config.json            # OpenSky OAuth token storage
├── instrumentation.ts     # Boot logging
└── next.config.mjs        # Next.js configuration
```

## Configuration

### Sensitive Secrets (Replit Secrets)
The following **6 sensitive values** must be stored as Replit Secrets:
- `SESSION_SECRET` - Session encryption key
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `OPENSKY_CLIENT_SECRET` - OpenSky OAuth secret
- `FLIGHTAWARE_API_KEY` - FlightAware API key
- `AVIATIONSTACK_API_KEY` - AviationStack API key

### Public Configuration (`config/app.ts`)
Non-sensitive configuration with sensible defaults (can be overridden via environment variables):
- `APP_URL` - Application URL (default: `http://localhost:5000`)
- `EMAIL_FROM` - From email address (default: `noreply@trackmybird.net`)
- `SMTP_HOST` - SMTP hostname (default: `smtp.gmail.com`)
- `SMTP_PORT` - SMTP port (default: `587`)
- `OPENSKY_CLIENT_ID` - OpenSky client ID (default: `nycrobaviation-api-client`)
- Cache TTLs, rate limits, and other feature flags

## Running the Application
The application runs on port 5000 in the Replit environment:
- Development: `next dev -p 5000`
- Build: `next build`
- Production: `next start -p 5000`

## Recent Changes (Oct 25, 2025)

### Latest: Configuration Refactoring
- **Split configuration into secrets vs public config**:
  - Created `config/app.ts` for non-sensitive values with defaults (APP_URL, SMTP_HOST, EMAIL_FROM, etc.)
  - Updated `config/secrets.ts` to only validate 6 sensitive secrets (down from 11)
  - Easier local development - no need to set up secrets for public information
  - Sensitive secrets: SESSION_SECRET, SMTP_USER/PASS, OPENSKY_CLIENT_SECRET, FLIGHTAWARE_API_KEY, AVIATIONSTACK_API_KEY

### Earlier: Production Infrastructure (Chunks 0-2)
- **Chunk 0 - Health & Secrets Management**:
  - Created `/api/health` endpoint with service info and uptime
  - Centralized secrets validation in `config/secrets.ts` (validates required secrets at boot)
  - Added boot logging via `instrumentation.ts` for troubleshooting

- **Chunk 1 - Provider Cascade & Caching**:
  - Created `lib/statusAdapter.ts` - centralized provider logic with FlightAware → OpenSky → AviationStack cascade
  - Added 15-second in-memory cache for flight status (99% speed improvement: 1653ms → 14ms on cache hit)
  - Refactored `/api/track` from 482 to ~100 lines by using statusAdapter
  - Implemented retry logic for 5xx errors and rate limit detection (401/403/429)
  - Fixed cache key collisions with `hex:{value}` / `tail:{value}` format
  - Eliminated config I/O blocking on cache hits (token only fetched when needed)

- **Chunk 2 - Rate Limiting & Validation**:
  - Created `lib/rateLimiter.ts` with sliding window algorithm and periodic cleanup
  - `/api/random`: 5-second cache + 6 requests/min rate limit with Cache-Control headers
  - `/api/resolve`: Strict validation (length, format, sanitization) + 30 requests/min rate limit
  - Rate limit responses include `Retry-After`, `X-RateLimit-*` headers
  - Input sanitization removes non-alphanumeric characters to prevent injection attacks

### Earlier: Repository Cleanup
- **Removed unused API endpoints**: Deleted `/api/test-flightaware`, `/api/airport`, `/api/flight-info`, `/api/state` (not referenced by frontend)
- **Removed unused folders**: Deleted `scripts/` (PowerShell scripts), `attached_assets/` (screenshots)
- **Removed unused files**: Deleted `setup_trackmybird.ps1`, `start.sh`, `design_guidelines.md`
- **Uninstalled unused packages**: Removed `@octokit/rest` (GitHub API - not used)
- **Streamlined codebase**: Kept only essential files for Next.js app operation

### Earlier: US-Only N-Number Algorithmic Conversion
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
- `/api/health` - Health check with service info and uptime
- `/api/track?hex=<ICAO_HEX>` - Get flight track with origin/destination and waypoints
  - Uses statusAdapter with 15s cache (FlightAware → OpenSky → AviationStack cascade)
  - Returns track points, origin/destination info, airport coordinates, IFR waypoints
- `/api/resolve?tail=<TAIL_NUMBER>` - Resolve US tail number to ICAO hex
  - Algorithmic conversion (zero API calls), strict validation, 30 requests/min rate limit
- `/api/random` - Get a random active US aircraft
  - 5s cache, 6 requests/min rate limit, Cache-Control headers
- `/api/opensky/active` - List active aircraft (used by Controls component)
- `/api/opensky/by-tail` - Search by tail number (used by Controls component)

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
