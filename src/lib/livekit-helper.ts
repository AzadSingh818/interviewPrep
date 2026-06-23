/**
 * src/lib/livekit-helper.ts
 *
 * Centralized LiveKit configuration and feature flag logic.
 * Allows gradual migration from Postgres to LiveKit signaling.
 */

export type SignalingBackend = 'livekit' | 'postgres';

/**
 * Determine which signaling backend to use based on:
 * 1. ENABLE_LIVEKIT env flag
 * 2. Availability of LIVEKIT_* credentials
 */
export function getSignalingBackend(): SignalingBackend {
  const enableLiveKit = process.env.NEXT_PUBLIC_ENABLE_LIVEKIT === 'true';
  const hasLiveKitConfig = Boolean(
    process.env.LIVEKIT_URL &&
      process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET
  );

  // Only use LiveKit if explicitly enabled AND credentials present
  if (enableLiveKit && hasLiveKitConfig) {
    return 'livekit';
  }

  // Fallback to Postgres signaling
  return 'postgres';
}

/**
 * Client-side: Determine signaling backend using public env var
 */
export function useClientSignalingBackend(): SignalingBackend {
  const enableLiveKit = process.env.NEXT_PUBLIC_ENABLE_LIVEKIT === 'true';
  return enableLiveKit ? 'livekit' : 'postgres';
}

/**
 * Validate LiveKit environment variables (server-side)
 * Throws if ENABLE_LIVEKIT=true but credentials missing
 */
export function validateLiveKitEnv() {
  if (process.env.NEXT_PUBLIC_ENABLE_LIVEKIT !== 'true') {
    return; // Not enabled, no need to validate
  }

  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error(
      'LiveKit is enabled (NEXT_PUBLIC_ENABLE_LIVEKIT=true) but credentials are missing. ' +
        'Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET, or disable LiveKit.'
    );
  }
}
