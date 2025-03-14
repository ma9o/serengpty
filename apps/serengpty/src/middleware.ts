import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { env } from './app/constants/environment';

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: env.AUTH_SECRET,
    secureCookie: !env.IS_DEVELOPMENT,
  });

  // If the user is not authenticated and trying to access a protected route
  if (!token && request.nextUrl.pathname !== '/login') {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding'],
};
