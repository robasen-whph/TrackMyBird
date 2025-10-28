'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hashTokenClient } from '@/lib/hash-client';
import Link from 'next/link';
import { AlertCircle, Plane } from 'lucide-react';

export const runtime = 'edge';

interface Aircraft {
  id: number;
  tail: string;
  hex: string;
}

interface GuestTokenData {
  nickname: string | null;
  aircraft: Aircraft[];
  duration: string;
  status: string;
  expiresAt: Date | null;
}

export default function GuestViewPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tokenData, setTokenData] = useState<GuestTokenData | null>(null);

  // Validation effect - always runs first
  useEffect(() => {
    let mounted = true;

    async function validateToken() {
      try {
        setLoading(true);
        setError(null);

        // Hash the token using client-safe function
        const tokenHash = await hashTokenClient(token);

        // Validate with backend
        const response = await fetch('/api/v/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash: tokenHash }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Invalid or expired token');
        }

        const data = await response.json();
        if (mounted) {
          setTokenData(data);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to validate token');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    if (token) {
      validateToken();
    }

    return () => {
      mounted = false;
    };
  }, [token]);

  // Auto-redirect for single aircraft (must be declared before early returns)
  useEffect(() => {
    if (typeof window !== 'undefined' && tokenData && tokenData.aircraft.length === 1) {
      // Small delay to ensure router is fully ready
      const timeoutId = setTimeout(() => {
        router.push(`/track/${tokenData.aircraft[0].tail}?guest=${token}`);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [tokenData, token, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 dark:border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Validating access...</p>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'This tracking link is invalid or has expired.'}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            data-testid="link-home"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const { nickname, aircraft, duration, status, expiresAt } = tokenData;

  // Show loading while redirecting for single aircraft
  if (aircraft.length === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-600 dark:text-gray-400">Redirecting to flight tracker...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="h-full px-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">TrackMyBird</h1>
          <span className="text-sm text-gray-600 dark:text-gray-400">Guest Access</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            {nickname || 'Aircraft Tracking Access'}
          </h2>
          <div className="flex flex-wrap gap-4 mt-2">
            <p className="text-gray-600 dark:text-gray-400">
              Duration: <span className="font-medium" data-testid="text-duration">{duration}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Status: <span className={`font-medium ${status === 'Active' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} data-testid="text-status">{status}</span>
            </p>
            {expiresAt && (
              <p className="text-gray-600 dark:text-gray-400">
                Expires: <span className="font-medium" data-testid="text-expires">{new Date(expiresAt).toLocaleString()}</span>
              </p>
            )}
          </div>
        </div>

        {/* Aircraft List */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Plane className="w-5 h-5" />
              Available Aircraft ({aircraft.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {aircraft.map((ac) => (
              <Link
                key={ac.id}
                href={`/track/${ac.tail}?guest=${token}`}
                className="flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                data-testid={`card-aircraft-${ac.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Plane className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white" data-testid={`text-tail-${ac.id}`}>
                      {ac.tail}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-mono" data-testid={`text-hex-${ac.id}`}>
                      ICAO: {ac.hex}
                    </div>
                  </div>
                </div>
                <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">
                  Track Flight →
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
