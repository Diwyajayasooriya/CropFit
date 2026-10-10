import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that are public (no auth needed)
const PUBLIC_ROUTES = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for the auth cookie set by api.ts on successful login
  const isLoggedIn = request.cookies.has('cropfit_auth');
  const roleHeader = request.cookies.get('cropfit_role')?.value;

  // --- Admin route protection ---
  if (pathname.startsWith('/admin')) {
    // Allow /admin/login to be accessed without auth
    if (pathname === '/admin/login') {
      // If already logged in as admin, redirect to admin dashboard
      if (isLoggedIn && roleHeader === 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.next();
    }

    // Block unauthenticated users from /admin/*
    if (!isLoggedIn) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // Block non-admin roles from /admin/*
    // Role is stored in the 'cropfit_role' cookie (set during login)
    if (roleHeader && roleHeader !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
  }

  // --- Regular protected routes ---
  if (!PUBLIC_ROUTES.includes(pathname) && !isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};
