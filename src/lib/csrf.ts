/**
 * src/lib/csrf.ts
 *
 * CSRF token generation, signing, and verification.
 * Uses secure, httpOnly cookies + request header validation.
 */

import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a random CSRF token (base64 encoded for safe transmission)
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('base64');
}

/**
 * Hash token for comparison (prevent timing attacks)
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify CSRF token from request
 * - Reads cookie value
 * - Compares with header value
 * - Constant-time comparison to prevent timing attacks
 */
export function verifyCSRFToken(
  cookieValue: string | undefined,
  headerValue: string | undefined
): boolean {
  // Both must be present
  if (!cookieValue || !headerValue) {
    return false;
  }

  // Compare hashes (constant-time)
  try {
    const cookieHash = hashToken(cookieValue);
    const headerHash = hashToken(headerValue);
    return crypto.timingSafeEqual(
      Buffer.from(cookieHash),
      Buffer.from(headerHash)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Generate Set-Cookie header for CSRF token
 */
export function getCsrfCookieHeader(token: string): string {
  return `${CSRF_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`;
}

/**
 * Extract CSRF token from cookies (used during verification)
 */
export function extractCSRFTokenFromCookies(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === CSRF_COOKIE_NAME && value) {
      return value;
    }
  }
  return undefined;
}

/**
 * Check if request is "safe" (GET, HEAD, OPTIONS, TRACE)
 */
export function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method.toUpperCase());
}
