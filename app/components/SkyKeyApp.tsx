"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L, { LatLngBoundsExpression, LatLngExpression } from "leaflet";
import { Eye, EyeOff, Info } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { AboutModal } from "./AboutModal";

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

// ---------- Icons ----------
const originPin = new L.DivIcon({
  className: "",
  html: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='36' height='36'>
    <path fill='#10b981' stroke='white' stroke-width='2' d='M16 2c-4.5 0-8 3.5-8 8 0 6 8 16 8 16s8-10 8-16c0-4.5-3.5-8-8-8z'/>
    <circle cx='16' cy='10' r='4' fill='white'/>
  </svg>`,
  iconAnchor: [18, 36],
});

const destinationPin = new L.DivIcon({
  className: "",
  html: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='36' height='36'>
    <path fill='#ef4444' stroke='white' stroke-width='2' d='M16 2c-4.5 0-8 3.5-8 8 0 6 8 16 8 16s8-10 8-16c0-4.5-3.5-8-8-8z'/>
    <circle cx='16' cy='10' r='4' fill='white'/>
  </svg>`,
  iconAnchor: [18, 36],
});

const planeIcon = (heading?: number) =>
  new L.DivIcon({
    className: "",
    html: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-24 -24 48 48' width='48' height='48' style="transform: rotate(${heading ?? 0}deg);">
      <path fill='#3b82f6' stroke='white' stroke-width='1.5' 
            d='M0,-16 L3,-14 L10,-4 L10,0 L4,0 L4,6 L7,10 L3,10 L0,8 L-3,10 L-7,10 L-4,6 L-4,0 L-10,0 L-10,-4 L-3,-14 Z'/>
      <ellipse cx='0' cy='-8' rx='2.5' ry='4' fill='#1e40af' opacity='0.6'/>
    </svg>`,
    iconAnchor: [24, 24],
  });

// ---------- Map helpers ----------
function FitBounds({ points, shouldFit, onFitComplete }: { 
  points: Point[]; 
  shouldFit: boolean;
  onFitComplete: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!shouldFit || !points?.length) return;
    const latlngs = points.map((p) => [p.lat, p.lon]) as LatLngExpression[];
    const bounds = L.latLngBounds(latlngs);
    if (latlngs.length === 1) {
      map.setView(latlngs[0] as any, 10, { animate: true });
    } else {
      map.fitBounds(bounds.pad(0.25), { animate: true });
    }
    onFitComplete();
  }, [points, map, shouldFit, onFitComplete]);
  return null;
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
    throw new Error(msg || `HTTP ${r.status}`);
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

const VERSION = "0.3";

// ---------- UI ----------
export default function SkyKeyApp() {
  const [hex, setHex] = useState("");
  const [tail, setTail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    // Clear the last fitted hex to force re-fit even if same hex
    lastFittedHexRef.current = null;
    try {
      const t = await fetchTrackByHex(h);
      setTrack(t);
    } catch (e: any) {
      setError(e.message || "Failed");
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFetchByTail = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    setError(null);
    // Clear the last fitted hex to force re-fit even if same hex
    lastFittedHexRef.current = null;
    try {
      const r = await fetchHexByTail(t);
      setHex(r.hex?.toUpperCase() ?? "");
      const tr = await fetchTrackByHex(r.hex);
      setTrack(tr);
    } catch (e: any) {
      setError(e.message || "Failed");
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRandom = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Clear the last fitted hex to force re-fit even if same hex
    lastFittedHexRef.current = null;
    try {
      const r = await fetchRandomHex();
      setHex(r.hex?.toUpperCase() ?? "");
      const tr = await fetchTrackByHex(r.hex);
      setTrack(tr);
      if (r.tail) setTail(r.tail);
    } catch (e: any) {
      setError(e.message || "Failed");
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Split track into two segments: completed (origin to current) and remaining (current to destination)
  const completedSegment = useMemo(() => {
    if (!filteredTrackPoints.length) return [];
    
    const segment: LatLngExpression[] = [];
    
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
    const segment: LatLngExpression[] = [[lastPoint.lat, lastPoint.lon]];
    
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
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">TrackMyBird</h1>
            <button
              onClick={() => setShowAbout(true)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              title="About this app"
              aria-label="About"
            >
              <Info className="w-5 h-5" />
            </button>
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

          {/* Random Button */}
          <button
            onClick={handleRandom}
            className="px-4 py-2 rounded border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:border-slate-300"
            disabled={loading}
          >
            Random
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="grid md:grid-cols-[1fr_360px]">
        <section className="relative">
          <MapContainer
            center={[39.5, -98.35]}
            zoom={4}
            className="h-full w-full"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            {points.length > 0 && <FitBounds points={points} shouldFit={shouldAutoFit} onFitComplete={handleFitComplete} />}
            {completedSegment.length > 1 && (
              <Polyline
                positions={completedSegment}
                color="#a855f7"
                weight={4}
                opacity={0.9}
              />
            )}
            {remainingSegment.length > 1 && (
              <Polyline
                positions={remainingSegment}
                color="#94a3b8"
                weight={4}
                opacity={0.6}
                dashArray="8, 8"
              />
            )}
            {origin && (
              <Marker position={[origin.lat, origin.lon]} icon={originPin} />
            )}
            {destination && (
              <Marker
                position={[destination.lat, destination.lon]}
                icon={destinationPin}
              />
            )}
            {current && (
              <Marker
                position={[current.lat, current.lon]}
                icon={planeIcon(current.hdg)}
              />
            )}
          </MapContainer>
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
