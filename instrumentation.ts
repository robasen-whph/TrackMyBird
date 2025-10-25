/**
 * Next.js instrumentation hook
 * Runs once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Load and validate secrets at boot
    const { getSecrets } = await import('./config/secrets');
    getSecrets();
    
    console.log('[health] ready');
  }
}
