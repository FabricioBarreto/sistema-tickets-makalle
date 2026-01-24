// middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Middleware exitoso
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: "/admin/login",
    },
  },
);

export const config = {
  matcher: [
    "/admin/dashboard/:path*",
    "/admin/tickets/:path*",
    "/admin/validate/:path*",
    "/admin/reports/:path*",
    "/admin/users/:path*",
    "/admin/settings/:path*",
  ],
};
