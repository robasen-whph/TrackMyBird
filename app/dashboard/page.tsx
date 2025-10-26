'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plane, Users, ExternalLink, Copy, Check } from 'lucide-react';

interface Aircraft {
  id: number;
  tail: string;
  icao_hex: string;
  authorized_at: string;
  created_at: string;
}

interface GuestToken {
  id: number;
  nickname: string | null;
  aircraft_count: number;
  duration: string;
  status: string;
  last_view_at: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'aircraft' | 'guest'>('aircraft');
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [guestTokens, setGuestTokens] = useState<GuestToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIssueAccessModal, setShowIssueAccessModal] = useState(false);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [selectedAircraft, setSelectedAircraft] = useState<number[]>([]);
  const [nickname, setNickname] = useState('');
  const [duration, setDuration] = useState<'24h' | 'permanent'>('permanent');
  const [tail, setTail] = useState('');
  const [icaoHex, setIcaoHex] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [regeneratingTokenId, setRegeneratingTokenId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadAircraft(), loadGuestTokens()]);
  };

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

  const loadGuestTokens = async () => {
    try {
      const res = await fetch('/api/invites');
      const data = await res.json();

      if (res.ok) {
        setGuestTokens(data.tokens || []);
      }
    } catch (err) {
      console.error('Failed to load guest tokens:', err);
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
    if (!confirm('Are you sure you want to delete this aircraft? Any guest tokens referencing this aircraft will be revoked.')) {
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

      await loadData();
    } catch (err) {
      alert('Network error');
    }
  };

  const handleIssueAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aircraft_ids: selectedAircraft,
          nickname: nickname || null,
          duration: duration,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAddError(data.error || 'Failed to create guest access');
        setSubmitting(false);
        return;
      }

      setGeneratedUrl(data.invite_url);
      await loadGuestTokens();
      setSubmitting(false);
    } catch (err) {
      setAddError('Network error');
      setSubmitting(false);
    }
  };

  const handleRegenerateLink = async (tokenId: number) => {
    setRegeneratingTokenId(tokenId);
    setAddError('');

    try {
      const res = await fetch(`/api/invites/${tokenId}/regenerate`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setAddError(data.error || 'Failed to regenerate link');
        setRegeneratingTokenId(null);
        return;
      }

      setGeneratedUrl(data.invite_url);
      setShowRegenerateModal(true);
      setRegeneratingTokenId(null);
    } catch (err) {
      setAddError('Network error');
      setRegeneratingTokenId(null);
    }
  };

  const handleRevokeToken = async (tokenId: number) => {
    if (!confirm('Are you sure you want to revoke this guest access?')) {
      return;
    }

    try {
      const res = await fetch(`/api/invites/${tokenId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        alert('Failed to revoke token');
        return;
      }

      await loadGuestTokens();
    } catch (err) {
      alert('Network error');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeIssueAccessModal = () => {
    setShowIssueAccessModal(false);
    setSelectedAircraft([]);
    setNickname('');
    setDuration('permanent');
    setAddError('');
    setGeneratedUrl('');
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
              Dashboard
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your aircraft and guest access
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('aircraft')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'aircraft'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              data-testid="tab-aircraft"
            >
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4" />
                My Aircraft
              </div>
            </button>
            <button
              onClick={() => setActiveTab('guest')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'guest'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
              data-testid="tab-guest"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Guest Access
              </div>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid="text-error">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* My Aircraft Tab */}
        {activeTab === 'aircraft' && (
          <div>
            <div className="flex justify-end mb-4">
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/track/${a.tail}`}
                            className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                            data-testid={`link-tail-${a.id}`}
                          >
                            {a.tail}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link
                            href={`/track/${a.icao_hex}`}
                            className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-mono"
                            data-testid={`link-hex-${a.id}`}
                          >
                            {a.icao_hex}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {new Date(a.authorized_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/track/${a.tail}`}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                              data-testid={`button-track-${a.id}`}
                            >
                              <ExternalLink className="w-4 h-4" />
                              Track
                            </Link>
                            <button
                              onClick={() => {
                                setSelectedAircraft([a.id]);
                                setShowIssueAccessModal(true);
                              }}
                              className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                              data-testid={`button-issue-access-${a.id}`}
                            >
                              Issue Access
                            </button>
                            <button
                              onClick={() => handleDelete(a.id)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              data-testid={`button-delete-${a.id}`}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Guest Access Tab */}
        {activeTab === 'guest' && (
          <div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowIssueAccessModal(true)}
                className="h-10 px-6 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                data-testid="button-new-guest-access"
              >
                <Users className="w-4 h-4" />
                New Guest Access
              </button>
            </div>

            {guestTokens.length === 0 ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-12 text-center">
                <div className="mx-auto h-32 w-32 mb-6 text-gray-400 dark:text-gray-600">
                  <Users className="w-full h-full" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  No guest access tokens
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create guest access to share aircraft tracking with others
                </p>
                <button
                  onClick={() => setShowIssueAccessModal(true)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                  data-testid="button-create-first-guest"
                >
                  Create Guest Access
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nickname
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Aircraft
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Access
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {guestTokens.map((token) => (
                      <tr key={token.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50" data-testid={`row-token-${token.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {token.nickname || '(No nickname)'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {token.aircraft_count} aircraft
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {token.duration}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              token.status === 'Active'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : token.status === 'Revoked'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : token.status === 'Dormant'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                            data-testid={`text-status-${token.id}`}
                          >
                            {token.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {token.last_view_at ? new Date(token.last_view_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => handleRegenerateLink(token.id)}
                              disabled={regeneratingTokenId === token.id}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-50"
                              data-testid={`button-regenerate-${token.id}`}
                            >
                              {regeneratingTokenId === token.id ? 'Regenerating...' : 'Regenerate Link'}
                            </button>
                            <button
                              onClick={() => handleRevokeToken(token.id)}
                              className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              data-testid={`button-revoke-${token.id}`}
                            >
                              Revoke
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

      {/* Issue Access Modal */}
      {showIssueAccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full p-6">
            {!generatedUrl ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Issue Guest Access
                  </h3>
                  <button
                    onClick={closeIssueAccessModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    data-testid="button-close-issue-modal"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleIssueAccess} className="space-y-6">
                  {addError && (
                    <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid="text-issue-error">
                      <p className="text-sm text-red-800 dark:text-red-400">{addError}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select Aircraft
                    </label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-lg p-3">
                      {aircraft.map((a) => (
                        <label key={a.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAircraft.includes(a.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAircraft([...selectedAircraft, a.id]);
                              } else {
                                setSelectedAircraft(selectedAircraft.filter(id => id !== a.id));
                              }
                            }}
                            className="rounded"
                            data-testid={`checkbox-aircraft-${a.id}`}
                          />
                          <span className="text-sm text-gray-900 dark:text-white">
                            {a.tail} ({a.icao_hex})
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nickname (Optional)
                    </label>
                    <input
                      id="nickname"
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      className="w-full h-12 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-colors"
                      placeholder="Family, Friends, etc."
                      data-testid="input-nickname"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Duration
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="duration"
                          value="permanent"
                          checked={duration === 'permanent'}
                          onChange={() => setDuration('permanent')}
                          data-testid="radio-permanent"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          Permanent (auto-revokes after 6 months of inactivity)
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="duration"
                          value="24h"
                          checked={duration === '24h'}
                          onChange={() => setDuration('24h')}
                          data-testid="radio-24h"
                        />
                        <span className="text-sm text-gray-900 dark:text-white">
                          24 Hours
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={closeIssueAccessModal}
                      className="px-6 py-3 border-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
                      data-testid="button-cancel-issue"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || selectedAircraft.length === 0}
                      className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="button-submit-issue"
                    >
                      {submitting ? 'Creating...' : 'Create Access Link'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Access Link Created
                  </h3>
                  <button
                    onClick={closeIssueAccessModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    data-testid="button-close-success-modal"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Share this link with your guest. They will be able to track the selected aircraft.
                  </p>

                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-mono text-gray-900 dark:text-white break-all" data-testid="text-generated-url">
                      {generatedUrl}
                    </p>
                  </div>

                  <button
                    onClick={copyToClipboard}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    data-testid="button-copy-url"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Regenerate Link Modal */}
      {showRegenerateModal && generatedUrl && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                New Access Link
              </h3>
              <button
                onClick={() => {
                  setShowRegenerateModal(false);
                  setGeneratedUrl('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                data-testid="button-close-regenerate-modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The old link is now invalid. Share this new link with your guest.
              </p>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-mono text-gray-900 dark:text-white break-all" data-testid="text-regenerated-url">
                  {generatedUrl}
                </p>
              </div>

              <button
                onClick={copyToClipboard}
                className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                data-testid="button-copy-regenerated-url"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
