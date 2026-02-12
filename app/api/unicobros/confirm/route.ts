// app/api/unicobros/confirm/route.ts
/**
 * Endpoint de confirmación server-side.
 *
 * Se llama desde /checkout/success para confirmar el pago.
 * Ahora: NO confirma "porque sí". Requiere transactionId o que el webhook ya haya guardado mercadoPagoId.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPayment } from "@/lib/payment-confirm";

// Rate limit simple por orderId
const confirmAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_CONFIRM_ATTEMPTS = 20;
const CONFIRM_WINDOW_MS = 5 * 60 * 1000;

function checkConfirmRateLimit(orderId: string): boolean {
  const now = Date.now();
  const entry = confirmAttempts.get(orderId);

  if (!entry || now - entry.firstAt > CONFIRM_WINDOW_MS) {
    confirmAttempts.set(orderId, { count: 1, firstAt: now });
    return true;
  }

  if (entry.count >= MAX_CONFIRM_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

function cleanConfirmCache() {
  if (confirmAttempts.size > 1000) {
    const cutoff = Date.now() - CONFIRM_WINDOW_MS;
    for (const [key, entry] of confirmAttempts.entries()) {
      if (entry.firstAt < cutoff) confirmAttempts.delete(key);
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    const statusParam = searchParams.get("status") || searchParams.get("code");
    const statusNum = statusParam ? parseInt(statusParam, 10) : NaN;

    const transactionId =
      searchParams.get("transactionId") ||
      searchParams.get("transaction_id") ||
      searchParams.get("id");

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId requerido" },
        { status: 400 },
      );
    }

    if (!checkConfirmRateLimit(orderId)) {
      return NextResponse.json(
        { success: false, error: "Demasiados intentos de verificación" },
        { status: 429 },
      );
    }
    cleanConfirmCache();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        downloadToken: true,
        mercadoPagoId: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    if (order.paymentStatus === "COMPLETED") {
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        alreadyProcessed: true,
        orderNumber: order.orderNumber,
        downloadToken: order.downloadToken,
      });
    }

    // ✅ Confirmación por retorno (pero con guard rails)
    if (statusNum === 200) {
      const paymentIdToUse = transactionId
        ? String(transactionId)
        : order.mercadoPagoId;

      // 🔒 Si no tenemos ningún id real, no confirmamos
      if (!paymentIdToUse) {
        return NextResponse.json({
          success: true,
          status: "PENDING",
          message: "Esperando webhook/transactionId para confirmar",
        });
      }

      // Si vino transactionId y aún no lo teníamos guardado, lo persistimos
      if (transactionId && order.mercadoPagoId !== String(transactionId)) {
        await prisma.order.update({
          where: { id: order.id },
          data: { mercadoPagoId: String(transactionId) },
        });
      }

      const result = await confirmPayment({
        orderId: order.id,
        paymentId: String(paymentIdToUse),
        statusNum: 200,
        source: "success_page",
      });

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        select: { downloadToken: true },
      });

      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        alreadyProcessed: result.alreadyProcessed,
        orderNumber: result.orderNumber,
        downloadToken: updatedOrder?.downloadToken,
        emailSent: result.emailSent,
        whatsappSent: result.whatsappSent,
      });
    }

    return NextResponse.json({
      success: true,
      status: "PENDING",
      message: "Esperando confirmación (retorno sin status=200)",
    });
  } catch (error) {
    console.error("[confirm] ❌ Error:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al confirmar pago" },
      { status: 500 },
    );
  }
}
