/** @type {import('next').NextConfig} */

// Sentry instrumentation (conditional)
const withSentry = require('@sentry/nextjs').withSentryConfig;
const { getSentryConfig } = require('./sentry.config.js');

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    const securityHeaders = [
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          process.env.NODE_ENV === 'development'
            ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://browser.sentry-cdn.com"
            : "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://browser.sentry-cdn.com",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https://lh3.googleusercontent.com https://res.cloudinary.com",
          "font-src 'self' data:",
          "connect-src 'self' https://api.groq.com https://checkout.razorpay.com https://api.razorpay.com https://sentry.io",
          "frame-src https://checkout.razorpay.com https://api.razorpay.com",
          "media-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/(student|interviewer)/interview-room/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*, display-capture=*',
          },
        ],
      },
    ];
  },
};

// Conditionally wrap with Sentry if DSN is configured
if (getSentryConfig()) {
  module.exports = withSentry(nextConfig, {
    shouldAutoInstrumentAppDirectory: true,
    autoInstrumentServerFunctions: true,
  });
} else {
  module.exports = nextConfig;
}

