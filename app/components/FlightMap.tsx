"use client";

import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

type Point = {
  lat: number;
  lon: number;
  ts?: number;
  alt_ft?: number;
  gs_kt?: number;
  hdg?: number;
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
  
  // Return cached icon if it exists
  if (_planeIconCache.has(hdg)) {
    return _planeIconCache.get(hdg)!;
  }
  
  // Create and cache new icon
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

type FlightMapProps = {
  points: Point[];
  completedSegment: [number, number][];
  remainingSegment: [number, number][];
  origin: Point | null;
  destination: Point | null;
  current: Point | null;
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
  shouldAutoFit,
  onFitComplete,
}: FlightMapProps) {
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
      {points.length > 0 && <FitBounds points={points} shouldFit={shouldAutoFit} onFitComplete={onFitComplete} />}
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
    </MapContainer>
  );
}
