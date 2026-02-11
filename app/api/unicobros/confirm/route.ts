// app/api/unicobros/confirm/route.ts
/**
 * Endpoint de confirmación server-side.
 *
 * Se llama desde /checkout/success para verificar el estado del pago
 * consultando directamente a la API de Unicobros.
 *
 * Query params:
 *   - orderId: ID de la orden
 *   - transactionId: (opcional) ID de transacción de Unicobros que viene en la URL de retorno
 *
 * Flujo:
 *   1. Busca la orden en DB
 *   2. Si ya está COMPLETED, retorna OK sin consultar Unicobros
 *   3. Si tiene transactionId → consulta GET /p/operations/:transactionId
 *   4. Si tiene mercadoPagoId (guardado del checkout) → consulta con ese ID
 *   5. Si el estado es aprobado → llama a confirmPayment()
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/unicobros";
import { confirmPayment } from "@/lib/payment-confirm";

// Rate limit simple por orderId
const confirmAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_CONFIRM_ATTEMPTS = 20; // máximo 20 intentos por orden
const CONFIRM_WINDOW_MS = 5 * 60 * 1000; // ventana de 5 minutos

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

// Limpiar cache periódicamente
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
    const transactionId = searchParams.get("transactionId");

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId requerido" },
        { status: 400 },
      );
    }

    // Rate limit
    if (!checkConfirmRateLimit(orderId)) {
      return NextResponse.json(
        { success: false, error: "Demasiados intentos de verificación" },
        { status: 429 },
      );
    }
    cleanConfirmCache();

    // 1. Buscar orden
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        mercadoPagoId: true,
        downloadToken: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    // 2. Si ya está confirmada, retornar directamente
    if (order.paymentStatus === "COMPLETED") {
      console.log(`[confirm] ✅ Orden ${order.orderNumber} ya confirmada`);
      return NextResponse.json({
        success: true,
        status: "COMPLETED",
        alreadyProcessed: true,
        orderNumber: order.orderNumber,
        downloadToken: order.downloadToken,
      });
    }

    // 3. Determinar qué ID usar para consultar Unicobros
    const queryId = transactionId || order.mercadoPagoId;

    if (!queryId) {
      console.log(
        `[confirm] ⏳ Orden ${order.orderNumber} sin transactionId aún`,
      );
      return NextResponse.json({
        success: true,
        status: "PENDING",
        message: "Esperando confirmación de pago",
      });
    }

    // 4. Consultar API de Unicobros
    console.log(`[confirm] 🔍 Consultando Unicobros: ${queryId}`);
    const paymentResult = await getPaymentStatus(queryId);

    if (!paymentResult.success || !paymentResult.payment) {
      console.log(
        `[confirm] ⚠️ No se pudo consultar Unicobros: ${paymentResult.error}`,
      );

      // Si hay transactionId pero no pudimos consultar, guardar el ID para futuros intentos
      if (transactionId && !order.mercadoPagoId) {
        await prisma.order.update({
          where: { id: order.id },
          data: { mercadoPagoId: transactionId },
        });
      }

      return NextResponse.json({
        success: true,
        status: "PENDING",
        message: "Verificando estado del pago con Unicobros...",
        unicobrosError: paymentResult.error,
      });
    }

    // 5. Parsear estado
    const payment = paymentResult.payment;
    const statusNum = parseStatusFromPayment(payment);

    console.log(
      `[confirm] 📊 Unicobros response: status=${statusNum}, id=${payment.id}`,
    );

    // 6. Si no está aprobado, retornar el estado actual
    if (statusNum !== 200) {
      // Guardar el transactionId para futuros intentos
      if (transactionId && !order.mercadoPagoId) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            mercadoPagoId: transactionId,
            mercadoPagoStatus: String(statusNum),
          },
        });
      }

      return NextResponse.json({
        success: true,
        status: mapStatusToLabel(statusNum),
        statusCode: statusNum,
        message: getStatusMessage(statusNum),
      });
    }

    // 7. Estado aprobado → confirmar pago
    const result = await confirmPayment({
      orderId: order.id,
      paymentId: String(payment.id || transactionId || queryId),
      statusNum: 200,
      source: "success_page",
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    // Obtener downloadToken actualizado
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
  } catch (error) {
    console.error("[confirm] ❌ Error:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al confirmar pago" },
      { status: 500 },
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseStatusFromPayment(payment: {
  status?: unknown;
  status_code?: unknown;
  code?: unknown;
}): number {
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

function mapStatusToLabel(statusNum: number): string {
  switch (statusNum) {
    case 200:
      return "COMPLETED";
    case 2:
    case 4:
      return "PENDING";
    case 0:
    case 3:
    case 401:
      return "FAILED";
    case 603:
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

function getStatusMessage(statusNum: number): string {
  switch (statusNum) {
    case 200:
      return "Pago aprobado";
    case 2:
    case 4:
      return "Pago pendiente de confirmación";
    case 0:
    case 3:
      return "Pago rechazado";
    case 401:
      return "Pago no autorizado";
    case 603:
      return "Pago reembolsado";
    default:
      return "Estado desconocido, verificando...";
  }
}
