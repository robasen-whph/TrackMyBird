/**
 * Application configuration (non-sensitive values)
 * These can be safely committed to version control
 */

export const appConfig = {
  // Application version
  version: "0.43.0",

  // Application URL
  url: process.env.APP_URL || "http://localhost:5000",

  // Email configuration (non-sensitive parts)
  email: {
    from: process.env.EMAIL_FROM || "TrackMyBird <trackmybird@gmail.com>",
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
  },

  // Feature flags / settings
  cache: {
    flightStatusTtlMs: 15000, // 15 seconds
    randomAircraftTtlMs: 5000, // 5 seconds
  },

  rateLimit: {
    randomPerMinute: 6,
    resolvePerMinute: 30,
  },
} as const;
