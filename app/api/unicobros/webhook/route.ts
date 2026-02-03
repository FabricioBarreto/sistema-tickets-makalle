// app/api/unicobros/webhook/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TicketStatus } from "@prisma/client";
import crypto from "crypto";
import {
  getPaymentStatus,
  mapMPStatusToInternal,
  mapMPStatusToPaymentStatus,
  verifyWebhookSignature,
} from "@/lib/unicobros";
import { sendTicketEmailWithQRs } from "@/lib/email";
import { sendTicketWhatsAppTwilio } from "@/lib/whatsapp-twilio";

interface UnicobrosPaymentData {
  id?: number | string;
  status: number;
  external_reference?: string;
}

function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

type WebhookBody = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
  // Unicobros puede enviar directamente los datos del pago:
  id?: string | number;
  status?: string;
  external_reference?: string;
};

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json();
    const body = rawBody as WebhookBody;

    console.log(
      "🔔 Webhook received from Unicobros:",
      JSON.stringify(body, null, 2),
    );

    // Verificar firma del webhook (si está configurada)
    const signature =
      request.headers.get("x-signature") ||
      request.headers.get("x-unicobros-signature");

    if (signature && process.env.UNICOBROS_WEBHOOK_SECRET) {
      console.log("🔐 Verificando firma del webhook...");
      const isValid = verifyWebhookSignature(body, signature);

      if (!isValid) {
        console.error("⚠️ Firma del webhook inválida");
        return NextResponse.json(
          { received: true, error: "Invalid signature" },
          { status: 401 },
        );
      }

      console.log("✅ Firma verificada");
    }

    // Extraer ID del pago según la estructura del webhook de Unicobros
    // Puede venir en body.data.id o directamente en body.id
    let paymentId: string | number | undefined;

    if (body.type === "payment" && body.data?.id) {
      paymentId = body.data.id;
    } else if (body.id) {
      paymentId = body.id;
    }

    if (paymentId === undefined || paymentId === null) {
      console.log("ℹ️ Webhook sin payment ID, ignorando");
      return NextResponse.json({ received: true });
    }

    const paymentIdStr = String(paymentId);
    console.log(`💳 Processing payment ID: ${paymentIdStr}`);

    // Consultar el estado del pago en Unicobros
    const paymentInfo = await getPaymentStatus(paymentIdStr);

    if (!paymentInfo.success) {
      console.error("❌ Failed to get payment info:", paymentInfo.error);
      return NextResponse.json({ received: true });
    }

    const payment = paymentInfo.payment as UnicobrosPaymentData;
    const orderId = payment.external_reference;

    if (!orderId) {
      console.error("❌ No external reference found in payment");
      return NextResponse.json({ received: true });
    }

    console.log(`📦 Processing order ID: ${orderId}`);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order || !order.tickets || order.tickets.length === 0) {
      console.error("❌ Order not found or has no tickets:", orderId);
      return NextResponse.json({ received: true });
    }

    console.log(`🎫 Found order with ${order.tickets.length} tickets`);

    const ticketStatus = mapMPStatusToInternal(payment.status) as TicketStatus;
    const paymentStatus = mapMPStatusToPaymentStatus(payment.status);

    let downloadToken = order.downloadToken;
    if (!downloadToken) {
      downloadToken = generateDownloadToken();
    }

    // Actualizar orden con info de Unicobros
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        mercadoPagoId: String(payment.id), // Reutilizamos el campo para Unicobros
        mercadoPagoStatus: String(payment.status),
        downloadToken,
      },
    });

    await prisma.ticket.updateMany({
      where: { orderId: order.id },
      data: { status: ticketStatus },
    });

    console.log(`✅ Updated order and tickets - Status: ${ticketStatus}`);

    // 🎉 ENVÍO AUTOMÁTICO DE TICKETS (cuando el pago es aprobado)
    if (payment.status === 200) {
      console.log("💳 Payment approved! Sending notifications...");

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

      // 📧 ENVIAR EMAIL CON QR CODES
      console.log("[notifications] 📧 Attempting EMAIL delivery...");
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
          console.log(`✅ EMAIL sent successfully to ${order.buyerEmail}`);
          console.log(`📧 Message ID: ${emailResult.messageId}`);
        } else {
          console.error(
            `❌ EMAIL failed to ${order.buyerEmail}:`,
            emailResult.error,
          );
        }
      } catch (err: unknown) {
        console.error("❌ EMAIL exception", err);
      }

      // 📱 ENVIAR WHATSAPP VIA TWILIO
      if (order.buyerPhone) {
        console.log("[notifications] 📱 Attempting WhatsApp delivery...");

        try {
          if (
            !process.env.TWILIO_ACCOUNT_SID ||
            !process.env.TWILIO_AUTH_TOKEN
          ) {
            console.log(
              "⚠️  WhatsApp: Twilio credentials not configured, skipping",
            );
          } else if (!process.env.TWILIO_CONTENT_SID) {
            console.log(
              "⚠️  WhatsApp: Template not configured (waiting for Meta approval), skipping",
            );
          } else {
            // Normalizar teléfono
            let normalizedPhone = order.buyerPhone.replace(/[^0-9+]/g, "");
            if (!normalizedPhone.startsWith("+")) {
              normalizedPhone = "+54" + normalizedPhone;
            }
            console.log(
              `📱 Normalized phone: ${order.buyerPhone} → ${normalizedPhone}`,
            );

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
              console.log(
                `✅ WhatsApp sent successfully to ${normalizedPhone}`,
              );
              console.log(`📱 Message SID: ${whatsappResult.messageId}`);
            } else {
              console.log(
                `⚠️  WhatsApp failed to ${normalizedPhone}: ${whatsappResult.error}`,
              );
            }
          }
        } catch (err: unknown) {
          console.log("⚠️  WhatsApp exception (not critical)", err);
        }
      } else {
        console.log("ℹ️  No phone number provided, skipping WhatsApp");
      }

      // 📊 RESUMEN DE NOTIFICACIONES
      console.log("\n📊 Notification Summary:");
      console.log(`   📧 Email: ${emailSent ? "✅ Sent" : "❌ Failed"}`);
      console.log(
        `   📱 WhatsApp: ${
          whatsappSent
            ? "✅ Sent"
            : order.buyerPhone
              ? "⚠️  Skipped/Failed"
              : "⏭️  No phone"
        }`,
      );
      console.log(`   🔗 Download link: ${downloadUrl}\n`);

      if (!emailSent) {
        console.error(
          "⚠️  WARNING: EMAIL delivery failed - customer will need to use download link",
        );
      }
    } else {
      console.log(
        `⏸️  Payment status is ${payment.status}, not sending notifications yet`,
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("❌ Webhook error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ received: true, error: errorMessage });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Unicobros webhook endpoint",
    version: "2.0",
    timestamp: new Date().toISOString(),
  });
}
