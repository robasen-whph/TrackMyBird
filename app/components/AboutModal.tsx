"use client";

import { X } from "lucide-react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">About TrackMyBird</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold text-base mb-2">What is this app for?</h3>
            <p className="text-slate-700">
              TrackMyBird helps aircraft owners share real-time tracking with family, friends, 
              and business partners. It's designed for people who want to follow a specific 
              aircraft's journey—whether you're tracking a loved one's flight home or monitoring 
              a business trip.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">Why do some aircraft not show up on public tracking sites?</h3>
            <p className="text-slate-700 mb-2">
              Many aircraft owners participate in the FAA's <strong>LADD program</strong> (Limiting 
              Aircraft Data Displayed). This is a privacy program that blocks most public flight 
              tracking websites from displaying real-time tracking information.
            </p>
            <p className="text-slate-700">
              While LADD protects privacy from the general public, it also blocks tracking for people 
              the owner <em>wants</em> to share with—like family waiting for a safe arrival, or 
              business partners coordinating schedules.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">How does TrackMyBird work differently?</h3>
            <p className="text-slate-700">
              TrackMyBird uses direct aircraft data sources that aren't affected by LADD blocking. 
              Aircraft owners can share their tail number or tracking code with trusted people, 
              allowing them to follow flights even when public tracking sites show nothing.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2">US Aircraft Only</h3>
            <p className="text-slate-700">
              Currently, TrackMyBird supports <strong>US-registered aircraft only</strong> 
              (tail numbers starting with 'N'). The FAA LADD program is specific to US aircraft 
              registrations.
            </p>
          </section>

          <section className="pt-2 border-t">
            <h3 className="font-semibold text-base mb-2">How to use this app</h3>
            <ol className="list-decimal list-inside space-y-1 text-slate-700">
              <li>Enter your aircraft's tail number (like <code className="bg-slate-100 px-1 rounded">N260PC</code>) or hex code</li>
              <li>Click <strong>Lookup</strong> to convert tail to hex, then <strong>Track</strong></li>
              <li>Share the tracking link with family and friends</li>
              <li>The map shows real-time position, flight path, origin and destination</li>
            </ol>
          </section>

          <section className="pt-2 border-t">
            <p className="text-xs text-slate-500">
              <strong>Note:</strong> This app is for personal use by aircraft owners and their 
              authorized contacts. Tracking data is sourced from publicly available aircraft 
              broadcasts (ADS-B) and flight information databases.
            </p>
          </section>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
