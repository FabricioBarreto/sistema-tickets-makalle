// app/api/cron/verify-pending/route.ts
/**
 * Cron job para verificar órdenes pendientes.
 *
 * Busca órdenes PENDING con más de 2 minutos de antigüedad
 * y que tengan mercadoPagoId (transactionId), luego consulta
 * la API de Unicobros para verificar su estado.
 *
 * Uso:
 *   - Vercel Cron: configurar en vercel.json cada 5 minutos
 *   - Manual: GET /api/cron/verify-pending?secret=TU_CRON_SECRET
 *
 * Seguridad:
 *   - Requiere header Authorization o query param ?secret=
 *   - El secret se configura en CRON_SECRET env var
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPaymentStatus } from "@/lib/unicobros";
import { confirmPayment } from "@/lib/payment-confirm";

export const maxDuration = 30; // Vercel: máximo 30 segundos
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Verificar autorización
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const querySecret = new URL(request.url).searchParams.get("secret");

      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;

      if (!isAuthorized) {
        return NextResponse.json(
          { success: false, error: "No autorizado" },
          { status: 401 },
        );
      }
    }

    // Buscar órdenes PENDING con mercadoPagoId y más de 2 minutos
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pendingOrders = await prisma.order.findMany({
      where: {
        paymentStatus: "PENDING",
        mercadoPagoId: { not: null },
        createdAt: {
          gte: twentyFourHoursAgo, // No más de 24 horas
          lte: twoMinutesAgo, // Al menos 2 minutos
        },
      },
      select: {
        id: true,
        orderNumber: true,
        mercadoPagoId: true,
        createdAt: true,
      },
      take: 20, // Procesar máximo 20 por ejecución
      orderBy: { createdAt: "asc" }, // Las más viejas primero
    });

    console.log(
      `[cron] 🔍 Encontradas ${pendingOrders.length} órdenes pendientes`,
    );

    if (pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No hay órdenes pendientes para verificar",
        checked: 0,
        confirmed: 0,
      });
    }

    let confirmed = 0;
    let failed = 0;
    let stillPending = 0;
    const results: Array<{
      orderNumber: string;
      status: string;
      action: string;
    }> = [];

    for (const order of pendingOrders) {
      try {
        const transactionId = order.mercadoPagoId!;
        console.log(
          `[cron] 🔍 Verificando: ${order.orderNumber} → ${transactionId}`,
        );

        // Consultar Unicobros
        const paymentResult = await getPaymentStatus(transactionId);

        if (!paymentResult.success || !paymentResult.payment) {
          console.log(
            `[cron] ⚠️ No se pudo consultar: ${order.orderNumber} - ${paymentResult.error}`,
          );
          results.push({
            orderNumber: order.orderNumber,
            status: "error",
            action: `API error: ${paymentResult.error}`,
          });
          continue;
        }

        const payment = paymentResult.payment;
        const statusNum = parseStatusNum(payment);

        if (statusNum === 200) {
          // Aprobado → confirmar
          const confirmResult = await confirmPayment({
            orderId: order.id,
            paymentId: String(payment.id || transactionId),
            statusNum: 200,
            source: "cron",
          });

          if (confirmResult.success && !confirmResult.alreadyProcessed) {
            confirmed++;
            results.push({
              orderNumber: order.orderNumber,
              status: "confirmed",
              action: "Pago confirmado y notificaciones enviadas",
            });
          } else {
            results.push({
              orderNumber: order.orderNumber,
              status: "already_processed",
              action: "Ya estaba procesada",
            });
          }
        } else if (statusNum === 0 || statusNum === 3 || statusNum === 401) {
          // Rechazado → marcar como FAILED
          failed++;
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: "FAILED",
              mercadoPagoStatus: String(statusNum),
            },
          });
          await prisma.ticket.updateMany({
            where: { orderId: order.id },
            data: { status: "CANCELLED" },
          });

          results.push({
            orderNumber: order.orderNumber,
            status: "failed",
            action: `Pago rechazado (status=${statusNum})`,
          });
        } else {
          // Pendiente todavía
          stillPending++;
          results.push({
            orderNumber: order.orderNumber,
            status: "pending",
            action: `Sigue pendiente (status=${statusNum})`,
          });
        }

        // Pequeño delay entre consultas para no saturar la API
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`[cron] ❌ Error procesando ${order.orderNumber}:`, err);
        results.push({
          orderNumber: order.orderNumber,
          status: "error",
          action: `Error: ${err instanceof Error ? err.message : "unknown"}`,
        });
      }
    }

    console.log(
      `[cron] 📊 Resultado: confirmed=${confirmed} failed=${failed} pending=${stillPending}`,
    );

    return NextResponse.json({
      success: true,
      checked: pendingOrders.length,
      confirmed,
      failed,
      stillPending,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron] ❌ Error general:", error);
    return NextResponse.json(
      { success: false, error: "Error ejecutando verificación" },
      { status: 500 },
    );
  }
}
function parseStatusNum(payment: {
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
