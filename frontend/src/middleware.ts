import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/phone-login'];

const ROLE_PREFIX_MAP: Record<string, string[]> = {
  SUPER_ADMIN: ['/super-admin', '/admin', '/user'],
  GYM_ADMIN:   ['/admin'],
  STAFF:       ['/staff'],
  TRAINER:     ['/trainer'],
  MEMBER:      ['/user'],
};

function decodeJwtPayload(token: string): { role?: string; exp?: number } | null {
  try {
    const base64 = token.split('.')[1];
    const json = Buffer.from(base64, 'base64url').toString('utf-8');
    const payload = JSON.parse(json);
    // Treat expired tokens as absent — the interceptor will refresh silently
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('ab_token')?.value;

  // Allow public routes — redirect to role home if already logged in with a valid token
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (token && pathname === '/login') {
      const payload = decodeJwtPayload(token);
      const role = payload?.role;
      if (role) {
        const home = (ROLE_PREFIX_MAP[role] ?? [])[0] ?? '/';
        return NextResponse.redirect(new URL(home, request.url));
      }
    }
    return NextResponse.next();
  }

  // No token — redirect to login
  if (!token) {
    const url = new URL('/login', request.url);
    // Only allow same-origin redirects
    const redirectTo = pathname.startsWith('/') ? pathname : '/';
    url.searchParams.set('redirect', redirectTo);
    return NextResponse.redirect(url);
  }

  // Decode role from JWT (no signature verification needed here — backend enforces that)
  const payload = decodeJwtPayload(token);
  const role = payload?.role;

  if (!role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const allowedPrefixes = ROLE_PREFIX_MAP[role] ?? [];

  // /settings is accessible to every authenticated role
  const SHARED_ROUTES = ['/settings'];

  // Check if the current path is allowed for this role
  const isAllowed =
    allowedPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    SHARED_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname === '/';
  if (!isAllowed) {
    // Redirect to the role's home instead of login
    const home = allowedPrefixes[0] ?? '/login';
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api/|_next/static|_next/image|_next/webpack-hmr|__nextjs|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)).*)',
  ],
};
