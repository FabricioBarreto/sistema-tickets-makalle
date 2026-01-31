// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Rutas públicas que NO necesitan autenticación
  const publicPaths = [
    "/",
    "/checkout",
    "/admin/login",
    "/operador/login",
    "/api",
  ];

  const response = NextResponse.next();

  // Agregar pathname a los headers
  response.headers.set("x-pathname", path);

  // Si es una ruta pública, permitir acceso
  if (publicPaths.some((publicPath) => path.startsWith(publicPath))) {
    return response;
  }

  // Para rutas protegidas, verificar el token de NextAuth
  const token =
    request.cookies.get("next-auth.session-token") ||
    request.cookies.get("__Secure-next-auth.session-token");

  // Redirigir según la ruta
  if (!token) {
    if (path.startsWith("/admin")) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(loginUrl);
    }

    if (path.startsWith("/operador")) {
      const loginUrl = new URL("/operador/login", request.url);
      loginUrl.searchParams.set("callbackUrl", path);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
