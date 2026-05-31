import NextAuth from 'next-auth';
import type { NextRequest } from 'next/server';
import { buildAuthOptions } from '@/lib/auth-options';

const handler = (req: NextRequest) => NextAuth(buildAuthOptions())(req);

export { handler as GET, handler as POST };