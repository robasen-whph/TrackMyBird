/**
 * Next.js instrumentation hook
 * Runs once when the server starts
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate secrets at boot
    const { validateSecrets } = await import('./config/secrets');
    validateSecrets();
    
    console.log('[health] ready');
  }
}
