/**
 * Validates that all SENSITIVE secrets are present
 * Non-sensitive config is handled by config/app.ts
 */

const REQUIRED_SECRETS = [
  // Authentication & Encryption
  'SESSION_SECRET',           // SENSITIVE: Session encryption key
  
  // Email Credentials
  'SMTP_USER',               // SENSITIVE: SMTP username
  'SMTP_PASS',               // SENSITIVE: SMTP password
  
  // API Keys
  'FLIGHTAWARE_API_KEY',     // SENSITIVE: API key
  'AVIATIONSTACK_API_KEY',   // SENSITIVE: API key (fallback provider)
] as const;

// REMOVED from required secrets (now in config/app.ts with defaults):
// - APP_URL (public domain name)
// - EMAIL_FROM (public email address)
// - SMTP_HOST (public hostname)
// - SMTP_PORT (public port number)

export function validateSecrets(): void {
  const missing: string[] = [];
  
  for (const key of REQUIRED_SECRETS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required secrets: ${missing.join(', ')}\n` +
      `Please add these to Replit Secrets.\n` +
      `Non-sensitive config (APP_URL, SMTP_HOST, etc.) can be set in config/app.ts`
    );
  }
  
  console.log('[secrets] ✓ ok');
}
