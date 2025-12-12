import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get access token from cookies
  const accessToken = request.cookies.get('accessToken')?.value;

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // If no token and trying to access protected route, redirect to login
  if (!accessToken && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If has token, verify and check role-based access
  if (accessToken) {
    try {
      // Decode JWT to get user role (simple base64 decode of payload)
      const payload = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64').toString()
      );
      const userRole = payload.role;

      // Role-based route protection
      if (pathname.startsWith('/admin') && userRole !== 'ADMIN') {
        // Redirect non-admin users away from admin routes
        return NextResponse.redirect(new URL(getRoleBasedDashboard(userRole), request.url));
      }

      if (pathname.startsWith('/doctor') && userRole !== 'DOCTOR') {
        // Redirect non-doctor users away from doctor routes
        return NextResponse.redirect(new URL(getRoleBasedDashboard(userRole), request.url));
      }

      if (pathname.startsWith('/patient') && userRole !== 'PATIENT') {
        // Redirect non-patient users away from patient routes
        return NextResponse.redirect(new URL(getRoleBasedDashboard(userRole), request.url));
      }

      // If authenticated user tries to access login/register, redirect to their dashboard
      if (isPublicRoute && pathname !== '/') {
        return NextResponse.redirect(new URL(getRoleBasedDashboard(userRole), request.url));
      }

      // Redirect /dashboard to role-based dashboard
      if (pathname === '/dashboard') {
        return NextResponse.redirect(new URL(getRoleBasedDashboard(userRole), request.url));
      }
    } catch (error) {
      // If token is invalid, clear it and redirect to login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('accessToken');
      response.cookies.delete('refreshToken');
      return response;
    }
  }

  return NextResponse.next();
}

function getRoleBasedDashboard(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'DOCTOR':
      return '/doctor/dashboard';
    case 'PATIENT':
      return '/patient/dashboard';
    default:
      return '/login';
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
