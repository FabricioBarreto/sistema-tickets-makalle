import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPreference } from "@/lib/unicobros";

// ✅ Rate limiting con conteo de intentos
const preferenceCache = new Map<
  string,
  { timestamp: number; attempts: number }
>();
const PREFERENCE_RATE_LIMIT_MS = 5000; // 5 segundos entre requests
const MAX_ATTEMPTS = 3; // Máximo 3 intentos antes de bloquear

function checkPreferenceRateLimit(orderId: string): {
  allowed: boolean;
  waitTime?: number;
  blocked?: boolean;
  attempts?: number;
} {
  const now = Date.now();
  const cached = preferenceCache.get(orderId);

  if (!cached) {
    // Primera vez
    preferenceCache.set(orderId, { timestamp: now, attempts: 1 });
    return { allowed: true };
  }

  const timeSinceFirst = now - cached.timestamp;

  // Si pasaron más de 2 minutos, resetear contador
  if (timeSinceFirst > 120000) {
    preferenceCache.set(orderId, { timestamp: now, attempts: 1 });
    return { allowed: true };
  }

  // Si ya superó el límite de intentos, bloquear
  if (cached.attempts >= MAX_ATTEMPTS) {
    console.log(
      `🚫 Bloqueado: ${orderId} - ${cached.attempts} intentos en ${Math.round(timeSinceFirst / 1000)}s`,
    );
    return {
      allowed: false,
      blocked: true,
      attempts: cached.attempts,
    };
  }

  // Rate limit normal
  const timeSinceLast = now - cached.timestamp;
  if (timeSinceLast < PREFERENCE_RATE_LIMIT_MS) {
    const waitTime = PREFERENCE_RATE_LIMIT_MS - timeSinceLast;
    return {
      allowed: false,
      waitTime: Math.ceil(waitTime / 1000),
      attempts: cached.attempts,
    };
  }

  // Permitir pero incrementar contador
  preferenceCache.set(orderId, {
    timestamp: now,
    attempts: cached.attempts + 1,
  });

  return { allowed: true, attempts: cached.attempts + 1 };
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    console.log("🔍 Unicobros Preference - orderId:", orderId);

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId requerido" },
        { status: 400 },
      );
    }

    // ✅ VERIFICAR RATE LIMIT Y BLOQUEO
    const rateLimit = checkPreferenceRateLimit(orderId);

    if (!rateLimit.allowed) {
      if (rateLimit.blocked) {
        // 🚫 BLOQUEADO - Redirigir al inicio
        console.log(`🚫 BLOQUEADO: ${orderId} - Redirigiendo al inicio`);
        return NextResponse.json(
          {
            success: false,
            error: "Demasiados intentos. Intenta nuevamente más tarde.",
            redirect: "/", // ✅ Redirigir al inicio
            blocked: true,
          },
          { status: 429 },
        );
      }

      // ⏳ Rate limit normal
      console.log(
        `⏳ Rate limit: ${orderId} - espera ${rateLimit.waitTime}s (intento ${rateLimit.attempts}/${MAX_ATTEMPTS})`,
      );
      return NextResponse.json(
        {
          success: false,
          error: `Espera ${rateLimit.waitTime} segundos antes de intentar nuevamente`,
          attempts: rateLimit.attempts,
          maxAttempts: MAX_ATTEMPTS,
        },
        { status: 429 },
      );
    }

    // Buscar orden
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    if (!order.tickets || order.tickets.length === 0) {
      return NextResponse.json(
        { success: false, error: "Orden sin tickets" },
        { status: 400 },
      );
    }

    // ✅ Si ya está pagado, redirigir a success
    if (order.paymentStatus === "COMPLETED") {
      console.log(`✅ Orden ${order.orderNumber} ya pagada`);
      return NextResponse.json({
        success: false,
        error: "Esta orden ya fue pagada",
        redirect: "/checkout/success?orderId=" + orderId,
      });
    }

    console.log(
      `✅ Orden encontrada: ${order.orderNumber} (intento ${rateLimit.attempts || 1}/${MAX_ATTEMPTS})`,
    );

    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const appUrl = normalizeUrl(rawUrl);

    const successUrl = `${appUrl}/checkout/success?orderId=${orderId}`;
    const failureUrl = `${appUrl}/checkout/failure?orderId=${orderId}`;
    const pendingUrl = `${appUrl}/checkout/pending?orderId=${orderId}`;
    const notificationUrl = `${appUrl}/api/unicobros/webhook`;

    console.log("🚀 Creando checkout en Unicobros:", {
      orderId: order.id,
      amount: Number(order.totalAmount),
      email: order.buyerEmail,
    });

    const preference = await createPreference({
      orderId: order.id,
      orderNumber: order.orderNumber,
      quantity: order.quantity,
      unitPrice: Number(order.unitPrice),
      totalAmount: Number(order.totalAmount),
      buyerEmail: order.buyerEmail,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone || undefined,
      buyerDni: order.buyerDNI || undefined,
      successUrl,
      failureUrl,
      pendingUrl,
      notificationUrl,
    });

    console.log("✅ Checkout creado:", {
      id: preference.id,
      url: preference.init_point,
    });

    return NextResponse.json({
      success: true,
      initPoint: preference.init_point,
      preferenceId: preference.id,
    });
  } catch (error: unknown) {
    console.error("❌ Error en Unicobros preference:", error);

    if (error instanceof Error && error.message.includes("Prisma")) {
      console.error("💡 Tip: Verifica DATABASE_URL en variables de entorno");
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
