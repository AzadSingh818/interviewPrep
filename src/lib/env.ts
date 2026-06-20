const requiredServerEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'GROQ_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'SMTP_USER',
  'SMTP_PASSWORD',
] as const;

const optionalServerEnv = [
  'SMTP_HOST',
  'SMTP_PORT',
  'CRON_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'ADMIN_EMAILS',
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_APP_URL',
] as const;

type RequiredServerEnv = (typeof requiredServerEnv)[number];
type OptionalServerEnv = (typeof optionalServerEnv)[number];
type KnownServerEnv = RequiredServerEnv | OptionalServerEnv;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : undefined;
}

export function readRequiredEnv(name: KnownServerEnv): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateRequiredServerEnv(): Record<RequiredServerEnv, string> {
  const missing = requiredServerEnv.filter((name) => !readEnv(name));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return requiredServerEnv.reduce((acc, name) => {
    acc[name] = readRequiredEnv(name);
    return acc;
  }, {} as Record<RequiredServerEnv, string>);
}

export const env = validateRequiredServerEnv();

export function getOptionalEnv(name: OptionalServerEnv, fallback?: string): string | undefined {
  return readEnv(name) ?? fallback;
}

// ========================================
// PRODUCTION-ONLY SECRETS VALIDATION
// ========================================
// CRON_SECRET and RAZORPAY_WEBHOOK_SECRET are optional in dev/test
// so local builds keep working, but they MUST be set in production.
// This function is called below at module init time so the process fails
// fast on the first request rather than silently breaking at call site.

const PRODUCTION_REQUIRED_SECRETS = [
  'CRON_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
] as const;

function validateProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const missing = PRODUCTION_REQUIRED_SECRETS.filter((name) => !readEnv(name));
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required production secrets: ${missing.join(', ')}. ` +
        'Set these in your Vercel/deployment environment variables.',
    );
  }
}

// Validate at startup (module load time) — fails fast in production
validateProductionSecrets();

