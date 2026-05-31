const requiredServerEnv = [
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
] as const;

type RequiredServerEnv = (typeof requiredServerEnv)[number];

function readRequiredEnv(name: RequiredServerEnv): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env: Record<RequiredServerEnv, string> = new Proxy(
  {} as Record<RequiredServerEnv, string>,
  {
    get(_target, prop: string | symbol) {
      if (typeof prop !== 'string') return undefined;
      if (!requiredServerEnv.includes(prop as RequiredServerEnv)) return undefined;
      return readRequiredEnv(prop as RequiredServerEnv);
    },
  },
);

