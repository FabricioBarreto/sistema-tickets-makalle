import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPreference } from "@/lib/unicobros";

// ✅ Rate limiting para prevenir checkouts duplicados
const preferenceCache = new Map<string, number>();
const PREFERENCE_RATE_LIMIT_MS = 5000; // 5 segundos entre requests del mismo orderId

function checkPreferenceRateLimit(orderId: string): {
  allowed: boolean;
  waitTime?: number;
} {
  const now = Date.now();
  const lastRequest = preferenceCache.get(orderId);

  if (lastRequest && now - lastRequest < PREFERENCE_RATE_LIMIT_MS) {
    const waitTime = PREFERENCE_RATE_LIMIT_MS - (now - lastRequest);
    return { allowed: false, waitTime: Math.ceil(waitTime / 1000) };
  }

  preferenceCache.set(orderId, now);

  // Limpiar cache viejo (> 1 hora)
  if (preferenceCache.size > 500) {
    const oneHourAgo = now - 3600000;
    for (const [key, time] of preferenceCache.entries()) {
      if (time < oneHourAgo) preferenceCache.delete(key);
    }
  }

  return { allowed: true };
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

    // ✅ VERIFICAR RATE LIMIT
    const rateLimit = checkPreferenceRateLimit(orderId);
    if (!rateLimit.allowed) {
      console.log(`⏳ Rate limit: ${orderId} - espera ${rateLimit.waitTime}s`);
      return NextResponse.json(
        {
          success: false,
          error: `Espera ${rateLimit.waitTime} segundos antes de intentar nuevamente`,
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

    console.log(`✅ Orden encontrada: ${order.orderNumber}`);

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

    // Contexto adicional para errores de Prisma
    if (error instanceof Error && error.message.includes("Prisma")) {
      console.error("💡 Tip: Verifica DATABASE_URL en variables de entorno");
      console.error("💡 Tip: Cambia a Transaction Mode en Supabase");
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
