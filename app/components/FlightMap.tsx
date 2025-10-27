"use client";

import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";

type Point = {
  lat: number;
  lon: number;
  ts?: number;
  alt_ft?: number;
  gs_kt?: number;
  hdg?: number;
};

type Waypoint = {
  name: string;
  lat: number;
  lon: number;
};

// ---------- Icons (module-level cache) ----------
let _originPin: L.DivIcon | null = null;
let _destinationPin: L.DivIcon | null = null;
const _planeIconCache: Map<number, L.DivIcon> = new Map();

const getOriginPin = () => {
  if (!_originPin && typeof window !== 'undefined') {
    _originPin = new L.DivIcon({
      className: "",
      html: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='36' height='36'>
        <path fill='#10b981' stroke='white' stroke-width='2' d='M16 2c-4.5 0-8 3.5-8 8 0 6 8 16 8 16s8-10 8-16c0-4.5-3.5-8-8-8z'/>
        <circle cx='16' cy='10' r='4' fill='white'/>
      </svg>`,
      iconAnchor: [18, 36],
    });
  }
  return _originPin;
};

const getDestinationPin = () => {
  if (!_destinationPin && typeof window !== 'undefined') {
    _destinationPin = new L.DivIcon({
      className: "",
      html: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32' width='36' height='36'>
        <path fill='#ef4444' stroke='white' stroke-width='2' d='M16 2c-4.5 0-8 3.5-8 8 0 6 8 16 8 16s8-10 8-16c0-4.5-3.5-8-8-8z'/>
        <circle cx='16' cy='10' r='4' fill='white'/>
      </svg>`,
      iconAnchor: [18, 36],
    });
  }
  return _destinationPin;
};

const getPlaneIcon = (heading?: number) => {
  if (typeof window === 'undefined') return null;
  
  const hdg = Math.round(heading ?? 0);
  
  if (_planeIconCache.has(hdg)) {
    return _planeIconCache.get(hdg)!;
  }
  
  const icon = new L.DivIcon({
    className: "",
    html: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='-24 -24 48 48' width='48' height='48' style="transform: rotate(${hdg}deg);">
      <path fill='#3b82f6' stroke='white' stroke-width='1.5' 
            d='M0,-16 L3,-14 L10,-4 L10,0 L4,0 L4,6 L7,10 L3,10 L0,8 L-3,10 L-7,10 L-4,6 L-4,0 L-10,0 L-10,-4 L-3,-14 Z'/>
      <ellipse cx='0' cy='-8' rx='2.5' ry='4' fill='#1e40af' opacity='0.6'/>
    </svg>`,
    iconAnchor: [24, 24],
  });
  
  _planeIconCache.set(hdg, icon);
  return icon;
};

// Airport label with leader line
const getAirportLabel = (code: string, isOrigin: boolean) => {
  if (typeof window === 'undefined') return null;
  
  const bgColor = isOrigin ? '#10b981' : '#ef4444';
  // Estimate label width: ~9px per char at 14px font-weight 600, plus 16px padding + 4px border
  const estimatedWidth = (code.length * 9) + 20;
  const centerX = Math.round(estimatedWidth / 2);
  
  return new L.DivIcon({
    className: "",
    html: `<div style="
      display: inline-block;
      width: fit-content;
      position: relative;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      background: white;
      padding: 4px 8px;
      border-radius: 4px;
      border: 2px solid ${bgColor};
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      white-space: nowrap;
      pointer-events: none;
    ">${code}</div>`,
    iconAnchor: [centerX, 13],
  });
};

// Waypoint label
const getWaypointLabel = (name: string) => {
  if (typeof window === 'undefined') return null;
  
  // Estimate label width: ~7px per char at 11px font-weight 500, plus 12px padding + 2px border
  const estimatedWidth = (name.length * 7) + 14;
  const centerX = Math.round(estimatedWidth / 2);
  
  return new L.DivIcon({
    className: "",
    html: `<div style="
      display: inline-block;
      width: fit-content;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      font-weight: 500;
      color: #1f2937;
      background: rgba(255, 255, 255, 0.95);
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid #9ca3af;
      text-shadow: 0 0 3px white;
      white-space: nowrap;
      pointer-events: none;
    ">${name}</div>`,
    iconAnchor: [centerX, 9],
  });
};

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

// Imperative Polyline manager to prevent duplicate paths
function ManagedPolyline({ 
  positions, 
  color, 
  weight, 
  opacity, 
  dashArray 
}: { 
  positions: [number, number][]; 
  color: string; 
  weight: number; 
  opacity: number; 
  dashArray?: string;
}) {
  const map = useMap();
  const polylineRef = useRef<L.Polyline | null>(null);
  
  // Create polyline once on mount, cleanup on unmount
  useEffect(() => {
    polylineRef.current = L.polyline([], {
      color,
      weight,
      opacity,
      dashArray,
    }).addTo(map);
    
    // Cleanup ONLY on unmount
    return () => {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
    };
  }, [map]); // Only depends on map - runs once
  
  // Update polyline when positions or style change
  useEffect(() => {
    if (!polylineRef.current) return;
    
    if (positions.length > 1) {
      polylineRef.current.setLatLngs(positions as LatLngExpression[]);
      polylineRef.current.setStyle({ color, weight, opacity, dashArray });
    } else {
      // Clear polyline if no valid positions
      polylineRef.current.setLatLngs([]);
    }
  }, [positions, color, weight, opacity, dashArray]);
  
  return null;
}

// Map controls for toggles
function MapControls({ 
  showAirportLabels, 
  setShowAirportLabels, 
  showWaypointNames, 
  setShowWaypointNames 
}: {
  showAirportLabels: boolean;
  setShowAirportLabels: (val: boolean) => void;
  showWaypointNames: boolean;
  setShowWaypointNames: (val: boolean) => void;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const ControlsPanel = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create('div', 'leaflet-control-custom');
        div.style.background = 'white';
        div.style.padding = '8px 12px';
        div.style.borderRadius = '4px';
        div.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        div.style.fontSize = '13px';
        div.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        
        div.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
              <input type="checkbox" id="toggle-airport-labels" 
                     style="cursor: pointer;" data-testid="toggle-airport-labels" />
              <span>Show airport labels</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
              <input type="checkbox" id="toggle-waypoint-names"
                     style="cursor: pointer;" data-testid="toggle-waypoint-names" />
              <span>Show waypoint names</span>
            </label>
          </div>
        `;
        
        L.DomEvent.disableClickPropagation(div);
        
        const airportToggle = div.querySelector('#toggle-airport-labels') as HTMLInputElement;
        const waypointToggle = div.querySelector('#toggle-waypoint-names') as HTMLInputElement;
        
        // Set initial checked states
        if (airportToggle) airportToggle.checked = showAirportLabels;
        if (waypointToggle) waypointToggle.checked = showWaypointNames;
        
        airportToggle?.addEventListener('change', (e) => {
          const checked = (e.target as HTMLInputElement).checked;
          setShowAirportLabels(checked);
          localStorage.setItem('show-airport-labels', String(checked));
        });
        
        waypointToggle?.addEventListener('change', (e) => {
          const checked = (e.target as HTMLInputElement).checked;
          setShowWaypointNames(checked);
          localStorage.setItem('show-waypoint-names', String(checked));
        });
        
        return div;
      }
    });
    
    const control = new ControlsPanel({ position: 'topright' });
    control.addTo(map);
    
    return () => {
      control.remove();
    };
  }, [map, showAirportLabels, setShowAirportLabels, showWaypointNames, setShowWaypointNames]);
  
  return null;
}

type FlightMapProps = {
  points: Point[];
  completedSegment: [number, number][];
  remainingSegment: [number, number][];
  origin: Point | null;
  destination: Point | null;
  current: Point | null;
  originAirport?: string | null;
  destinationAirport?: string | null;
  waypoints?: Waypoint[] | null;
  shouldAutoFit: boolean;
  onFitComplete: () => void;
};

export function FlightMap({
  points,
  completedSegment,
  remainingSegment,
  origin,
  destination,
  current,
  originAirport,
  destinationAirport,
  waypoints,
  shouldAutoFit,
  onFitComplete,
}: FlightMapProps) {
  const [showAirportLabels, setShowAirportLabels] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('show-airport-labels');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });
  
  const [showWaypointNames, setShowWaypointNames] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('show-waypoint-names');
      return saved !== null ? saved === 'true' : false;
    }
    return false;
  });
  
  // Calculate label positions with offset to avoid marker overlap (~1 mile)
  const originLabelPos = origin ? [origin.lat, origin.lon + 0.015] as [number, number] : null;
  const destinationLabelPos = destination ? [destination.lat, destination.lon + 0.015] as [number, number] : null;
  
  // Select sparse waypoints (every 3rd waypoint to avoid clutter)
  const sparseWaypoints = waypoints?.filter((_, idx) => idx % 3 === 0 && idx > 0 && idx < waypoints.length - 1) || [];
  
  return (
    <MapContainer
      center={[39.5, -98.35]}
      zoom={4}
      className="h-full w-full"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap"
      />
      <MapControls 
        showAirportLabels={showAirportLabels} 
        setShowAirportLabels={setShowAirportLabels}
        showWaypointNames={showWaypointNames}
        setShowWaypointNames={setShowWaypointNames}
      />
      {points.length > 0 && <FitBounds points={points} shouldFit={shouldAutoFit} onFitComplete={onFitComplete} />}
      <ManagedPolyline
        positions={completedSegment}
        color="#a855f7"
        weight={4}
        opacity={0.9}
      />
      <ManagedPolyline
        positions={remainingSegment}
        color="#94a3b8"
        weight={4}
        opacity={0.6}
        dashArray="8, 8"
      />
      {origin && getOriginPin() && (
        <Marker position={[origin.lat, origin.lon]} icon={getOriginPin()!} />
      )}
      {destination && getDestinationPin() && (
        <Marker
          position={[destination.lat, destination.lon]}
          icon={getDestinationPin()!}
        />
      )}
      {current && getPlaneIcon(current.hdg) && (
        <Marker
          position={[current.lat, current.lon]}
          icon={getPlaneIcon(current.hdg)!}
        />
      )}
      
      {/* Airport labels with leader lines */}
      {showAirportLabels && origin && originAirport && originLabelPos && getAirportLabel(originAirport, true) && (
        <>
          <Polyline
            positions={[[origin.lat, origin.lon], originLabelPos]}
            color="#10b981"
            weight={1}
            opacity={0.6}
          />
          <Marker
            position={originLabelPos}
            icon={getAirportLabel(originAirport, true)!}
          />
        </>
      )}
      {showAirportLabels && destination && destinationAirport && destinationLabelPos && getAirportLabel(destinationAirport, false) && (
        <>
          <Polyline
            positions={[[destination.lat, destination.lon], destinationLabelPos]}
            color="#ef4444"
            weight={1}
            opacity={0.6}
          />
          <Marker
            position={destinationLabelPos}
            icon={getAirportLabel(destinationAirport, false)!}
          />
        </>
      )}
      
      {/* Waypoint names (sparse) */}
      {showWaypointNames && sparseWaypoints.map((wp, idx) => (
        getWaypointLabel(wp.name) && (
          <Marker
            key={`waypoint-${idx}-${wp.name}`}
            position={[wp.lat, wp.lon]}
            icon={getWaypointLabel(wp.name)!}
          />
        )
      ))}
    </MapContainer>
  );
}
