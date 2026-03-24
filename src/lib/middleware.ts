import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './auth';

function getDashboardPath(role: string) {
  if (role === 'STUDENT') return '/student/dashboard';
  if (role === 'INTERVIEWER') return '/interviewer/dashboard';
  return '/';
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const { pathname } = request.nextUrl;

  // Public routes
  const publicRoutes = [
    '/',
    '/login/student',
    '/login/interviewer',
    '/signup/student',
    '/signup/interviewer',
  ];

  if (publicRoutes.includes(pathname)) {
    // If authenticated, redirect to appropriate dashboard
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        if (pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname === '/') {
          return NextResponse.redirect(new URL(getDashboardPath(payload.role), request.url));
        }
      }
    }
    return NextResponse.next();
  }

  // Protected routes - require auth
  if (!token) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const payload = verifyToken(token);
  if (!payload) {
    const response = NextResponse.redirect(new URL('/', request.url));
    response.cookies.delete('auth-token');
    return response;
  }

  // Role-based access control
  if (pathname.startsWith('/student') && payload.role !== 'STUDENT') {
    return NextResponse.redirect(new URL(getDashboardPath(payload.role), request.url));
  }

  if (pathname.startsWith('/interviewer') && payload.role !== 'INTERVIEWER') {
    return NextResponse.redirect(new URL(getDashboardPath(payload.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
