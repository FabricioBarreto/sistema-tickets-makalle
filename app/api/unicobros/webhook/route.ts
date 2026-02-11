// app/api/unicobros/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TicketStatus } from "@prisma/client";
import crypto from "crypto";
import {
  mapMPStatusToInternal,
  mapMPStatusToPaymentStatus,
} from "@/lib/unicobros";
import { sendTicketWhatsAppTwilio } from "@/lib/whatsapp-twilio";
import { sendTicketEmailWithGmail as sendTicketEmailWithQRs } from "@/lib/email-gmail";

interface WebhookPayment {
  id: string | number;
  reference?: string;
  external_reference?: string;

  // Unicobros puede mandar status como número o como objeto con code
  status?: number | string | { code?: string | number };
  status_code?: number | string;
  code?: number | string;
}

interface WebhookData {
  payment?: WebhookPayment;
}

interface WebhookBody {
  type?: string;
  data?: WebhookData;
}

// Cache de payments procesados (idempotencia)
const processedPayments = new Map<string, number>();

function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function parseStatusNum(payment: any): number {
  const statusRaw =
    payment?.status?.code ?? // formato { status: { code: "200" } }
    payment?.status ?? // formato { status: 200 }
    payment?.status_code ?? // por si viene así
    payment?.code ?? // por si viene plano
    "0";

  const n = parseInt(String(statusRaw), 10);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json();

    // Validar estructura mínima
    if (!rawBody || typeof rawBody !== "object") {
      return new NextResponse(null, { status: 200 });
    }

    const body = rawBody as WebhookBody;

    // ✅ No te cases con type === "checkout"
    // Unicobros puede variar el "type", pero si viene data.payment, sirve.
    const payment = body?.data?.payment;
    if (!payment || !payment.id) {
      return new NextResponse(null, { status: 200 });
    }

    // Log útil para ver qué manda Unicobros de verdad
    console.log("🧾 Webhook payload.payment:", payment);

    const anyPayment = payment as any;

    const paymentId = String(anyPayment.id);
    const orderId = String(
      anyPayment.reference ?? anyPayment.external_reference ?? "",
    );

    if (!orderId) {
      console.log("⏭️ Webhook sin reference/external_reference");
      return new NextResponse(null, { status: 200 });
    }

    const statusNum = parseStatusNum(anyPayment);

    // Solo procesar aprobado
    if (statusNum !== 200) {
      console.log(`⏭️ Status no aprobado: ${statusNum}`);
      return new NextResponse(null, { status: 200 });
    }

    // Cache en memoria (evitar procesar el mismo payment múltiples veces)
    const cacheKey = `${paymentId}-${orderId}`;
    const lastProcessed = processedPayments.get(cacheKey);
    const now = Date.now();

    if (lastProcessed && now - lastProcessed < 300000) {
      // 5 minutos
      console.log(
        `⏭️ Ya procesado (cache): ${paymentId} (hace ${Math.round((now - lastProcessed) / 1000)}s)`,
      );
      return new NextResponse(null, { status: 200 });
    }

    console.log("🔔 Webhook aprobado:", {
      paymentId,
      orderId,
      statusNum,
      timestamp: new Date().toISOString(),
    });

    // Verificar en DB si ya procesamos este pago
    const existingOrder = await prisma.order.findFirst({
      where: {
        mercadoPagoId: paymentId,
        paymentStatus: "COMPLETED",
      },
      select: { id: true, orderNumber: true },
    });

    if (existingOrder) {
      console.log(`⏭️ Ya procesado en DB: ${existingOrder.orderNumber}`);
      processedPayments.set(cacheKey, now);
      return new NextResponse(null, { status: 200 });
    }

    // Buscar orden
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order || !order.tickets || order.tickets.length === 0) {
      console.error("❌ Orden no encontrada o sin tickets:", orderId);
      return new NextResponse(null, { status: 200 });
    }

    console.log(
      `🎫 Orden: ${order.orderNumber} (${order.tickets.length} tickets)`,
    );

    const ticketStatus = mapMPStatusToInternal(statusNum) as TicketStatus;
    const paymentStatus = mapMPStatusToPaymentStatus(statusNum);

    // Anti-downgrade (por si te mandan estados viejos después)
    if (order.paymentStatus === "COMPLETED" && paymentStatus !== "COMPLETED") {
      console.log(`🛡️ Anti-downgrade: ${order.orderNumber}`);
      processedPayments.set(cacheKey, now);
      return new NextResponse(null, { status: 200 });
    }

    // Generar token si no existe
    let downloadToken = order.downloadToken;
    if (!downloadToken) {
      downloadToken = generateDownloadToken();
    }

    // Marcar cache antes de DB (idempotencia)
    processedPayments.set(cacheKey, now);

    // Limpiar cache viejo (> 1 hora)
    if (processedPayments.size > 500) {
      const oneHourAgo = now - 3600000;
      for (const [key, time] of processedPayments.entries()) {
        if (time < oneHourAgo) processedPayments.delete(key);
      }
    }

    // Actualizar orden
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        mercadoPagoId: paymentId,
        mercadoPagoStatus: String(statusNum),
        downloadToken,
      },
    });

    // Actualizar tickets
    await prisma.ticket.updateMany({
      where: { orderId: order.id },
      data: { status: ticketStatus },
    });

    console.log(`✅ Orden actualizada: ${order.orderNumber}`);

    // Envío automático
    console.log("💳 Enviando notificaciones...");

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

    let emailSent = false;
    let whatsappSent = false;

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
        console.log(`✅ Email → ${order.buyerEmail}`);
      } else {
        console.error(`❌ Email falló: ${emailResult.error}`);
      }
    } catch (err: unknown) {
      console.error("❌ Email error:", err);
    }

    // WhatsApp
    if (order.buyerPhone) {
      try {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
          console.log("⚠️ Twilio no configurado");
        } else if (!process.env.TWILIO_CONTENT_SID) {
          console.log("⚠️ Template no configurado");
        } else {
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
            console.log(`✅ WhatsApp → ${normalizedPhone}`);
          }
        }
      } catch (err: unknown) {
        console.log("⚠️ WhatsApp error:", err);
      }
    }

    console.log("📊", {
      email: emailSent ? "✅" : "❌",
      whatsapp: whatsappSent ? "✅" : "⏭️",
      download: downloadUrl,
    });

    return NextResponse.json({
      received: true,
      processed: true,
      orderId: order.id,
      emailSent,
      whatsappSent,
    });
  } catch (error: unknown) {
    console.error("❌ Webhook error:", error);
    return new NextResponse(null, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Unicobros webhook endpoint (fixed parsing + idempotency)",
    version: "4.0",
    timestamp: new Date().toISOString(),
  });
}
