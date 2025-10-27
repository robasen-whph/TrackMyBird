import { sha256 } from 'js-sha256';

/**
 * Client-side token hashing utility
 * 
 * Uses Web Crypto API when available, with SHA-256 library fallback for older browsers
 */

/**
 * Hash a token using SHA-256 (client-side safe)
 * @param token - The token to hash
 * @returns Promise resolving to hex-encoded hash
 */
export async function hashTokenClient(token: string): Promise<string> {
  // Try Web Crypto API first (modern browsers, fastest)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(token);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.warn('Web Crypto API failed, using js-sha256 fallback:', error);
    }
  }
  
  // Fallback to js-sha256 library (works in all browsers, matches server SHA-256)
  return sha256(token);
}
