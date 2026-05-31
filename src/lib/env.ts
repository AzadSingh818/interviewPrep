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
] as const;

type RequiredServerEnv = (typeof requiredServerEnv)[number];

function readRequiredEnv(name: RequiredServerEnv): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env: Record<RequiredServerEnv, string> = requiredServerEnv.reduce(
  (values, name) => {
    values[name] = readRequiredEnv(name);
    return values;
  },
  {} as Record<RequiredServerEnv, string>,
);

