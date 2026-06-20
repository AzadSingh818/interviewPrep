import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Set the actual request method in a custom header so Next.js Route Handlers
  // can access it (since headers() normally doesn't expose the request method)
  requestHeaders.set('x-request-method', request.method);

  // Enforce CSRF check for all state-changing API requests,
  // excluding external webhooks (which are verified via signatures, e.g. Razorpay HMAC)
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  const isWebhook = request.nextUrl.pathname.startsWith('/api/webhooks');

  if (isMutation && !isWebhook) {
    requestHeaders.set('x-csrf-expected', '1');
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: '/api/:path*',
};
