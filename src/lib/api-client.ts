/**
 * api-client.ts
 *
 * Shared frontend fetch wrapper.
 * - Reads the `csrf-token` cookie and sends it as `X-CSRF-Token` on all
 *   state-changing (non-GET) requests so the server can validate it.
 * - Sends `X-CSRF-Expected: 1` to signal that CSRF validation is expected.
 * - Defaults Content-Type to application/json when a body is provided.
 *
 * Usage:
 *   import { apiFetch } from '@/lib/api-client';
 *   const res = await apiFetch('/api/student/profile', { method: 'POST', body: JSON.stringify(data) });
 */

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const isMutation = !SAFE_METHODS.has(method);

  const extraHeaders: Record<string, string> = {};

  if (isMutation) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      extraHeaders['X-CSRF-Token'] = csrfToken;
      extraHeaders['X-CSRF-Expected'] = '1';
    }
  }

  // Default Content-Type for JSON bodies
  if (isMutation && init.body && typeof init.body === 'string' && !extraHeaders['Content-Type']) {
    extraHeaders['Content-Type'] = 'application/json';
  }

  return fetch(input, {
    ...init,
    headers: {
      ...extraHeaders,
      ...(init.headers ?? {}),
    },
  });
}
