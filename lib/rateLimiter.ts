/**
 * Simple in-memory rate limiter using sliding window
 */

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitEntry {
  requests: number[];  // Array of timestamps
}

class RateLimiter {
  private cache = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request should be allowed
   * @param key Identifier (e.g., IP address or endpoint)
   * @returns true if allowed, false if rate limited
   */
  check(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create entry
    let entry = this.cache.get(key);
    if (!entry) {
      entry = { requests: [] };
      this.cache.set(key, entry);
    }

    // Remove old requests outside the window
    entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    if (entry.requests.length >= this.config.maxRequests) {
      return false;
    }

    // Record this request
    entry.requests.push(now);
    return true;
  }

  /**
   * Get current request count and remaining requests
   */
  getStatus(key: string): { count: number; remaining: number; resetMs: number } {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const entry = this.cache.get(key);
    if (!entry) {
      return {
        count: 0,
        remaining: this.config.maxRequests,
        resetMs: this.config.windowMs,
      };
    }

    // Filter to current window
    const activeRequests = entry.requests.filter(timestamp => timestamp > windowStart);
    const oldest = activeRequests[0] || now;
    const resetMs = Math.max(0, this.config.windowMs - (now - oldest));

    return {
      count: activeRequests.length,
      remaining: Math.max(0, this.config.maxRequests - activeRequests.length),
      resetMs,
    };
  }

  /**
   * Periodic cleanup of expired entries
   */
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    for (const [key, entry] of this.cache.entries()) {
      entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
      
      // Remove completely empty entries
      if (entry.requests.length === 0) {
        this.cache.delete(key);
      }
    }
  }
}

// Rate limiter instances
export const randomLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 6,  // 6 requests per minute
});

export const resolveLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 30, // 30 requests per minute
});

// Cleanup expired entries every 5 minutes
setInterval(() => {
  randomLimiter.cleanup();
  resolveLimiter.cleanup();
}, 5 * 60 * 1000);

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header or falls back to 'global' for development
 */
export function getClientId(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP in the chain
    return forwardedFor.split(',')[0].trim();
  }
  
  // In development/Replit, all requests appear to come from same source
  // Use 'global' as fallback
  return 'global';
}
