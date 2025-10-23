# TrackMyBird - Flight Tracker Application

## Project Overview
TrackMyBird is a real-time flight tracking application built with Next.js, React, and Leaflet maps. It uses the OpenSky Network API to track aircraft worldwide and display their flight paths on an interactive map.

## Technology Stack
- **Frontend Framework**: Next.js 15.5.6 with React 19.2.0
- **Styling**: Tailwind CSS v4
- **Maps**: Leaflet with react-leaflet
- **Language**: TypeScript 5.6.3
- **API**: OpenSky Network REST API

## Features
- **Real-time Aircraft Tracking**: Track aircraft by ICAO hex code or tail number
- **Interactive Map**: Visualize flight paths with Leaflet maps
- **Flight History**: Display historical flight data and routes
- **Live Updates**: Real-time position updates for tracked aircraft
- **Search Functionality**: Find aircraft by tail number or hex code
- **Random Aircraft**: Discover random aircraft to track

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

## Recent Changes
- Imported from GitHub repository: robasen-whph/TrackMyBird
- Configured for Replit environment on port 5000
- Installed all dependencies including Leaflet, React, and Tailwind CSS

## API Endpoints
- `/api/track?hex=<ICAO_HEX>` - Get flight track for aircraft
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
