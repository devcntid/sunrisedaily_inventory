import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


const PUBLIC_PATHS = ['/login', '/api/auth'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.startsWith('/logo')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('sd_token')?.value;
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    return NextResponse.redirect(loginUrl);
  }

  interface ProxyJwtPayload {
    role: string;
    [key: string]: unknown;
  }
  let payload: ProxyJwtPayload | null = null;
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    payload = JSON.parse(jsonPayload);
  } catch (e) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('sd_token');
    return response;
  }

  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('sd_token');
    return response;
  }

  // Role-based access control
  const CENTRAL_ONLY = [
    '/procurement',
    '/goods-receipt',
    '/stock-card',
    '/delivery-orders',
    '/opname/central',
    '/alerts',
    '/price-history',
    '/reports',
    '/purchase-orders',
    '/master-data',
    '/settings',
    '/requests', // Central Recap
  ];

  const OUTLET_ONLY = [
    '/opname/outlet',
    '/receive-goods',
    '/outlet', // Protect all /outlet routes for Outlet Admin only
  ];

  if (payload.role === 'ADMIN_OUTLET') {
    // Exception for /settings/profile
    if (pathname.startsWith('/settings/profile')) {
      return NextResponse.next();
    }
    
    for (const path of CENTRAL_ONLY) {
      if (pathname === path || pathname.startsWith(`${path}/`)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  if (payload.role === 'ADMIN_PUSAT') {
    for (const path of OUTLET_ONLY) {
      if (pathname === path || pathname.startsWith(`${path}/`)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
};
