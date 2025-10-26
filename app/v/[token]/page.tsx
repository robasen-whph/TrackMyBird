'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hashToken } from '@/lib/auth';
import Link from 'next/link';
import { AlertCircle, Plane } from 'lucide-react';

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

  useEffect(() => {
    async function validateToken() {
      try {
        setLoading(true);
        setError(null);

        // Hash the token
        const tokenHash = hashToken(token);

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
        setTokenData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to validate token');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      validateToken();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Validating access...</p>
        </div>
      </div>
    );
  }

  if (error || !tokenData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-6">
            {error || 'This tracking link is invalid or has expired.'}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="link-home"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const { nickname, aircraft, duration, status, expiresAt } = tokenData;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-slate-900">TrackMyBird</h1>
          <p className="text-sm text-slate-600 mt-1">Guest Access</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Guest Info Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            {nickname ? `Welcome, ${nickname}` : 'Welcome'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Access Duration:</span>
              <span className="ml-2 font-medium text-slate-900" data-testid="text-duration">
                {duration}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Status:</span>
              <span
                className={`ml-2 font-medium ${
                  status === 'Active' ? 'text-green-600' : 'text-slate-600'
                }`}
                data-testid="text-status"
              >
                {status}
              </span>
            </div>
            {expiresAt && (
              <div>
                <span className="text-slate-600">Expires:</span>
                <span className="ml-2 font-medium text-slate-900" data-testid="text-expires">
                  {new Date(expiresAt).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Aircraft List */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Tracked Aircraft ({aircraft.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {aircraft.map((ac) => (
              <Link
                key={ac.id}
                href={`/track/${ac.tail}`}
                className="block p-4 border border-slate-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                data-testid={`card-aircraft-${ac.id}`}
              >
                <div className="flex items-center gap-3">
                  <Plane className="w-8 h-8 text-blue-600" />
                  <div>
                    <div className="font-semibold text-slate-900" data-testid={`text-tail-${ac.id}`}>
                      {ac.tail}
                    </div>
                    <div className="text-sm text-slate-600" data-testid={`text-hex-${ac.id}`}>
                      {ac.hex}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
