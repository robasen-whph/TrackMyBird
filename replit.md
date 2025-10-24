# TrackMyBird - Flight Tracker Application

## Project Overview
TrackMyBird is a real-time flight tracking application built with Next.js, React, and Leaflet maps. It uses the OpenSky Network API for aircraft tracking data and AviationStack API for origin/destination airport information, displaying flight paths on an interactive map.

## Technology Stack
- **Frontend Framework**: Next.js 15.5.6 with React 19.2.0
- **Styling**: Tailwind CSS v4
- **Maps**: Leaflet with react-leaflet
- **Language**: TypeScript 5.6.3
- **APIs**: 
  - OpenSky Network REST API (aircraft tracking, OAuth authenticated)
  - AviationStack API (origin/destination data, free tier: 100 req/month)
  - airport-data.com API (airport coordinates and details)

## Features
- **Real-time Aircraft Tracking**: Track aircraft by ICAO hex code or tail number
- **Interactive Map**: Visualize flight paths with Leaflet maps
- **Dual-Color Track Segments**: 
  - Purple solid line: Completed path (origin → current position)
  - Gray dashed line: Remaining path (current position → destination)
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

## Recent Changes (Oct 24, 2025)
- **Migrated OAuth credentials**: Moved from config.json to Replit Secrets for security
- **Fixed track parsing**: Corrected OpenSky API array format parsing ([time, lat, lon, alt, heading])
- **Implemented polling**: 30-second client-side updates (user testing at 5 seconds)
- **Added AviationStack integration**: Fallback API for origin/destination when OpenSky returns 400
- **Airport coordinate lookup**: Integrated airport-data.com for lat/lon coordinates
- **Track connectivity**: Origin and destination markers now connect to flight path
- **Dual-color segments**: Purple for completed path, gray dashed for remaining
- **Improved aircraft icon**: Modern crisp airplane design (not human-like)

## API Endpoints
- `/api/track?hex=<ICAO_HEX>` - Get flight track with origin/destination (uses OpenSky + AviationStack)
- `/api/flight-info?tail=<TAIL>` - Get flight info from AviationStack (origin/destination)
- `/api/resolve?tail=<TAIL_NUMBER>` - Resolve tail number to ICAO hex
- `/api/random` - Get a random active aircraft
- `/api/opensky/active` - List active aircraft
- `/api/opensky/by-tail` - Search by tail number
- `/api/state` - Get aircraft state

## Development Notes
- The app uses Next.js App Router (not Pages Router)
- Map rendering is client-side only (dynamic import with ssr: false)
- OpenSky API has rate limits - credentials in config.json provide extended access
- Leaflet icons are custom SVG implementations for aircraft and markers
