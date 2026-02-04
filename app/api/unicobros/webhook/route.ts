// app/api/unicobros/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TicketStatus } from "@prisma/client";
import crypto from "crypto";
import {
  mapMPStatusToInternal,
  mapMPStatusToPaymentStatus,
} from "@/lib/unicobros";
import { sendTicketEmailWithQRs } from "@/lib/email";
import { sendTicketWhatsAppTwilio } from "@/lib/whatsapp-twilio";

function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json();
    const body = rawBody as any;

    console.log(
      "🔔 Webhook received from Unicobros:",
      JSON.stringify(body, null, 2),
    );

    // Extraer datos del webhook de Unicobros
    if (body.type !== "checkout" || !body.data) {
      console.log("ℹ️ Webhook no es de tipo checkout, ignorando");
      return NextResponse.json({ received: true });
    }

    const webhookData = body.data;
    const payment = webhookData.payment;

    if (!payment || !payment.id || !payment.reference) {
      console.log("ℹ️ Webhook incompleto, ignorando");
      return NextResponse.json({ received: true });
    }

    const paymentId = String(payment.id);
    const orderId = payment.reference;
    const statusCode = payment.status?.code || "0";

    console.log(`💳 Processing payment ID: ${paymentId}`);
    console.log(`📦 Processing order ID: ${orderId}`);
    console.log(`📊 Status code: ${statusCode}`);

    // Buscar orden
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order || !order.tickets || order.tickets.length === 0) {
      console.error("❌ Order not found or has no tickets:", orderId);
      return NextResponse.json({ received: true });
    }

    console.log(`🎫 Found order with ${order.tickets.length} tickets`);

    // Mapear status
    const statusNum = parseInt(statusCode);
    const ticketStatus = mapMPStatusToInternal(statusNum) as TicketStatus;
    const paymentStatus = mapMPStatusToPaymentStatus(statusNum);

    // Generar token si no existe
    let downloadToken = order.downloadToken;
    if (!downloadToken) {
      downloadToken = generateDownloadToken();
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

    await prisma.ticket.updateMany({
      where: { orderId: order.id },
      data: { status: ticketStatus },
    });

    console.log(`✅ Updated order and tickets - Status: ${ticketStatus}`);

    // 🎉 ENVÍO AUTOMÁTICO DE TICKETS (status 200 = aprobado)
    if (statusCode === "200") {
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

      // 📧 ENVIAR EMAIL
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

      // 📱 ENVIAR WHATSAPP
      if (order.buyerPhone) {
        console.log("[notifications] 📱 Attempting WhatsApp delivery...");

        try {
          if (
            !process.env.TWILIO_ACCOUNT_SID ||
            !process.env.TWILIO_AUTH_TOKEN
          ) {
            console.log("⚠️ WhatsApp: Twilio credentials not configured");
          } else if (!process.env.TWILIO_CONTENT_SID) {
            console.log("⚠️ WhatsApp: Template not configured");
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
              console.log(`✅ WhatsApp sent to ${normalizedPhone}`);
            }
          }
        } catch (err: unknown) {
          console.log("⚠️ WhatsApp exception", err);
        }
      }

      // 📊 RESUMEN
      console.log("\n📊 Notification Summary:");
      console.log(`   📧 Email: ${emailSent ? "✅ Sent" : "❌ Failed"}`);
      console.log(`   📱 WhatsApp: ${whatsappSent ? "✅ Sent" : "⏭️ Skipped"}`);
      console.log(`   🔗 Download link: ${downloadUrl}\n`);
    } else {
      console.log(`⏸️ Status is ${statusCode}, not sending notifications yet`);
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json(
      {
        received: true,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
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
