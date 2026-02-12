// app/api/unicobros/webhook/route.ts
/**
 * Webhook de Unicobros - REFACTORIZADO
 *
 * Ahora:
 *  - guarda siempre el paymentId (mercadoPagoId) y status en la orden si puede
 *  - confirma SOLO si status=200
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPayment } from "@/lib/payment-confirm";

interface WebhookBody {
  type?: string;
  data?: {
    payment?: Record<string, unknown>;
  };
}

function parseStatusNum(payment: Record<string, unknown>): number {
  const status = payment?.status;
  const statusRaw =
    (typeof status === "object" && status !== null && "code" in status
      ? (status as { code: unknown }).code
      : null) ??
    status ??
    payment?.status_code ??
    payment?.code ??
    "0";

  const n = parseInt(String(statusRaw), 10);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json();

    if (!rawBody || typeof rawBody !== "object") {
      console.log("[webhook] ⏭️ Body vacío o inválido");
      return new NextResponse(null, { status: 200 });
    }

    const body = rawBody as WebhookBody;
    const payment = body?.data?.payment as Record<string, unknown> | undefined;

    if (!payment || !payment.id) {
      console.log("[webhook] ⏭️ Sin data.payment.id");
      return new NextResponse(null, { status: 200 });
    }

    console.log("[webhook] 🧾 Payload:", JSON.stringify(payment, null, 2));

    const paymentId = String(payment.id);
    const orderId = String(
      payment.reference ?? payment.external_reference ?? "",
    );

    if (!orderId) {
      console.log("[webhook] ⏭️ Sin reference/external_reference");
      return new NextResponse(null, { status: 200 });
    }

    const statusNum = parseStatusNum(payment);

    // ✅ Guardar SIEMPRE paymentId + status (aunque no sea 200)
    // Esto hace que el cron tenga un id real para consultar /operations
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          mercadoPagoId: paymentId,
          mercadoPagoStatus: String(statusNum),
        },
      });
    } catch (e) {
      console.log(
        "[webhook] ⚠️ No se pudo actualizar orden (quizá no existe):",
        e,
      );
      // Igual devolvemos 200
    }

    if (statusNum !== 200) {
      console.log(`[webhook] ⏭️ Status no aprobado: ${statusNum}`);
      return new NextResponse(null, { status: 200 });
    }

    const result = await confirmPayment({
      orderId,
      paymentId,
      statusNum,
      source: "webhook",
    });

    if (!result.success) {
      console.error(`[webhook] ❌ Error confirmando: ${result.error}`);
      return new NextResponse(null, { status: 200 });
    }

    return NextResponse.json({
      received: true,
      processed: !result.alreadyProcessed,
      orderId,
      orderNumber: result.orderNumber,
      emailSent: result.emailSent,
      whatsappSent: result.whatsappSent,
    });
  } catch (error: unknown) {
    console.error("[webhook] ❌ Error:", error);
    return new NextResponse(null, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Unicobros webhook endpoint (v6 - persists paymentId/status)",
    version: "6.0",
    timestamp: new Date().toISOString(),
  });
}
