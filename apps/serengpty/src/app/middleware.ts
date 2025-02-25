import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './services/auth';

// This middleware protects routes that require authentication
export async function middleware(request: NextRequest) {
  const session = await auth();
  
  // Protected routes pattern
  const protectedRoutes = ['/dashboard'];
  
  // Check if the requested path starts with a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );
  
  if (isProtectedRoute && !session) {
    // Redirect to login if trying to access protected route without authentication
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}