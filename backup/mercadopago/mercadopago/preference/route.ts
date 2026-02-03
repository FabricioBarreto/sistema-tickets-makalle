import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPreference } from "@/lib/unicobros";

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    console.log("🔍 MP Preference - Body recibido:", { orderId });

    if (!orderId) {
      console.error("❌ No orderId provided");
      return NextResponse.json(
        { success: false, error: "orderId requerido" },
        { status: 400 },
      );
    }

    console.log("📦 Buscando orden:", orderId);
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order) {
      console.error("❌ Orden no encontrada:", orderId);
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    console.log("✅ Orden encontrada:", order.orderNumber);

    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const appUrl = normalizeUrl(rawUrl);
    const isLocal = appUrl.includes("localhost");

    const successUrl = `${appUrl}/checkout/success?orderId=${orderId}`;
    const failureUrl = `${appUrl}/checkout/failure?orderId=${orderId}`;
    const pendingUrl = `${appUrl}/checkout/pending?orderId=${orderId}`;
    const notificationUrl = `${appUrl}/api/mercadopago/webhook`;

    console.log("🚀 Creando preferencia MP:", {
      orderId,
      appUrl,
      localMode: isLocal,
      back_urls: {
        success: successUrl,
        failure: failureUrl,
        pending: pendingUrl,
      },
      notification_url: notificationUrl,
      hasPhone: !!order.buyerPhone,
      hasDni: !!order.buyerDNI,
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

    console.log("✅ Preferencia MP creada:", {
      id: preference.id,
      init_point: preference.init_point,
    });

    const response = {
      success: true,
      initPoint: preference.init_point,
      preferenceId: preference.id,
    };

    console.log("📤 Enviando respuesta:", response);

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("❌ Error completo en MP preference:", error);
    console.error("❌ Stack:", error instanceof Error ? error.stack : "N/A");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
