'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function VerifyPendingPage() {
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleResend = async () => {
    setResending(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/auth/resend', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to resend email');
        setResending(false);
        return;
      }

      setMessage('Verification email sent! Please check your inbox.');
      setResending(false);
    } catch (err) {
      setError('Network error. Please try again.');
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="mx-auto h-20 w-20 mb-6 text-purple-600 dark:text-purple-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Check your email
        </h1>

        {/* Body Text */}
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          We've sent a verification link to your email address.
        </p>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Click the link in the email to activate your account.
        </p>

        {/* Messages */}
        {message && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800" data-testid="text-success">
            <p className="text-sm text-green-800 dark:text-green-400">{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" data-testid="text-error">
            <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Resend Button */}
        <button
          onClick={handleResend}
          disabled={resending}
          className="w-full h-12 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 text-gray-900 dark:text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-4"
          data-testid="button-resend"
        >
          {resending ? 'Sending...' : 'Resend verification email'}
        </button>

        {/* Helper Text */}
        <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
          Didn't receive it? Check your spam folder
        </p>

        {/* Footer Link */}
        <Link href="/login" className="text-sm text-purple-600 dark:text-purple-400 hover:underline" data-testid="link-login">
          Back to login
        </Link>
      </div>
    </div>
  );
}
