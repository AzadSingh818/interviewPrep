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

/**
 * Returns true if the URL is a Google account photo (or null = no photo yet).
 * Google photos can be overwritten/updated on each login.
 * Custom uploaded photos (base64 data URLs, /uploads/ paths, LinkedIn URLs) must NEVER be overwritten.
 */
function isGoogleAccountPhoto(url: string | null | undefined): boolean {
  if (!url) return true; // no photo yet → use Google's
  return url.includes('googleusercontent.com') || url.includes('ggpht.com');
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
          const email            = profile.email;
          const googleId         = account.providerAccountId;
          const name             = (profile as any).name || email.split('@')[0];
          const googleProfilePic = (profile as any).picture || null;

          // ✅ Read the role from the cookie set during redirect()
          const cookieStore  = await cookies();
          const pendingRole  = cookieStore.get('pending-oauth-role')?.value || 'STUDENT';
          cookieStore.delete('pending-oauth-role');

          let requestedRole = pendingRole;
          if (isAdminEmail(email)) requestedRole = 'ADMIN';

          console.log('🎯 [jwt] Role from cookie:', requestedRole);

          // Find existing user
          let user = await prisma.user.findUnique({ where: { email } });

          if (user) {
            console.log('✅ [jwt] Existing user found:', user.id, 'Role:', user.role);

            const finalRole = isAdminEmail(email) ? 'ADMIN' : requestedRole;

            // ─── PHOTO PROTECTION ─────────────────────────────────────────────
            // If the user has uploaded a custom photo (any non-Google URL),
            // NEVER overwrite it — even if they sign in with Google again.
            // Only update the photo if they still have a Google-sourced photo
            // or no photo at all.
            const photoToSave = isGoogleAccountPhoto(user.profilePicture)
              ? googleProfilePic    // null or Google URL in DB → use/refresh Google photo
              : user.profilePicture; // custom upload in DB → preserve it always

            console.log(
              '📸 [jwt] Photo — DB has:',
              user.profilePicture ? user.profilePicture.substring(0, 80) : 'null',
              '| Saving:',
              photoToSave ? photoToSave.substring(0, 80) : 'null',
            );
            // ──────────────────────────────────────────────────────────────────

            await prisma.user.update({
              where: { id: user.id },
              data: {
                googleId,
                provider:      'GOOGLE',
                name,
                profilePicture: photoToSave,
                emailVerified:  true,
                role:           finalRole as any,
              },
            });

            user = { ...user, role: finalRole as any };
            console.log('✅ [jwt] User updated. Role:', finalRole);

          } else {
            console.log('✅ [jwt] Creating NEW user with role:', requestedRole);

            user = await prisma.user.create({
              data: {
                email,
                name,
                googleId,
                role:          requestedRole as any,
                provider:      'GOOGLE',
                profilePicture: googleProfilePic,
                emailVerified:  true,
                passwordHash:   null,
              },
            });

            console.log('✅ [jwt] User created:', user.id, 'Role:', user.role);
          }

          const customToken = generateToken({
            userId: user.id,
            email:  user.email,
            role:   user.role,
          });

          token.customToken = customToken;
          token.userId      = user.id;
          token.userRole    = user.role;

          cookieStore.set('auth-token', customToken, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge:   60 * 60 * 24 * 7,
            path:     '/',
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
        (session as any).userId      = token.userId;
        (session as any).userRole    = token.userRole;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      console.log('🔍 [redirect] url:', url, 'baseUrl:', baseUrl);

      if (url.includes('/api/auth/callback/google')) {
        console.log('✅ [redirect] Google callback detected');

        let requestedRole = 'STUDENT';

        try {
          const fullUrl    = url.startsWith('http') ? url : `${baseUrl}${url}`;
          const urlObj     = new URL(fullUrl);
          const callbackUrl = urlObj.searchParams.get('callbackUrl') || '';

          if (callbackUrl.includes('INTERVIEWER') || url.includes('INTERVIEWER')) {
            requestedRole = 'INTERVIEWER';
          } else if (callbackUrl.includes('ADMIN') || url.includes('ADMIN')) {
            requestedRole = 'ADMIN';
          }

          console.log('🎯 [redirect] Detected role:', requestedRole);

          const cookieStore = await cookies();
          cookieStore.set('pending-oauth-role', requestedRole, {
            httpOnly: true,
            secure:   process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge:   60,
            path:     '/',
          });

          console.log('✅ [redirect] Role cookie set:', requestedRole);

        } catch (err) {
          console.log('⚠️ [redirect] URL parse error:', err);
        }

        if (requestedRole === 'INTERVIEWER') return `${baseUrl}/interviewer/dashboard`;
        if (requestedRole === 'ADMIN')       return `${baseUrl}/admin/dashboard`;
        return `${baseUrl}/student/dashboard`;
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
    error:  '/login/student',
  },
  secret:  process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
};