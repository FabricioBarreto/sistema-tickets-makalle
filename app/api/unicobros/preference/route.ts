// app/api/unicobros/preference/route.ts
/**
 * CAMBIO CLAVE: El successUrl ahora incluye un placeholder para transactionId.
 *
 * Unicobros normalmente agrega parámetros a la URL de retorno (como transactionId).
 * Pero por si no lo hace, también guardamos el checkout ID de Unicobros como
 * mercadoPagoId en la orden, para que el cron pueda consultarlo después.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPreference } from "@/lib/unicobros";

// Rate limiting
const preferenceCache = new Map<
  string,
  { timestamp: number; attempts: number }
>();
const PREFERENCE_RATE_LIMIT_MS = 5000;
const MAX_ATTEMPTS = 3;

function checkPreferenceRateLimit(orderId: string): {
  allowed: boolean;
  waitTime?: number;
  blocked?: boolean;
  attempts?: number;
} {
  const now = Date.now();
  const cached = preferenceCache.get(orderId);

  if (!cached) {
    preferenceCache.set(orderId, { timestamp: now, attempts: 1 });
    return { allowed: true };
  }

  const timeSinceFirst = now - cached.timestamp;

  if (timeSinceFirst > 120000) {
    preferenceCache.set(orderId, { timestamp: now, attempts: 1 });
    return { allowed: true };
  }

  if (cached.attempts >= MAX_ATTEMPTS) {
    return { allowed: false, blocked: true, attempts: cached.attempts };
  }

  const timeSinceLast = now - cached.timestamp;
  if (timeSinceLast < PREFERENCE_RATE_LIMIT_MS) {
    const waitTime = PREFERENCE_RATE_LIMIT_MS - timeSinceLast;
    return {
      allowed: false,
      waitTime: Math.ceil(waitTime / 1000),
      attempts: cached.attempts,
    };
  }

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

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId requerido" },
        { status: 400 },
      );
    }

    // Rate limit
    const rateLimit = checkPreferenceRateLimit(orderId);
    if (!rateLimit.allowed) {
      if (rateLimit.blocked) {
        return NextResponse.json(
          {
            success: false,
            error: "Demasiados intentos. Intenta nuevamente más tarde.",
            redirect: "/",
            blocked: true,
          },
          { status: 429 },
        );
      }
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

    if (order.paymentStatus === "COMPLETED") {
      return NextResponse.json({
        success: false,
        error: "Esta orden ya fue pagada",
        redirect: "/checkout/success?orderId=" + orderId,
      });
    }

    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const appUrl = normalizeUrl(rawUrl);

    // ✅ CAMBIO: successUrl incluye orderId para que success page pueda verificar
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

    // ✅ NUEVO: Guardar el ID del checkout de Unicobros en la orden
    // Esto permite al cron consultar el estado aunque no llegue webhook ni transactionId
    await prisma.order.update({
      where: { id: order.id },
      data: {
        mercadoPagoId: String(preference.id),
      },
    });

    return NextResponse.json({
      success: true,
      initPoint: preference.init_point,
      preferenceId: preference.id,
    });
  } catch (error: unknown) {
    console.error("❌ Error en Unicobros preference:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 },
    );
  }
}
