/**
 * Auth regression tests.
 *
 * Tests critical authentication behaviour:
 * - JWT token generation and verification
 * - Token version validation (logout invalidation)
 * - CSRF token generation is unique and properly sized
 * - Rate limit 429 response format
 * - authErrorStatus maps errors to correct HTTP codes
 */

// ─── Mock dependencies that touch DB or Next.js internals ────────────────────
jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    delete: jest.fn(),
  }),
  headers: jest.fn().mockResolvedValue({
    get: jest.fn().mockReturnValue(null),
  }),
}));

import {
  generateToken,
  verifyToken,
  generateCsrfToken,
  authErrorStatus,
  requireAuth,
  type JWTPayload,
} from '@/lib/auth';
import { rateLimitResponse } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { cookies, headers } from 'next/headers';

// ─── JWT ──────────────────────────────────────────────────────────────────────

const testPayload: JWTPayload = {
  userId: 42,
  email: 'test@example.com',
  role: 'STUDENT',
  tokenVersion: 3,
};

describe('generateToken / verifyToken', () => {
  it('round-trips: verify returns the original payload', () => {
    const token = generateToken(testPayload);
    const decoded = verifyToken(token);

    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(testPayload.userId);
    expect(decoded?.email).toBe(testPayload.email);
    expect(decoded?.role).toBe(testPayload.role);
    expect(decoded?.tokenVersion).toBe(testPayload.tokenVersion);
  });

  it('returns null for a tampered token', () => {
    const token = generateToken(testPayload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('returns null for a random string', () => {
    expect(verifyToken('not-a-real-token')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(verifyToken('')).toBeNull();
  });

  it('token includes tokenVersion in payload', () => {
    const token = generateToken({ ...testPayload, tokenVersion: 99 });
    const decoded = verifyToken(token);
    expect(decoded?.tokenVersion).toBe(99);
  });

  it('tokens with different tokenVersions are both valid JWTs (invalidation is DB-side)', () => {
    // The JWT itself is valid regardless of tokenVersion;
    // invalidation only happens when requireAuth compares against the DB value.
    const tokenV1 = generateToken({ ...testPayload, tokenVersion: 1 });
    const tokenV2 = generateToken({ ...testPayload, tokenVersion: 2 });

    expect(verifyToken(tokenV1)?.tokenVersion).toBe(1);
    expect(verifyToken(tokenV2)?.tokenVersion).toBe(2);
  });
});

// ─── CSRF Token ───────────────────────────────────────────────────────────────

describe('generateCsrfToken', () => {
  it('generates a 64-character hex string (32 bytes)', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens on each call', () => {
    const tokens = new Set(Array.from({ length: 10 }, generateCsrfToken));
    expect(tokens.size).toBe(10);
  });
});

// ─── Error status mapping ─────────────────────────────────────────────────────

describe('authErrorStatus', () => {
  it('maps Unauthorized → 401', () => {
    expect(authErrorStatus('Unauthorized')).toBe(401);
  });

  it('maps Forbidden → 403', () => {
    expect(authErrorStatus('Forbidden')).toBe(403);
  });

  it('maps CSRF validation failed → 403', () => {
    expect(authErrorStatus('CSRF validation failed')).toBe(403);
  });

  it('maps unknown error → 500', () => {
    expect(authErrorStatus('Something exploded')).toBe(500);
  });
});

// ─── Rate limit response ──────────────────────────────────────────────────────

describe('rateLimitResponse', () => {
  it('returns 429 status', () => {
    const response = rateLimitResponse(60);
    expect(response.status).toBe(429);
  });

  it('includes Retry-After header', () => {
    const response = rateLimitResponse(120);
    expect(response.headers.get('Retry-After')).toBe('120');
  });

  it('response body contains error message and retryAfter', async () => {
    const response = rateLimitResponse(30);
    const body = await response.json();
    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('retryAfter', 30);
  });
});

// ─── requireAuth token invalidation ────────────────────────────────────────────

describe('requireAuth tokenVersion enforcement', () => {
  it('rejects token when DB tokenVersion has changed (logout invalidation)', async () => {
    const token = generateToken(testPayload);

    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn().mockImplementation((name: string) => {
        if (name === 'auth-token') return { value: token };
        return undefined;
      }),
      set: jest.fn(),
      delete: jest.fn(),
    });

    (headers as jest.Mock).mockResolvedValue({
      get: jest.fn().mockReturnValue(null),
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: testPayload.userId,
      email: testPayload.email,
      role: testPayload.role,
      tokenVersion: testPayload.tokenVersion + 1, // stale JWT should fail
    });

    await expect(requireAuth()).rejects.toThrow('Unauthorized');
  });
});
