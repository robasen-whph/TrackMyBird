# TrackMyBird - Flight Tracker Application

## Overview
TrackMyBird is a real-time flight tracking application designed for US-registered aircraft (N-numbers). It empowers US aircraft owners to securely share flight tracking information with authorized individuals, bypassing FAA LADD restrictions. The platform offers interactive map visualizations, secure guest access sharing, and detailed flight information. Its core purpose is to provide a secure and user-friendly solution for private aircraft tracking and data sharing.

## User Preferences
I prefer detailed explanations.
Ask before making major changes.
I want iterative development.
I prefer simple language.
I like functional programming.

## System Architecture
The application is built with **Next.js 15.5.6 (App Router)** and **React 19.2.0** for the frontend, styled using **Tailwind CSS v4**. **PostgreSQL** with **Drizzle ORM** handles data persistence. User authentication is session-based, utilizing email verification and HTTP-only cookies.

**Key Features:**
-   **User Authentication & Aircraft Management**: Secure signup/login with email verification, flexible aircraft entry (tail number or hex code), and auto-conversion between the two.
-   **Guest Access Sharing**: Enables creation of shareable tracking links with 256-bit tokens (SHA-256 hashed). Supports temporary (24-hour) or permanent access, multi-aircraft tokens, optional nicknames, and on-demand regeneration. Includes smart deletion handling where deleting an aircraft either revokes single-aircraft tokens or removes the aircraft from multi-aircraft tokens. Auto-revokes inactive permanent tokens after 6 months.
-   **Dashboard UX**: Provides a tabbed interface for "My Aircraft" and "Guest Access." Features clickable aircraft table rows, per-aircraft actions (Track, Issue Access, Delete), and enhanced guest token displays with clickable tail numbers and per-aircraft removal.
-   **Guest Dashboard & Navigation**: Multi-aircraft guest tokens display an aircraft list, while single-aircraft tokens auto-redirect to the tracking page. Navigation is context-aware for owners and guests.
-   **Public Tracking**: A dedicated page `/track/[id]` accepts either tail number or hex code for public flight tracking.
-   **Real-time Tracking**: Displays live aircraft position, dual-color flight paths (completed and remaining), and IFR waypoints on an interactive **Leaflet map**.
-   **Map Visualizations**: Features dual-color track segments (purple for completed, gray dashed for remaining), origin/destination markers, a rotating blue airplane icon for current position, and airport labels with leader lines. Includes sparse IFR waypoint labels and user-toggleable display controls for labels and waypoints with localStorage persistence.
-   **Error Handling**: Provides status-specific error messages (404, 429, 502/503), a top-of-map error banner with retry functionality, and maintains last known data during transient errors.
-   **Flight Data**: Integrates with external APIs for origin/destination, IFR flight plans, and historical data.
-   **N-number Conversion**: Utilizes a mathematical algorithm for instant, accurate bidirectional conversion between US N-numbers and ICAO hex codes, enforcing a **US-only restriction**.
-   **Performance & Reliability**: Achieved through client-side polling for live updates (30-second interval), a provider cascade (`FlightAware` primary → `AviationStack` fallback) with in-memory caching, and robust rate limiting. Future consideration: shifting to data providers with metered polling limits.
-   **Security**: All tokens (session, verification, guest) use 256-bit entropy and are SHA-256 hashed at rest. Guest tokens auto-revoke on aircraft deletion and inactivity. Authentication and ownership validation are enforced on all protected endpoints. Password reset functionality includes token invalidation, single-use tokens, and a 1-hour expiration.

**Technical Implementations:**
-   **Configuration**: Separates sensitive secrets (Replit Secrets) from public configuration.
-   **Rate Limiting**: Implemented with a sliding window algorithm for API endpoints.
-   **Email System**: Supports SMTP with development fallback to file transport.
-   **Map Rendering**: Client-side only using dynamic imports for SSR optimization. Map UI enhancements include custom Leaflet controls, DivIcon-based labels with precise positioning, leader lines, and smart label placement. Duplicate dashed paths are prevented by using segment-boundary keys for `Polyline` components or imperative `ManagedPolyline` components.
-   **Guest Token System**: Uses JSONB storage for multi-aircraft associations. Auto-revocation is enforced at validation. Smart deletion handling and per-aircraft removal are supported. Client-side SHA-256 hashing uses Web Crypto API with a `js-sha256` fallback.

## External Dependencies
-   **FlightAware AeroAPI**: Primary source for real-time flight data, origin/destination, and IFR flight plans.
-   **AviationStack API**: Fallback provider for origin/destination metadata.
-   **airport-data.com API**: Provides airport coordinates and details.
-   **PostgreSQL**: Relational database for all application data.
-   **Drizzle ORM**: For database interactions.
-   **Next.js**: Frontend framework.
-   **React**: UI library.
-   **Leaflet & react-leaflet**: Interactive mapping library.
-   **Tailwind CSS**: For styling.
-   **js-sha256**: SHA-256 hashing library (cross-browser fallback).