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
  reference: string;
  status?: {
    code: string;
  };
}

interface WebhookData {
  payment: WebhookPayment;
}

interface WebhookBody {
  type: string;
  data: WebhookData;
}

// ✅ RATE LIMITING GLOBAL AGRESIVO
let lastProcessedTime = 0;
const GLOBAL_RATE_LIMIT_MS = 1000; // 1 segundo entre webhooks
const processedPayments = new Map<string, number>(); // Cache de payments procesados

function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function checkGlobalRateLimit(): boolean {
  const now = Date.now();
  if (now - lastProcessedTime < GLOBAL_RATE_LIMIT_MS) {
    return false; // Demasiado rápido
  }
  lastProcessedTime = now;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // ✅ RATE LIMIT GLOBAL (1 req/segundo para TODO)
    if (!checkGlobalRateLimit()) {
      return new NextResponse(null, { status: 200 });
    }

    const rawBody: unknown = await request.json();

    // Validar estructura básica
    if (
      !rawBody ||
      typeof rawBody !== "object" ||
      !("type" in rawBody) ||
      !("data" in rawBody)
    ) {
      return new NextResponse(null, { status: 200 });
    }

    const body = rawBody as WebhookBody;

    // ✅ FILTRO 1: Solo tipo "checkout"
    if (body.type !== "checkout") {
      console.log(`⏭️ Tipo: ${body.type}`);
      return new NextResponse(null, { status: 200 });
    }

    const webhookData = body.data;
    const payment = webhookData?.payment;

    // ✅ FILTRO 2: Validar datos completos
    if (!payment || !payment.id || !payment.reference) {
      return new NextResponse(null, { status: 200 });
    }

    const paymentId = String(payment.id);
    const orderId = payment.reference;
    const statusCode = payment.status?.code || "0";
    const statusNum = parseInt(statusCode, 10);

    // ✅ FILTRO 3: Solo procesar status 200 (aprobado)
    if (statusNum !== 200) {
      console.log(`⏭️ Status: ${statusCode}`);
      return new NextResponse(null, { status: 200 });
    }

    // ✅ FILTRO 4: Cache en memoria (evitar procesar el mismo payment múltiples veces)
    const cacheKey = `${paymentId}-${orderId}`;
    const lastProcessed = processedPayments.get(cacheKey);
    const now = Date.now();

    if (lastProcessed && now - lastProcessed < 300000) {
      // 5 minutos
      console.log(
        `⏭️ Ya procesado: ${paymentId} (hace ${Math.round((now - lastProcessed) / 1000)}s)`,
      );
      return new NextResponse(null, { status: 200 });
    }

    console.log("🔔 Webhook válido:", {
      paymentId,
      orderId,
      statusCode,
      timestamp: new Date().toISOString(),
    });

    // ✅ FILTRO 5: Verificar en DB si ya procesamos este pago
    const existingOrder = await prisma.order.findFirst({
      where: {
        mercadoPagoId: paymentId,
        paymentStatus: "COMPLETED",
      },
      select: { id: true, orderNumber: true },
    });

    if (existingOrder) {
      console.log(`⏭️ Ya procesado en DB: ${existingOrder.orderNumber}`);
      processedPayments.set(cacheKey, now); // Guardar en cache
      return new NextResponse(null, { status: 200 });
    }

    // Buscar orden
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order || !order.tickets || order.tickets.length === 0) {
      console.error("❌ Orden no encontrada:", orderId);
      return new NextResponse(null, { status: 200 });
    }

    console.log(
      `🎫 Orden: ${order.orderNumber} (${order.tickets.length} tickets)`,
    );

    // Mapear status
    const ticketStatus = mapMPStatusToInternal(statusNum) as TicketStatus;
    const paymentStatus = mapMPStatusToPaymentStatus(statusNum);

    // ✅ FILTRO 6: Anti-downgrade
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

    // ✅ MARCAR COMO PROCESADO EN CACHE ANTES DE ACTUALIZAR DB
    processedPayments.set(cacheKey, now);

    // Limpiar cache viejo (> 1 hora)
    if (processedPayments.size > 500) {
      const oneHourAgo = now - 3600000;
      for (const [key, time] of processedPayments.entries()) {
        if (time < oneHourAgo) {
          processedPayments.delete(key);
        }
      }
    }

    // Actualizar orden
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        mercadoPagoId: paymentId,
        mercadoPagoStatus: statusCode,
        downloadToken,
      },
    });

    // Actualizar tickets
    await prisma.ticket.updateMany({
      where: { orderId: order.id },
      data: { status: ticketStatus },
    });

    console.log(`✅ Orden actualizada: ${order.orderNumber}`);

    // 🎉 ENVÍO AUTOMÁTICO DE TICKETS
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

    // 📧 ENVIAR EMAIL
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

    // 📱 ENVIAR WHATSAPP
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

    // 📊 RESUMEN
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
    message: "Unicobros webhook endpoint with rate limiting",
    version: "3.1",
    timestamp: new Date().toISOString(),
  });
}
