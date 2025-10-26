'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Aircraft {
  id: number;
  tail: string;
  icao_hex: string;
  authorized_at: string;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [tail, setTail] = useState('');
  const [icaoHex, setIcaoHex] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    loadAircraft();
  }, []);

  const loadAircraft = async () => {
    try {
      const res = await fetch('/api/aircraft');
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        setError(data.error || 'Failed to load aircraft');
        setLoading(false);
        return;
      }

      setAircraft(data.aircraft || []);
      setLoading(false);
    } catch (err) {
      setError('Network error');
      setLoading(false);
    }
  };

  const handleAddAircraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/aircraft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tail, icao_hex: icaoHex }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAddError(data.message || data.error || 'Failed to add aircraft');
        setSubmitting(false);
        return;
      }

      // Success - reload aircraft list and close modal
      await loadAircraft();
      setShowAddModal(false);
      setTail('');
      setIcaoHex('');
      setSubmitting(false);
    } catch (err) {
      setAddError('Network error');
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this aircraft?')) {
      return;
    }

    try {
      const res = await fetch(`/api/aircraft/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        alert('Failed to delete aircraft');
        return;
      }

      // Reload aircraft list
      await loadAircraft();
    } catch (err) {
      alert('Network error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Navigation */}
      <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="h-full px-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            TrackMyBird
          </h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            data-testid="button-logout"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              My Aircraft
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your registered aircraft
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="h-10 px-6 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            data-testid="button-add-aircraft"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Aircraft
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid="text-error">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Aircraft Table or Empty State */}
        {aircraft.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-12 text-center">
            <div className="mx-auto h-32 w-32 mb-6 text-gray-400 dark:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No aircraft yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Add your first aircraft to start tracking
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
              data-testid="button-add-first-aircraft"
            >
              Add Aircraft
            </button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tail Number
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    ICAO Hex
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Authorized
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {aircraft.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50" data-testid={`row-aircraft-${a.id}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {a.tail}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {a.icao_hex}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {new Date(a.authorized_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleDelete(a.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        data-testid={`button-delete-${a.id}`}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add Aircraft Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                Add Aircraft
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setTail('');
                  setIcaoHex('');
                  setAddError('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                data-testid="button-close-modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddAircraft} className="space-y-6">
              {addError && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid="text-add-error">
                  <p className="text-sm text-red-800 dark:text-red-400">{addError}</p>
                </div>
              )}

              <div>
                <label htmlFor="tail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tail Number (N-Number)
                </label>
                <input
                  id="tail"
                  type="text"
                  value={tail}
                  onChange={(e) => setTail(e.target.value)}
                  required
                  className="w-full h-12 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-colors uppercase"
                  placeholder="N12345"
                  data-testid="input-tail"
                />
              </div>

              <div>
                <label htmlFor="icaoHex" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ICAO Hex Code
                </label>
                <input
                  id="icaoHex"
                  type="text"
                  value={icaoHex}
                  onChange={(e) => setIcaoHex(e.target.value)}
                  required
                  className="w-full h-12 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-colors uppercase font-mono"
                  placeholder="A12345"
                  maxLength={6}
                  data-testid="input-icao-hex"
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setTail('');
                    setIcaoHex('');
                    setAddError('');
                  }}
                  className="px-6 py-3 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                  data-testid="button-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-submit-aircraft"
                >
                  {submitting ? 'Adding...' : 'Add Aircraft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
