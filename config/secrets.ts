/**
 * Centralized secret validation for TrackMyBird
 * Validates all required environment variables at boot time
 */

interface Secrets {
  // Required secrets
  appUrl: string;
  sessionSecret: string;
  
  // SMTP configuration
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  emailFrom: string;
  
  // Provider API keys (optional, warnings only)
  flightAwareApiKey?: string;
  openskyClientId?: string;
  openskyClientSecret?: string;
  aviationStackApiKey?: string;
}

function validateRequired(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required secret: ${key}`);
  }
  return value.trim();
}

function validateUrl(url: string, key: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.protocol || !parsed.protocol.match(/^https?:$/)) {
      throw new Error(`${key} must be an absolute URL with http:// or https:// scheme`);
    }
    return url;
  } catch (e) {
    throw new Error(`${key} must be a valid absolute URL (got: ${url})`);
  }
}

function validatePort(port: string | undefined, key: string): number {
  const parsed = parseInt(port || '', 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`${key} must be a valid port number (1-65535)`);
  }
  return parsed;
}

function getOptional(key: string): string | undefined {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    console.warn(`[secrets] Warning: ${key} not set (provider functionality may be limited)`);
    return undefined;
  }
  return value.trim();
}

/**
 * Load and validate all secrets
 * Throws on missing required secrets
 * Warns on missing optional provider keys
 */
export function loadSecrets(): Secrets {
  // Required secrets
  const appUrl = validateUrl(
    validateRequired('APP_URL', process.env.APP_URL),
    'APP_URL'
  );
  const sessionSecret = validateRequired('SESSION_SECRET', process.env.SESSION_SECRET);
  
  // SMTP configuration (all required)
  const smtpHost = validateRequired('SMTP_HOST', process.env.SMTP_HOST);
  const smtpPort = validatePort(process.env.SMTP_PORT, 'SMTP_PORT');
  const smtpUser = validateRequired('SMTP_USER', process.env.SMTP_USER);
  const smtpPass = validateRequired('SMTP_PASS', process.env.SMTP_PASS);
  const emailFrom = validateRequired('EMAIL_FROM', process.env.EMAIL_FROM);
  
  // Provider keys (optional, warnings only)
  const flightAwareApiKey = getOptional('FLIGHTAWARE_API_KEY');
  const openskyClientId = getOptional('OPENSKY_CLIENT_ID');
  const openskyClientSecret = getOptional('OPENSKY_CLIENT_SECRET');
  const aviationStackApiKey = getOptional('AVIATIONSTACK_API_KEY');
  
  console.log('[secrets] ✓ ok');
  
  return {
    appUrl,
    sessionSecret,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    emailFrom,
    flightAwareApiKey,
    openskyClientId,
    openskyClientSecret,
    aviationStackApiKey,
  };
}

// Export singleton instance
let secretsCache: Secrets | null = null;

export function getSecrets(): Secrets {
  if (!secretsCache) {
    secretsCache = loadSecrets();
  }
  return secretsCache;
}

// Export typed object for use across the app
export const secrets = getSecrets();
