# TrackMyBird - Flight Tracker Application

## Overview
TrackMyBird is a real-time flight tracking application for US-registered aircraft (N-numbers). Its primary purpose is to enable US aircraft owners to share tracking information with authorized individuals, bypassing FAA LADD (Limiting Aircraft Data Displayed) privacy blocking. The project aims to provide a reliable and accessible platform for tracking flights with rich interactive map visualizations and detailed flight information.

## User Preferences
I prefer detailed explanations.
Ask before making major changes.
I want iterative development.
I prefer simple language.
I like functional programming.

## System Architecture
The application is built on **Next.js 15.5.6 with React 19.2.0** for the frontend, using the **App Router**. Styling is handled with **Tailwind CSS v4**. Data persistence uses **PostgreSQL with Drizzle ORM**. User authentication is session-based with email verification and HTTP-only cookies.

**Key Features:**
-   **User Authentication & Aircraft Management**: Secure signup/login, email verification, and CRUD operations for aircraft (tail number + hex code).
-   **Real-time Tracking**: Displays aircraft position, flight paths (completed and remaining), and IFR waypoints on an **interactive Leaflet map**.
-   **Map Visualizations**:
    -   Dual-color track segments: Purple for completed path, gray dashed for remaining path.
    -   Green pin for origin, red pin for destination, and a rotating blue airplane icon for current position.
    -   Airport markers for origin and destination.
-   **Flight Data**: Integration with external APIs for origin/destination data, IFR flight plans, and historical flight data.
-   **N-number Conversion**: Uses a mathematical algorithm for instant and accurate bidirectional conversion between US N-numbers and ICAO hex codes, without external API calls. This enforces a strict **US-only restriction** for aircraft.
-   **Performance & Reliability**: Features client-side polling for live updates, a provider cascade (`FlightAware` → `OpenSky Network` → `AviationStack`) with in-memory caching for flight status, and robust rate limiting.
-   **Security**: Sensitive configurations are managed via Replit Secrets. All API endpoints validate authentication and ownership.

**Technical Implementations:**
-   **Configuration**: Separated into sensitive secrets (managed by Replit Secrets) and public configuration with sensible defaults.
-   **Rate Limiting**: Implemented with a sliding window algorithm for API endpoints like `/api/random` and `/api/resolve`.
-   **Email System**: Supports SMTP with a fallback to file transport in development.
-   **Map Rendering**: Client-side only using dynamic imports to optimize server-side rendering.

## External Dependencies
-   **OpenSky Network REST API**: For real-time aircraft tracking (OAuth authenticated).
-   **FlightAware AeroAPI**: Primary source for origin/destination data and IFR flight plans.
-   **AviationStack API**: Fallback for origin/destination data.
-   **airport-data.com API**: Provides airport coordinates and details.
-   **PostgreSQL**: Relational database for storing user, session, and aircraft data.
-   **Drizzle ORM**: Used for database interactions.
-   **Next.js**: Frontend framework.
-   **React**: UI library.
-   **Leaflet & react-leaflet**: Interactive mapping library.
-   **Tailwind CSS**: For styling.