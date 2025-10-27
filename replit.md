# TrackMyBird - Flight Tracker Application

## Overview
TrackMyBird is a real-time flight tracking application for US-registered aircraft (N-numbers). Its primary purpose is to enable US aircraft owners to share tracking information with authorized individuals, bypassing FAA LADD (Limiting Aircraft Data Displayed) privacy blocking. The project provides a secure platform for tracking flights with rich interactive map visualizations, guest access sharing, and detailed flight information. Currently at version 0.44.

## User Preferences
I prefer detailed explanations.
Ask before making major changes.
I want iterative development.
I prefer simple language.
I like functional programming.

## System Architecture
The application is built on **Next.js 15.5.6 with React 19.2.0** for the frontend, using the **App Router**. Styling is handled with **Tailwind CSS v4**. Data persistence uses **PostgreSQL with Drizzle ORM**. User authentication is session-based with email verification and HTTP-only cookies.

**Key Features:**
-   **User Authentication & Aircraft Management (Enhanced v0.44)**: 
    -   Secure signup/login with email verification
    -   Flexible aircraft entry: accepts EITHER tail number OR hex code (not both required)
    -   Auto-calculation of missing field using N-number converter
    -   Validation for vanity tail numbers with helpful error messages
-   **Guest Access Sharing (v0.43)**: 
    -   Create shareable tracking links with 256-bit tokens (SHA-256 hashed at rest)
    -   Two duration types: 24-hour temporary or permanent (with 6-month inactivity auto-revoke)
    -   Guest tokens support multiple aircraft, optional nicknames, and regenerate-on-demand
    -   Automatic revocation when aircraft deleted or after 6 months of inactivity
    -   Public guest viewer page showing aircraft list with direct tracking links
-   **Dashboard UX (v0.43)**:
    -   Tabbed interface: "My Aircraft" and "Guest Access" tabs
    -   Clickable aircraft table rows (tail/hex → public tracking page)
    -   Per-aircraft actions: Track, Issue Access, Delete
    -   Guest token management: view status, regenerate links, revoke access
    -   Copy-to-clipboard for sharing URLs
-   **Guest Dashboard & Navigation (v0.44)**:
    -   Multi-aircraft guest tokens display aircraft list at `/v/[token]`
    -   Single-aircraft tokens auto-redirect to tracking page
    -   Context-aware navigation: owners navigate to dashboard, multi-aircraft guests to guest dashboard, single-aircraft guests have no nav link
    -   Cross-browser SHA-256 token hashing with Web Crypto API and js-sha256 fallback
-   **Public Tracking**: `/track/[id]` page accepts tail number or hex code, auto-detects type
-   **Real-time Tracking**: Displays aircraft position, flight paths (completed and remaining), and IFR waypoints on an **interactive Leaflet map**.
-   **Map Visualizations**:
    -   Dual-color track segments: Purple for completed path, gray dashed for remaining path.
    -   Green pin for origin, red pin for destination, and a rotating blue airplane icon for current position.
    -   Airport markers for origin and destination.
-   **Flight Data**: Integration with external APIs for origin/destination data, IFR flight plans, and historical flight data.
-   **N-number Conversion**: Uses a mathematical algorithm for instant and accurate bidirectional conversion between US N-numbers and ICAO hex codes, without external API calls. This enforces a strict **US-only restriction** for aircraft.
-   **Performance & Reliability**: Features client-side polling for live updates, a provider cascade (`FlightAware` primary → `AviationStack` fallback) with in-memory caching for flight status, and robust rate limiting.
-   **Security**: 
    -   All tokens (session, verification, guest) use 256-bit entropy, SHA-256 hashed at rest
    -   Guest tokens auto-revoke on aircraft deletion and after 6 months of inactivity
    -   Proxy-aware URL generation for deployment environments
    -   Authentication and ownership validation on all protected endpoints

**Technical Implementations:**
-   **Configuration**: Separated into sensitive secrets (managed by Replit Secrets) and public configuration with sensible defaults.
-   **Rate Limiting**: Implemented with a sliding window algorithm for API endpoints like `/api/random` and `/api/resolve`.
-   **Email System**: Supports SMTP with a fallback to file transport in development.
-   **Map Rendering**: Client-side only using dynamic imports to optimize server-side rendering.
-   **Guest Token System (v0.43-v0.44)**:
    -   JSONB storage for multi-aircraft token associations with PostgreSQL containment queries
    -   Auto-revoke enforcement at validation and listing endpoints (6-month inactivity threshold)
    -   Token regeneration preserves settings while invalidating old token
    -   Status computation: Active, Revoked, Expired, Dormant (computed, not stored)
    -   Client-side SHA-256 hashing (`lib/hash-client.ts`) with Web Crypto API primary + js-sha256 fallback for cross-browser compatibility
    -   React Hooks compliance: all hooks called before early returns to prevent order violations
    -   Guest dashboard with auto-redirect logic for single-aircraft tokens (100ms delay for router readiness)

## External Dependencies
-   **FlightAware AeroAPI**: Primary source for all flight data including real-time tracking, origin/destination, and IFR flight plans.
    -   Route endpoint returns `fixes` array (not `waypoints`) containing IFR flight plan waypoints with coordinates
-   **AviationStack API**: Fallback provider for origin/destination metadata.
-   **airport-data.com API**: Provides airport coordinates and details.
-   **OpenSky Network API**: Used only for development tooling (not production features).
-   **PostgreSQL**: Relational database for storing user, session, aircraft, and guest token data (5 tables).
-   **Drizzle ORM**: Used for database interactions.
-   **Next.js**: Frontend framework.
-   **React**: UI library.
-   **Leaflet & react-leaflet**: Interactive mapping library.
-   **Tailwind CSS**: For styling.
-   **js-sha256**: SHA-256 hashing library for cross-browser token validation fallback.

## Development Tools
**INTERNAL USE ONLY - NOT END-USER FEATURES**

### Random Aircraft Finder (`scripts/find-random-aircraft.ts`)
A development utility to quickly find random US-registered aircraft currently in flight for testing purposes.

**Usage:**
```bash
npx tsx scripts/find-random-aircraft.ts
```

**How it works:**
1. Queries OpenSky Network API for aircraft within ~1000 mile radius of central USA (39.5°N, -98.35°W)
2. Filters for US-registered aircraft (ICAO24 codes starting with 'A')
3. Randomly selects one aircraft
4. Converts ICAO24 hex code to N-number using `lib/nnumber-converter.ts`
5. Outputs tracking URLs for immediate testing

**Requirements:**
- `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` environment variables
- OAuth2 credentials from https://opensky-network.org/

**Error Handling:**
- Returns distinctive error if no aircraft found (extremely unlikely)
- Includes detailed error messages for authentication failures

**Example Output:**
```
✅ Found 2433 US-registered aircraft in flight

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛩️  RANDOM AIRCRAFT SELECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
N-Number:  N37536
ICAO24:    A4493E
Callsign:  UAL1644
Position:  27.8822°N, 85.4270°W
Altitude:  10973 meters (36000 feet)
Speed:     384 knots
Heading:   266°
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 Track this aircraft: http://localhost:5000/track/N37536
🔗 Or use hex code:     http://localhost:5000/track/A4493E
```