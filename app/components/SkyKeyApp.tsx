'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L, { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ---------- Types ----------
type Point = {
  lat: number;
  lon: number;
  ts?: number;
  alt_ft?: number;
  gs_kt?: number;
  hdg?: number;
};
type Track = { hex: string; tail?: string | null; points: Point[] };
type ApiError = { message?: string };

// ---------- Icons ----------
const pin = (fill: string) =>
  new L.DivIcon({
    className: '',
    html: `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='28' height='28'>
      <path fill='${fill}' stroke='black' stroke-width='1' d='M12 2c-3.31 0-6 2.69-6 6 0 4.5 6 12 6 12s6-7.5 6-12c0-3.31-2.69-6-6-6zm0 8.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z'/>
    </svg>`,
    iconAnchor: [14, 28],
  });

const planeIcon = (heading?: number) =>
  new L.DivIcon({
    className: '',
    html: `<div style="transform: rotate(${heading ?? 0}deg); transform-origin: center;">
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='30' height='30'>
        <path fill='dodgerblue' stroke='black' stroke-width='1' d='M21 16v2l-8-2-4 4H7l2-5-6-1-1-2 7-1L7 2h2l4 8 8-2v2l-7 3 7 3z'/>
      </svg>
    </div>`,
    iconAnchor: [15, 15],
  });

// ---------- Map helpers ----------
function FitBounds({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points?.length) return;
    const latlngs = points.map(p => [p.lat, p.lon]) as LatLngExpression[];
    const bounds = L.latLngBounds(latlngs as LatLngBoundsExpression);
    if (latlngs.length === 1) {
      map.setView(latlngs[0] as any, 10, { animate: true });
    } else {
      map.fitBounds(bounds.pad(0.25), { animate: true });
    }
  }, [points, map]);
  return null;
}

// ---------- Fetch layer ----------
async function safeFetch(url: string) {
  // Optional local mock toggle
  if (typeof window !== 'undefined' && (window as any).SKYKEY_MOCK) return mockFetch(url);

  const r = await fetch(url, { headers: { accept: 'application/json' } });
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

async function fetchHexByTail(tail: string): Promise<{ hex: string; tail: string }> {
  const url = `/api/resolve?tail=${encodeURIComponent(tail)}`;
  return safeFetch(url);
}

async function fetchRandomHex(): Promise<{ hex: string; tail?: string }> {
  const url = `/api/random`;
  return safeFetch(url);
}

// ---------- Local mock ----------
function mockFetch(url: string) {
  if (url.startsWith('/api/random')) return Promise.resolve({ hex: 'ABC123', tail: 'N123AB' });
  if (url.startsWith('/api/resolve')) {
    const q = new URLSearchParams(url.split('?')[1]);
    const tail = q.get('tail') || 'N123AB';
    return Promise.resolve({ hex: 'ABC123', tail });
  }
  if (url.startsWith('/api/track')) {
    const pts: Point[] = [
      { lat: 40.6413, lon: -73.7781, ts: Date.now() - 60 * 60 * 1000, alt_ft: 0, gs_kt: 0, hdg: 45 },
      { lat: 41.0, lon: -73.0, ts: Date.now() - 45 * 60 * 1000, alt_ft: 8000, gs_kt: 250, hdg: 45 },
      { lat: 41.5, lon: -72.5, ts: Date.now() - 30 * 60 * 1000, alt_ft: 12000, gs_kt: 280, hdg: 45 },
      { lat: 42.0, lon: -72.0, ts: Date.now() - 15 * 60 * 1000, alt_ft: 15000, gs_kt: 300, hdg: 50 },
      { lat: 42.3656, lon: -71.0096, ts: Date.now() - 2 * 60 * 1000, alt_ft: 1000, gs_kt: 160, hdg: 60 },
    ];
    return Promise.resolve({ hex: 'ABC123', tail: 'N123AB', points: pts });
  }
  return Promise.reject(new Error('Unknown mock route'));
}

// ---------- UI ----------
export default function SkyKeyApp() {
  const [hex, setHex] = useState('');
  const [tail, setTail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [livePoints, setLivePoints] = useState<Point[]>([]);

  // sanitize points to avoid toFixed on undefined
const rawPoints = (track?.points?.length ? track.points : livePoints) ?? [];
const points = useMemo(
  () => rawPoints.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)),
  [rawPoints]
);
const origin = points[0];
const current = points[points.length - 1];
const destination = points.length > 1 ? points[points.length - 1] : undefined;



  const onTailKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
  if (e.key === 'Enter') { e.preventDefault(); handleFetchByTail(tail); }
};
const onHexKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
  if (e.key === 'Enter') { e.preventDefault(); handleFetchByHex(hex); }
};


  const handleFetchByHex = useCallback(async (h: string) => {
    if (!h) return;
    setLoading(true);
    setError(null);
    try {
      const t = await fetchTrackByHex(h);
      setTrack(t);
    } catch (e: any) {
      setError(e.message || 'Failed');
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFetchByTail = useCallback(async (t: string) => {
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetchHexByTail(t);
      setHex(r.hex?.toUpperCase() ?? '');
      const tr = await fetchTrackByHex(r.hex);
      setTrack(tr);
    } catch (e: any) {
      setError(e.message || 'Failed');
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRandom = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetchRandomHex();
      setHex(r.hex?.toUpperCase() ?? '');
      const tr = await fetchTrackByHex(r.hex);
      setTrack(tr);
      if (r.tail) setTail(r.tail);
    } catch (e: any) {
      setError(e.message || 'Failed');
      setTrack(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const polyline = useMemo(
    () => (points.length ? (points.map(p => [p.lat, p.lon]) as LatLngExpression[]) : []),
    [points]
  );

  // reset live path when switching aircraft
useEffect(() => {
  setLivePoints([]);
}, [hex]);

// poll /api/state every 10s if no multi-point track yet
useEffect(() => {
  if (!hex || (track?.points?.length ?? 0) > 1) return;
  let stop = false;

  async function tick() {
    try {
      const r = await fetch(`/api/state?hex=${encodeURIComponent(hex)}`, { cache: "no-store" });
      const j = await r.json();
      const p = j?.point;
      if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
        setLivePoints(prev => {
          const last = prev[prev.length - 1];
          const moved = !last || last.lat !== p.lat || last.lon !== p.lon;
          return moved ? [...prev, p] : prev;
        });
      }
    } catch {}
    if (!stop) setTimeout(tick, 10000);
  }

  tick();
  return () => { stop = true; };
}, [hex, track?.points?.length]);


  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr] bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="p-4 border-b bg-white flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sky-Key Tracker</h1>
          <p className="text-sm text-slate-600">
            Enter tail or hex. Or pick Random. Map auto-centers on the full path. Icons mark origin,
            destination, and current position.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label className="text-xs">Tail</label>
            <input
              value={tail}
              onChange={e => setTail(e.target.value.toUpperCase())}
                onKeyDown={onTailKeyDown}
               placeholder="N123AB"
              className="px-3 py-2 border rounded w-40"
            />
          </div>
          <button
            onClick={() => handleFetchByTail(tail)}
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={loading || !tail}
          >
            Lookup
          </button>

          <div className="flex flex-col md:ml-4">
            <label className="text-xs">Hex</label>
            <input
              value={hex}
              onChange={e => setHex(e.target.value.toUpperCase())}
              onKeyDown={onHexKeyDown}
              placeholder="ABC123"
              className="px-3 py-2 border rounded w-36"
            />
          </div>
          <button
            onClick={() => handleFetchByHex(hex)}
            className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
            disabled={loading || !hex}
          >
            Track
          </button>

          <button
            onClick={handleRandom}
            className="px-3 py-2 rounded border border-slate-300 md:ml-4 disabled:opacity-50"
            disabled={loading}
          >
            Random
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="grid md:grid-cols-[1fr_360px]">
        <section className="relative">
          <MapContainer center={[39.5, -98.35]} zoom={4} className="h-full w-full">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />
            {points.length > 0 && <FitBounds points={points} />}
            {polyline.length > 1 && <Polyline positions={polyline} weight={3} opacity={0.8} />}
            {origin && <Marker position={[origin.lat, origin.lon]} icon={pin('#10b981')} />}
            {destination && (
              <Marker position={[destination.lat, destination.lon]} icon={pin('#ef4444')} />
            )}
            {current && <Marker position={[current.lat, current.lon]} icon={planeIcon(current.hdg)} />}
          </MapContainer>
        </section>

        <aside className="p-4 border-l bg-white">
          <h2 className="font-medium mb-2">Flight</h2>
          {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
          <dl className="text-sm grid grid-cols-3 gap-2">
            <dt className="text-slate-500">HEX</dt>
            <dd className="col-span-2">{track?.hex || '—'}</dd>

            <dt className="text-slate-500">Tail</dt>
            <dd className="col-span-2">{track?.tail || '—'}</dd>

            <dt className="text-slate-500">Points</dt>
            <dd className="col-span-2">{points.length}</dd>

            <dt className="text-slate-500">Origin</dt>
            <dd className="col-span-2">
              {origin ? `${origin.lat.toFixed(3)}, ${origin.lon.toFixed(3)}` : '—'}
            </dd>

            <dt className="text-slate-500">Current</dt>
            <dd className="col-span-2">
              {current ? `${current.lat.toFixed(3)}, ${current.lon.toFixed(3)}` : '—'}
            </dd>

            <dt className="text-slate-500">Alt</dt>
            <dd className="col-span-2">{Number.isFinite(current?.alt_ft) ? `${current!.alt_ft} ft` : '—'}</dd>

            <dt className="text-slate-500">GS</dt>
            <dd className="col-span-2">{Number.isFinite(current?.gs_kt) ? `${current!.gs_kt} kt` : '—'}</dd>

            <dt className="text-slate-500">Hdg</dt>
            <dd className="col-span-2">{Number.isFinite(current?.hdg) ? current!.hdg : '—'}</dd>
          </dl>
        </aside>
      </main>

      <footer className="p-3 text-center text-xs text-slate-500 border-t bg-white">
        Sky-Key • v1 front end • map by OpenStreetMap
      </footer>
    </div>
  );
}
