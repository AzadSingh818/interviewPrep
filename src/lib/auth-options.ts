// FINAL CORRECT VERSION - Role passed via pre-set cookie before OAuth starts
import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { isAdminEmail } from './auth';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      console.log('🔍 [jwt] Callback - account:', !!account, 'profile:', !!profile);

      if (account?.provider === 'google' && profile?.email) {
        console.log('✅ [jwt] Google sign-in detected!');

        try {
          const email = profile.email;
          const googleId = account.providerAccountId;
          const name = (profile as any).name || email.split('@')[0];
          const profilePicture = (profile as any).picture || null;

          // ✅ Read the role from the cookie set during redirect()
          const cookieStore = await cookies();
          const pendingRole = cookieStore.get('pending-oauth-role')?.value || 'STUDENT';
          
          // Clear it immediately after reading
          cookieStore.delete('pending-oauth-role');

          // Determine final role
          let requestedRole = pendingRole;
          if (isAdminEmail(email)) {
            requestedRole = 'ADMIN';
          }

          console.log('🎯 [jwt] Role from cookie:', requestedRole);

          // Find existing user
          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (user) {
            console.log('✅ [jwt] Existing user found:', user.id, 'Role:', user.role);

            await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId,
                provider: 'GOOGLE',
                name,
                profilePicture,
                emailVerified: true,
              },
            });

            token.userRole = user.role;

          } else {
            console.log('✅ [jwt] Creating NEW user with role:', requestedRole);

            user = await prisma.user.create({
              data: {
                email,
                name,
                googleId,
                role: requestedRole as any,
                provider: 'GOOGLE',
                profilePicture,
                emailVerified: true,
                passwordHash: null,
              },
            });

            console.log('✅ [jwt] User created:', user.id, 'Role:', user.role);
            token.userRole = user.role;
          }

          // Generate custom JWT with CORRECT role
          const customToken = generateToken({
            userId: user.id,
            email: user.email,
            role: user.role,
          });

          token.customToken = customToken;
          token.userId = user.id;
          token.userRole = user.role;

          // Set main auth cookie
          cookieStore.set('auth-token', customToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
          });

          console.log('✅ [jwt] Cookie set for user:', user.id, 'role:', user.role);

        } catch (error) {
          console.error('❌ [jwt] Error:', error);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.customToken) {
        (session as any).customToken = token.customToken;
        (session as any).userId = token.userId;
        (session as any).userRole = token.userRole;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      console.log('🔍 [redirect] url:', url, 'baseUrl:', baseUrl);

      if (url.includes('/api/auth/callback/google')) {
        console.log('✅ [redirect] Google callback detected');

        let requestedRole = 'STUDENT';

        try {
          const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
          const urlObj = new URL(fullUrl);
          const callbackUrl = urlObj.searchParams.get('callbackUrl') || '';

          if (callbackUrl.includes('INTERVIEWER') || url.includes('INTERVIEWER')) {
            requestedRole = 'INTERVIEWER';
          } else if (callbackUrl.includes('ADMIN') || url.includes('ADMIN')) {
            requestedRole = 'ADMIN';
          }

          console.log('🎯 [redirect] Detected role:', requestedRole);

          // ✅ Set role cookie BEFORE jwt() callback runs
          const cookieStore = await cookies();
          cookieStore.set('pending-oauth-role', requestedRole, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60,
            path: '/',
          });

          console.log('✅ [redirect] Role cookie set:', requestedRole);

        } catch (err) {
          console.log('⚠️ [redirect] URL parse error:', err);
        }

        if (requestedRole === 'INTERVIEWER') {
          return `${baseUrl}/interviewer/dashboard`;
        } else if (requestedRole === 'ADMIN') {
          return `${baseUrl}/admin/dashboard`;
        } else {
          return `${baseUrl}/student/dashboard`;
        }
      }

      if (url.startsWith('/')) return `${baseUrl}${url}`;

      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        return baseUrl;
      }

      return baseUrl;
    },
  },
  pages: {
    signIn: '/login/student',
    error: '/login/student',
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
};