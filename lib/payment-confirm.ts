// lib/payment-confirm.ts
/**
 * Lógica centralizada de confirmación de pago.
 * Usada por: webhook, /checkout/success (server-side), y cron de verificación.
 *
 * Principios:
 * - Idempotente: si la orden ya está COMPLETED, no hace nada.
 * - Transaccional: Order + Tickets se actualizan juntos.
 * - Anti-downgrade: nunca pasa de COMPLETED a otro estado.
 * - Genera downloadToken si no existe.
 * - Envía notificaciones (email/whatsapp) solo la primera vez.
 */

import { prisma } from "@/lib/prisma";
import { TicketStatus } from "@prisma/client";
import crypto from "crypto";
import {
  mapMPStatusToInternal,
  mapMPStatusToPaymentStatus,
} from "@/lib/unicobros";
import { sendTicketEmailWithGmail as sendTicketEmailWithQRs } from "@/lib/email-gmail";
import { sendTicketWhatsAppTwilio } from "@/lib/whatsapp-twilio";

// Cache en memoria para evitar procesamiento duplicado dentro del mismo proceso
const processedCache = new Map<string, number>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function cleanCache() {
  if (processedCache.size > 500) {
    const cutoff = Date.now() - 60 * 60 * 1000; // 1 hora
    for (const [key, time] of processedCache.entries()) {
      if (time < cutoff) processedCache.delete(key);
    }
  }
}

export interface ConfirmPaymentParams {
  orderId: string;
  paymentId: string; // transactionId de Unicobros
  statusNum: number; // código de estado numérico (200 = aprobado)
  source: "webhook" | "success_page" | "cron" | "manual"; // para logging
}

export interface ConfirmPaymentResult {
  success: boolean;
  alreadyProcessed?: boolean;
  orderNumber?: string;
  error?: string;
  emailSent?: boolean;
  whatsappSent?: boolean;
}

export async function confirmPayment(
  params: ConfirmPaymentParams,
): Promise<ConfirmPaymentResult> {
  const { orderId, paymentId, statusNum, source } = params;

  const logPrefix = `[${source}]`;

  // 1. Validar que el estado sea aprobado
  const paymentStatus = mapMPStatusToPaymentStatus(statusNum);
  const ticketStatus = mapMPStatusToInternal(statusNum) as TicketStatus;

  if (paymentStatus !== "COMPLETED") {
    console.log(
      `${logPrefix} ⏭️ Estado no aprobado: ${statusNum} → ${paymentStatus}`,
    );
    return { success: true, alreadyProcessed: false };
  }

  // 2. Cache en memoria (evitar procesamiento duplicado en el mismo proceso)
  const cacheKey = `${paymentId}-${orderId}`;
  const lastProcessed = processedCache.get(cacheKey);
  const now = Date.now();

  if (lastProcessed && now - lastProcessed < CACHE_TTL_MS) {
    console.log(
      `${logPrefix} ⏭️ Cache hit: ${paymentId} (hace ${Math.round((now - lastProcessed) / 1000)}s)`,
    );
    return { success: true, alreadyProcessed: true };
  }

  // 3. Buscar orden en DB
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { tickets: true },
  });

  if (!order) {
    console.error(`${logPrefix} ❌ Orden no encontrada: ${orderId}`);
    return { success: false, error: "Orden no encontrada" };
  }

  if (!order.tickets || order.tickets.length === 0) {
    console.error(`${logPrefix} ❌ Orden sin tickets: ${orderId}`);
    return { success: false, error: "Orden sin tickets" };
  }

  // 4. IDEMPOTENCIA: Si ya está COMPLETED, no hacer nada
  if (order.paymentStatus === "COMPLETED") {
    console.log(`${logPrefix} ✅ Ya procesada: ${order.orderNumber}`);
    processedCache.set(cacheKey, now);
    return {
      success: true,
      alreadyProcessed: true,
      orderNumber: order.orderNumber,
    };
  }

  // 5. Anti-downgrade: nunca pasar de COMPLETED a otro estado
  if (order.paymentStatus === "COMPLETED" && paymentStatus !== "COMPLETED") {
    console.log(`${logPrefix} 🛡️ Anti-downgrade: ${order.orderNumber}`);
    processedCache.set(cacheKey, now);
    return {
      success: true,
      alreadyProcessed: true,
      orderNumber: order.orderNumber,
    };
  }

  console.log(
    `${logPrefix} 🔔 Confirmando pago: ${order.orderNumber} | paymentId=${paymentId} | status=${statusNum}`,
  );

  // 6. Generar downloadToken si no existe
  const downloadToken = order.downloadToken || generateDownloadToken();

  // 7. Marcar cache ANTES de escribir en DB (previene race conditions)
  processedCache.set(cacheKey, now);
  cleanCache();

  // 8. Actualizar Order + Tickets en una transacción
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "COMPLETED",
        mercadoPagoId: paymentId,
        mercadoPagoStatus: String(statusNum),
        downloadToken,
      },
    }),
    prisma.ticket.updateMany({
      where: { orderId: order.id },
      data: { status: ticketStatus },
    }),
  ]);

  console.log(`${logPrefix} ✅ Orden actualizada: ${order.orderNumber}`);

  // 9. Enviar notificaciones (best-effort, no falla si hay error)
  const { emailSent, whatsappSent } = await sendNotifications({
    order,
    downloadToken,
    logPrefix,
  });

  return {
    success: true,
    alreadyProcessed: false,
    orderNumber: order.orderNumber,
    emailSent,
    whatsappSent,
  };
}

// ─── Notificaciones (best-effort) ───────────────────────────────────────────

interface SendNotificationsParams {
  order: {
    id: string;
    orderNumber: string;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string | null;
    tickets: Array<{
      id: string;
      qrHash: string;
    }>;
  };
  downloadToken: string;
  logPrefix: string;
}

async function sendNotifications(
  params: SendNotificationsParams,
): Promise<{ emailSent: boolean; whatsappSent: boolean }> {
  const { order, downloadToken, logPrefix } = params;
  let emailSent = false;
  let whatsappSent = false;

  try {
    const config = await prisma.systemConfig.findFirst();
    const eventName = config?.eventName || "Carnavales Makallé 2026";
    const eventDate =
      config?.eventDate?.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) || "Febrero 2026";
    const eventLocation = config?.eventLocation || "Makallé, Chaco";

    const rawUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const baseUrl = rawUrl.replace(/\/+$/, "");
    const downloadUrl = `${baseUrl}/api/tickets/download/${downloadToken}`;

    const ticketsData = order.tickets.map((ticket) => ({
      id: ticket.id,
      qrCode: ticket.qrHash,
      order: {
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
      },
    }));

    // Email
    try {
      const emailResult = await sendTicketEmailWithQRs({
        to: order.buyerEmail,
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
        tickets: ticketsData,
        eventName,
        eventDate,
        eventLocation,
        downloadUrl,
      });

      if (emailResult.success) {
        emailSent = true;
        console.log(`${logPrefix} ✅ Email → ${order.buyerEmail}`);
      } else {
        console.error(`${logPrefix} ❌ Email falló: ${emailResult.error}`);
      }
    } catch (err) {
      console.error(`${logPrefix} ❌ Email error:`, err);
    }

    // WhatsApp
    if (order.buyerPhone) {
      try {
        if (
          process.env.TWILIO_ACCOUNT_SID &&
          process.env.TWILIO_AUTH_TOKEN &&
          process.env.TWILIO_CONTENT_SID
        ) {
          let normalizedPhone = order.buyerPhone.replace(/[^0-9+]/g, "");
          if (!normalizedPhone.startsWith("+")) {
            normalizedPhone = "+54" + normalizedPhone;
          }

          const whatsappResult = await sendTicketWhatsAppTwilio({
            to: normalizedPhone,
            buyerName: order.buyerName,
            eventName,
            eventDate,
            eventLocation,
            orderNumber: order.orderNumber,
            ticketCount: order.tickets.length,
            downloadUrl,
          });

          if (whatsappResult.success) {
            whatsappSent = true;
            console.log(`${logPrefix} ✅ WhatsApp → ${normalizedPhone}`);
          }
        }
      } catch (err) {
        console.log(`${logPrefix} ⚠️ WhatsApp error:`, err);
      }
    }

    console.log(
      `${logPrefix} 📊 email=${emailSent ? "✅" : "❌"} whatsapp=${whatsappSent ? "✅" : "⏭️"} download=${downloadUrl}`,
    );
  } catch (err) {
    console.error(`${logPrefix} ❌ Error en notificaciones:`, err);
  }

  return { emailSent, whatsappSent };
}
