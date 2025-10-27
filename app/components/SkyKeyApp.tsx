"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from 'next/dynamic';
import { Eye, EyeOff, Info } from "lucide-react";
import { AboutModal } from "./AboutModal";
import { hashTokenClient } from "@/lib/hash-client";

// Dynamically import FlightMap to prevent SSR issues with Leaflet
const FlightMap = dynamic(
  () => import('./FlightMap').then((mod) => ({ default: mod.FlightMap })),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center bg-slate-100">Loading map...</div> }
);

// ---------- Types ----------
type Point = {
  lat: number;
  lon: number;
  ts?: number;
  alt_ft?: number;
  gs_kt?: number;
  hdg?: number;
};
type AirportInfo = {
  icao: string;
  name: string;
  city?: string;
  country: string;
  country_code: string;
  lat?: number;
  lon?: number;
};
type Waypoint = {
  name: string;
  lat: number;
  lon: number;
};
type Track = {
  hex: string;
  tail?: string | null;
  points: Point[];
  originAirport?: string | null;
  destinationAirport?: string | null;
  originInfo?: AirportInfo | null;
  destinationInfo?: AirportInfo | null;
  firstSeen?: number | null;
  lastSeen?: number | null;
  waypoints?: Waypoint[] | null;
};
type ApiError = { message?: string };

class FetchError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'FetchError';
  }
}

// ---------- Fetch layer ----------
async function safeFetch(url: string) {
  // Optional local mock toggle
  if (typeof window !== "undefined" && (window as any).SKYKEY_MOCK)
    return mockFetch(url);

  const r = await fetch(url, { headers: { accept: "application/json" } });
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const e: ApiError = await r.json();
      if (e?.message) msg = e.message;
    } catch {}
    throw new FetchError(msg || `HTTP ${r.status}`, r.status);
  }
  return r.json();
}

async function fetchTrackByHex(hex: string): Promise<Track> {
  const url = `/api/track?hex=${encodeURIComponent(hex)}`;
  return safeFetch(url);
}

async function fetchHexByTail(
  tail: string,
): Promise<{ hex: string; tail: string }> {
  const url = `/api/resolve?tail=${encodeURIComponent(tail)}`;
  return safeFetch(url);
}

async function fetchRandomHex(): Promise<{ hex: string; tail?: string }> {
  const url = `/api/random`;
  return safeFetch(url);
}

// ---------- Local mock ----------
function mockFetch(url: string) {
  if (url.startsWith("/api/random"))
    return Promise.resolve({ hex: "ABC123", tail: "N123AB" });
  if (url.startsWith("/api/resolve")) {
    const q = new URLSearchParams(url.split("?")[1]);
    const tail = q.get("tail") || "N123AB";
    return Promise.resolve({ hex: "ABC123", tail });
  }
  if (url.startsWith("/api/track")) {
    const pts: Point[] = [
      {
        lat: 40.6413,
        lon: -73.7781,
        ts: Date.now() - 60 * 60 * 1000,
        alt_ft: 0,
        gs_kt: 0,
        hdg: 45,
      },
      {
        lat: 41.0,
        lon: -73.0,
        ts: Date.now() - 45 * 60 * 1000,
        alt_ft: 8000,
        gs_kt: 250,
        hdg: 45,
      },
      {
        lat: 41.5,
        lon: -72.5,
        ts: Date.now() - 30 * 60 * 1000,
        alt_ft: 12000,
        gs_kt: 280,
        hdg: 45,
      },
      {
        lat: 42.0,
        lon: -72.0,
        ts: Date.now() - 15 * 60 * 1000,
        alt_ft: 15000,
        gs_kt: 300,
        hdg: 50,
      },
      {
        lat: 42.3656,
        lon: -71.0096,
        ts: Date.now() - 2 * 60 * 1000,
        alt_ft: 1000,
        gs_kt: 160,
        hdg: 60,
      },
    ];
    return Promise.resolve({ hex: "ABC123", tail: "N123AB", points: pts });
  }
  return Promise.reject(new Error("Unknown mock route"));
}

// ---------- Helpers ----------
function formatAirport(
  info: AirportInfo | null | undefined,
  icao: string | null | undefined,
): string {
  if (!info && !icao) return "Unknown";
  if (!info) return icao || "Unknown";

  const isUS = info.country_code === "US";
  const parts = [info.icao, info.name];
  if (!isUS && info.country) {
    parts.push(info.country);
  }
  return parts.join(" - ");
}

function formatTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  const date = new Date(ts * 1000);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "—";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

const VERSION = "0.45";

// Get user-friendly error message based on status code
function getErrorMessage(status: number | null, defaultMsg: string): string {
  if (!status) return defaultMsg;
  
  switch (status) {
    case 404:
      return "No current flight found for this aircraft.";
    case 429:
      return "Tracking data temporarily unavailable. Please try again in a few minutes.";
    case 502:
    case 503:
      return "Flight data service is momentarily unavailable.";
    default:
      return "We're having trouble loading flight details right now.";
  }
}

// ---------- UI ----------
interface SkyKeyAppProps {
  initialId?: string;
  guestToken?: string | null;
}

export function SkyKeyApp({ initialId, guestToken }: SkyKeyAppProps = {}) {
  const [hex, setHex] = useState("");
  const [tail, setTail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [livePoints, setLivePoints] = useState<Point[]>([]);
  const [showVersion, setShowVersion] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("skykey-show-version");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [showAbout, setShowAbout] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isMultiAircraftGuest, setIsMultiAircraftGuest] = useState<boolean>(false);
  
  // Track the last hex that was auto-fitted to prevent re-fitting on polling updates
  const lastFittedHexRef = useRef<string | null>(null);
  const [shouldAutoFit, setShouldAutoFit] = useState(false);

  // sanitize points to avoid toFixed on undefined
  const rawPoints = (track?.points?.length ? track.points : livePoints) ?? [];
  
  // Get filtered track points and actual aircraft position
  const filteredTrackPoints = useMemo(
    () => rawPoints.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
    [rawPoints]
  );
  
  // Build polyline points with origin/destination airports for visual continuity
  const points = useMemo(
    () => {
      let result = filteredTrackPoints;
      
      // Prepend origin airport coordinates if available to connect track to origin marker
      if (Number.isFinite(track?.originInfo?.lat) && Number.isFinite(track?.originInfo?.lon) && filteredTrackPoints.length > 0) {
        const originPoint: Point = {
          lat: track.originInfo.lat!,
          lon: track.originInfo.lon!,
        };
        result = [originPoint, ...result];
      }
      
      // Append destination airport coordinates if available to connect track to destination marker
      if (Number.isFinite(track?.destinationInfo?.lat) && Number.isFinite(track?.destinationInfo?.lon) && filteredTrackPoints.length > 0) {
        const destinationPoint: Point = {
          lat: track.destinationInfo.lat!,
          lon: track.destinationInfo.lon!,
        };
        result = [...result, destinationPoint];
      }
      
      return result;
    },
    [filteredTrackPoints, track?.originInfo, track?.destinationInfo],
  );
  
  // Origin marker uses airport coordinates if available, otherwise first track point
  const origin = Number.isFinite(track?.originInfo?.lat) && Number.isFinite(track?.originInfo?.lon)
    ? { lat: track.originInfo.lat!, lon: track.originInfo.lon! }
    : filteredTrackPoints[0];
  
  // Current position uses the last actual track point (not destination airport)
  const current = filteredTrackPoints.length > 0 
    ? filteredTrackPoints[filteredTrackPoints.length - 1] 
    : undefined;
  
  // Destination marker uses airport coordinates if available
  const destination = Number.isFinite(track?.destinationInfo?.lat) && Number.isFinite(track?.destinationInfo?.lon)
    ? { lat: track.destinationInfo.lat!, lon: track.destinationInfo.lon! }
    : undefined;

  // Flight timing calculations
  const now = Math.floor(Date.now() / 1000);
  const departureTime = track?.firstSeen;
  const arrivalTime = track?.lastSeen;
  const duration =
    departureTime && arrivalTime ? arrivalTime - departureTime : null;
  const isFlightCompleted = arrivalTime && arrivalTime < now;
  const timeRemaining =
    arrivalTime && !isFlightCompleted ? arrivalTime - now : null;

  // Check authentication status
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function checkAuth() {
      try {
        const res = await fetch('/api/aircraft', { signal: controller.signal });
        if (mounted) {
          setIsAuthenticated(res.ok);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError' && mounted) {
          setIsAuthenticated(false);
        }
      }
    }
    checkAuth();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  // Validate guest token if provided
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function validateGuestToken() {
      if (!guestToken) {
        if (mounted) {
          setIsMultiAircraftGuest(false);
        }
        return;
      }

      try {
        // Hash the token using client-safe function
        const tokenHash = await hashTokenClient(guestToken);

        const res = await fetch('/api/v/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash: tokenHash }),
          signal: controller.signal,
        });

        if (res.ok && mounted) {
          const data = await res.json();
          setIsMultiAircraftGuest(data.aircraft && data.aircraft.length > 1);
        } else if (mounted) {
          setIsMultiAircraftGuest(false);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError' && mounted) {
          setIsMultiAircraftGuest(false);
        }
      }
    }

    validateGuestToken();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [guestToken]);

  // Save version toggle preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("skykey-show-version", String(showVersion));
    }
  }, [showVersion]);

  const onTailKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFetchByTail(tail);
    }
  };
  const onHexKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFetchByHex(hex);
    }
  };

  const handleFetchByHex = useCallback(async (h: string) => {
    if (!h) return;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    // Clear the last fitted hex to force re-fit even if same hex
    lastFittedHexRef.current = null;
    try {
      const t = await fetchTrackByHex(h);
      setTrack(t);
    } catch (e: any) {
      setError(e.message || "Failed");
      const status = e instanceof FetchError ? e.status : null;
      setErrorStatus(status);
      // Only clear track on 404 (not found) - preserve data for transient errors
      if (status === 404) {
        setTrack(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFetchByTail = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    // Clear the last fitted hex to force re-fit even if same hex
    lastFittedHexRef.current = null;
    try {
      const r = await fetchHexByTail(t);
      setHex(r.hex?.toUpperCase() ?? "");
      const tr = await fetchTrackByHex(r.hex);
      setTrack(tr);
    } catch (e: any) {
      setError(e.message || "Failed");
      const status = e instanceof FetchError ? e.status : null;
      setErrorStatus(status);
      // Only clear track on 404 (not found) - preserve data for transient errors
      if (status === 404) {
        setTrack(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount if initialId is provided
  useEffect(() => {
    if (!initialId) return;
    
    // Detect if it's a hex (6 chars alphanumeric) or tail (starts with N)
    const isHex = /^[A-Fa-f0-9]{6}$/.test(initialId);
    const isTail = /^N/.test(initialId.toUpperCase());
    
    if (isHex) {
      setHex(initialId.toUpperCase());
      handleFetchByHex(initialId.toUpperCase());
    } else if (isTail) {
      setTail(initialId.toUpperCase());
      handleFetchByTail(initialId.toUpperCase());
    }
  }, [initialId, handleFetchByHex, handleFetchByTail]);

  const handleRandom = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    // Clear the last fitted hex to force re-fit even if same hex
    lastFittedHexRef.current = null;
    // Clear both fields first
    setTail("");
    setHex("");
    try {
      const r = await fetchRandomHex();
      setHex(r.hex?.toUpperCase() ?? "");
      const tr = await fetchTrackByHex(r.hex);
      setTrack(tr);
      // Set tail number from track data if available
      if (tr.tail) {
        setTail(tr.tail);
      }
    } catch (e: any) {
      setError(e.message || "Failed");
      const status = e instanceof FetchError ? e.status : null;
      setErrorStatus(status);
      // Only clear track on 404 (not found) - preserve data for transient errors
      if (status === 404) {
        setTrack(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Split track into two segments: completed (origin to current) and remaining (current to destination)
  const completedSegment = useMemo(() => {
    if (!filteredTrackPoints.length) return [];
    
    const segment: [number, number][] = [];
    
    // Add origin airport if available
    if (Number.isFinite(track?.originInfo?.lat) && Number.isFinite(track?.originInfo?.lon)) {
      segment.push([track.originInfo.lat!, track.originInfo.lon!]);
    }
    
    // Add all actual track points
    filteredTrackPoints.forEach(p => segment.push([p.lat, p.lon]));
    
    return segment;
  }, [filteredTrackPoints, track?.originInfo]);

  const remainingSegment = useMemo(() => {
    if (!filteredTrackPoints.length || !destination) return [];
    
    const lastPoint = filteredTrackPoints[filteredTrackPoints.length - 1];
    const segment: [number, number][] = [[lastPoint.lat, lastPoint.lon]];
    
    // Use IFR waypoints if available, otherwise straight line to destination
    if (track?.waypoints && track.waypoints.length > 0) {
      // Add each waypoint in order
      track.waypoints.forEach(wp => {
        segment.push([wp.lat, wp.lon]);
      });
    }
    
    // Add final destination
    segment.push([destination.lat, destination.lon]);
    
    return segment;
  }, [filteredTrackPoints, destination, track?.waypoints]);

  // reset live path when switching aircraft
  useEffect(() => {
    setLivePoints([]);
  }, [hex]);
  
  // Trigger auto-fit when points are loaded for a new aircraft
  useEffect(() => {
    if (points.length > 0 && track?.hex && track.hex !== lastFittedHexRef.current) {
      setShouldAutoFit(true);
    }
  }, [points.length, track?.hex]);
  
  // Callback to reset auto-fit flag and update last fitted hex after fit completes
  const handleFitComplete = useCallback(() => {
    setShouldAutoFit(false);
    if (track?.hex) {
      lastFittedHexRef.current = track.hex;
    }
  }, [track?.hex]);

  // 30-second polling for live updates
  useEffect(() => {
    if (!hex) return;

    const pollInterval = setInterval(async () => {
      try {
        console.log(`[POLL] Updating track for ${hex}`);
        const updatedTrack = await fetchTrackByHex(hex);
        setTrack(updatedTrack);
        setError(null); // Clear any previous errors on successful update
      } catch (e) {
        // Silently handle polling errors - aircraft may have landed or left coverage
        // The last known track data remains displayed
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.log(`[POLL] Update unavailable for ${hex}: ${errorMsg}`);
        // Don't set error state for polling failures to avoid alarming the user
      }
    }, 5000); // 30 seconds -> 5 seconds for testing

    return () => clearInterval(pollInterval);
  }, [hex]);

  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr] bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="p-4 border-b bg-white flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">TrackMyBird</h1>
            <button
              onClick={() => setShowAbout(true)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="About this app"
              aria-label="About"
            >
              <Info className="w-5 h-5" />
            </button>
            {isAuthenticated && (
              <a
                href="/dashboard"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                data-testid="link-dashboard"
              >
                ← My Dashboard
              </a>
            )}
            {!isAuthenticated && isMultiAircraftGuest && guestToken && (
              <a
                href={`/v/${guestToken}`}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                data-testid="link-guest-dashboard"
              >
                ← View All Aircraft
              </a>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Track your aircraft and share with family and friends. 
            <span className="text-slate-500"> US aircraft only (N-numbers).</span>
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* Tail Number Section */}
          <div className="flex items-end gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-blue-900">Tail Number</label>
              <input
                value={tail}
                onChange={(e) => {
                  setTail(e.target.value.toUpperCase());
                  if (e.target.value && hex) setHex("");
                }}
                onKeyDown={onTailKeyDown}
                placeholder="Enter N-number"
                className="px-3 py-2 border rounded w-40 bg-white"
              />
            </div>
            <button
              onClick={() => handleFetchByTail(tail)}
              className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700 transition-colors"
              disabled={loading || !tail}
            >
              Lookup
            </button>
          </div>

          {/* OR Divider */}
          <div className="flex items-center">
            <div className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-semibold rounded-full">
              OR
            </div>
          </div>

          {/* Hex Code Section */}
          <div className="flex items-end gap-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex flex-col">
              <label className="text-xs font-medium text-purple-900">Hex Code</label>
              <input
                value={hex}
                onChange={(e) => {
                  setHex(e.target.value.toUpperCase());
                  if (e.target.value && tail) setTail("");
                }}
                onKeyDown={onHexKeyDown}
                placeholder="Enter hex code"
                className="px-3 py-2 border rounded w-40 bg-white"
              />
            </div>
            <button
              onClick={() => handleFetchByHex(hex)}
              className="px-3 py-2 rounded bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-700 transition-colors"
              disabled={loading || !hex}
            >
              Track
            </button>
          </div>

          {/* Random Button - Temporarily Disabled */}
          <button
            onClick={handleRandom}
            className="px-4 py-2 rounded border-2 border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={true}
            title="Random aircraft feature temporarily unavailable"
          >
            Random
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="grid md:grid-cols-[1fr_360px]">
        <section className="relative">
          {/* Error Banner */}
          {error && (
            <div className="absolute top-0 left-0 right-0 z-[1000] bg-red-50 border-b-2 border-red-300 p-4 shadow-md">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-red-900">
                    {getErrorMessage(errorStatus, error)}
                  </p>
                  {errorStatus && (
                    <p className="text-xs text-red-700 mt-1">Error code: {errorStatus}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (hex) {
                      handleFetchByHex(hex);
                    } else if (tail) {
                      handleFetchByTail(tail);
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  disabled={loading || (!hex && !tail)}
                  data-testid="button-retry"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          <FlightMap
            points={points}
            completedSegment={completedSegment}
            remainingSegment={remainingSegment}
            origin={origin}
            destination={destination}
            current={current}
            originAirport={track?.originAirport}
            destinationAirport={track?.destinationAirport}
            waypoints={track?.waypoints}
            shouldAutoFit={shouldAutoFit}
            onFitComplete={handleFitComplete}
          />
        </section>

        <aside className="p-4 border-l bg-white overflow-y-auto">
          <h2 className="font-medium mb-2">Flight</h2>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          <dl className="text-sm space-y-3">
            <div>
              <dt className="text-slate-500 font-medium">HEX</dt>
              <dd className="mt-0.5">{track?.hex || "—"}</dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Tail</dt>
              <dd className="mt-0.5">{track?.tail || "—"}</dd>
            </div>

            <div className="pt-2 border-t">
              <dt className="text-slate-500 font-medium">Origin</dt>
              <dd className="mt-0.5 text-xs leading-relaxed">
                {formatAirport(track?.originInfo, track?.originAirport)}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Destination</dt>
              <dd className="mt-0.5 text-xs leading-relaxed">
                {formatAirport(
                  track?.destinationInfo,
                  track?.destinationAirport,
                )}
              </dd>
            </div>

            <div className="pt-2 border-t">
              <dt className="text-slate-500 font-medium">Departure</dt>
              <dd className="mt-0.5 text-xs">{formatTime(departureTime)}</dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Arrival (Est)</dt>
              <dd className="mt-0.5 text-xs">{formatTime(arrivalTime)}</dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Duration</dt>
              <dd className="mt-0.5">{formatDuration(duration)}</dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Time Remaining</dt>
              <dd className="mt-0.5">{formatDuration(timeRemaining)}</dd>
            </div>

            <div className="pt-2 border-t">
              <dt className="text-slate-500 font-medium">Track Points</dt>
              <dd className="mt-0.5">{points.length}</dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Current Position</dt>
              <dd className="mt-0.5 text-xs">
                {current
                  ? `${current.lat.toFixed(3)}, ${current.lon.toFixed(3)}`
                  : "—"}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Altitude</dt>
              <dd className="mt-0.5">
                {Number.isFinite(current?.alt_ft)
                  ? `${current!.alt_ft} ft`
                  : "—"}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Ground Speed</dt>
              <dd className="mt-0.5">
                {Number.isFinite(current?.gs_kt) ? `${current!.gs_kt} kt` : "—"}
              </dd>
            </div>

            <div>
              <dt className="text-slate-500 font-medium">Heading</dt>
              <dd className="mt-0.5">
                {Number.isFinite(current?.hdg) ? `${current!.hdg}°` : "—"}
              </dd>
            </div>
          </dl>
        </aside>
      </main>

      <footer className="p-3 flex items-center justify-between text-xs text-slate-500 border-t bg-white">
        <span>TrackMyBird • Map by OpenStreetMap</span>
        <div className="flex items-center gap-2">
          {showVersion && <span className="font-mono">v{VERSION}</span>}
          <button
            onClick={() => setShowVersion((v) => !v)}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded hover:bg-slate-100"
            title={showVersion ? "Hide version" : "Show version"}
            aria-label={showVersion ? "Hide version" : "Show version"}
          >
            {showVersion ? (
              <Eye className="w-4 h-4" />
            ) : (
              <EyeOff className="w-4 h-4" />
            )}
          </button>
        </div>
      </footer>

      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  );
}

export default SkyKeyApp;
