/**
 * Test setup: mock environment variables so tests don't need a real DB or SMTP.
 */

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.RAZORPAY_KEY_ID = 'rzp_test_key_id';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_key_secret';
process.env.GROQ_API_KEY = 'gsk_test_groq_key';
process.env.CLOUDINARY_CLOUD_NAME = 'test_cloud';
process.env.CLOUDINARY_API_KEY = 'test_api_key';
process.env.CLOUDINARY_API_SECRET = 'test_api_secret';
process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
process.env.NEXTAUTH_SECRET = 'test_nextauth_secret';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.SMTP_USER = 'test@example.com';
process.env.SMTP_PASSWORD = 'test_smtp_password';
// NODE_ENV is readonly in TypeScript but writable at runtime via defineProperty
Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true });

