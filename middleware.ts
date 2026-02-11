// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // ✅ BLOQUEO POR HOST: evita que entren por *.vercel.app (bypass de Cloudflare)
  const host = request.headers.get("host") || "";
  const allowedHosts = new Set([
    "makalleeventos.com",
    "www.makalleeventos.com",
  ]);

  // Si querés permitir localhost en dev, descomentá:
  // allowedHosts.add("localhost:3000");

  if (!allowedHosts.has(host)) {
    return new NextResponse("Forbidden", {
      status: 403,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // ✅ FIREWALL: Bloquear bots ANTES de cualquier lógica
  const userAgent = request.headers.get("user-agent") || "";

  const blockedAgents = [
    "python-requests",
    "curl/",
    "wget/",
    "postman",
    "insomnia",
    "httpie",
    "go-http-client",
    "java/",
    "apache-httpclient",
    "bot",
    "crawler",
    "spider",
  ];

  // Bloquear bots en todas las rutas excepto webhooks
  if (!path.startsWith("/api/unicobros/webhook")) {
    for (const agent of blockedAgents) {
      if (userAgent.toLowerCase().includes(agent.toLowerCase())) {
        console.log(`🛡️ Firewall blocked: ${userAgent} → ${path}`);
        return new NextResponse("Forbidden", {
          status: 403,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }
  }

  // Rutas públicas que NO necesitan autenticación
  const publicPaths = [
    "/",
    "/checkout",
    "/admin/login",
    "/operador/login",
    "/api/config",
    "/api/mercadopago/webhook",
    "/api/unicobros/webhook",
    "/api/tickets/download",
    "/api/tickets/validate",
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
