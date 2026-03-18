import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export default async function proxy(req: NextRequest) {
  const session = await auth();
  const { pathname } = req.nextUrl;

  // Public paths — always allow
  const isPublic =
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/v/') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/help') ||
    pathname.startsWith('/_next') ||
    // Static assets served from public/ folder — at root, NOT /public/
    pathname === '/favicon.ico' ||
    pathname === '/favicon.svg' ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/browserconfig.xml' ||
    pathname.startsWith('/android-icon-') ||
    pathname.startsWith('/apple-icon-') ||
    pathname.startsWith('/ms-icon-') ||
    pathname.startsWith('/favicon-') ||
    pathname === '/apple-icon.png' ||
    pathname === '/apple-icon-precomposed.png';

  if (isPublic) return NextResponse.next();

  // Not logged in → redirect to login
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude static files from proxy entirely — avoids running auth() on them
  matcher: [
    '/((?!_next/static|_next/image|favicon|android-icon-|apple-icon|ms-icon-|sw\\.js|manifest\\.json|browserconfig\\.xml|.*\\.svg|.*\\.png|.*\\.ico|.*\\.xml).*)',
  ],
};
