// app/api/mercadopago/webhook/test/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TicketStatus } from "@prisma/client";
import crypto from "crypto";
import {
  getPaymentStatus,
  mapMPStatusToInternal,
  mapMPStatusToPaymentStatus,
} from "@/lib/mercadopago";
import { sendTicketEmailWithQRs } from "@/lib/email";
import { sendTicketWhatsAppTwilio } from "@/lib/whatsapp-twilio";

interface MPPaymentData {
  id?: number;
  status: string;
  external_reference?: string;
}

function generateDownloadToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "paymentId required in query params" },
        { status: 400 },
      );
    }

    console.log(`🧪 Manual webhook test for payment: ${paymentId}`);

    const paymentInfo = await getPaymentStatus(paymentId);

    if (!paymentInfo.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get payment info from Mercado Pago",
          details: paymentInfo.error,
        },
        { status: 500 },
      );
    }

    const payment = paymentInfo.payment as MPPaymentData;
    const orderId = payment.external_reference;

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error: "No external_reference found in payment",
        },
        { status: 404 },
      );
    }

    console.log(`📦 Found order ID: ${orderId}`);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order || !order.tickets || order.tickets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Order ${orderId} not found or has no tickets`,
        },
        { status: 404 },
      );
    }

    const ticketStatus = mapMPStatusToInternal(payment.status) as TicketStatus;
    const paymentStatus = mapMPStatusToPaymentStatus(payment.status);

    let downloadToken = order.downloadToken;
    if (!downloadToken) {
      downloadToken = generateDownloadToken();
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        mercadoPagoId: payment.id?.toString(),
        mercadoPagoStatus: payment.status,
        downloadToken,
      },
    });

    await prisma.ticket.updateMany({
      where: { orderId: order.id },
      data: { status: ticketStatus },
    });

    console.log(`✅ Order ${order.orderNumber} updated to ${paymentStatus}`);

    const notifications = {
      email: false,
      whatsapp: false,
    };

    if (payment.status === "approved") {
      const config = await prisma.systemConfig.findFirst();
      const eventName = config?.eventName || "Carnavales Makallé 2026";
      const eventDate =
        config?.eventDate?.toLocaleDateString("es-AR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }) || "Febrero 2026";
      const eventLocation = config?.eventLocation || "Makallé, Chaco";

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const baseUrl = appUrl.replace(/\/+$/, "");
      const downloadUrl = `${baseUrl}/api/tickets/download/${downloadToken}`;

      const ticketsData = order.tickets.map((ticket) => ({
        id: ticket.id,
        qrCode: ticket.qrHash,
        order: {
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
        },
      }));

      console.log("📧 Sending email...");
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

        notifications.email = emailResult.success;
        console.log(`Email: ${emailResult.success ? "✅ Sent" : "❌ Failed"}`);
      } catch (emailError) {
        console.error("Email error:", emailError);
      }

      if (order.buyerPhone) {
        console.log("📱 Attempting WhatsApp...");
        try {
          if (
            process.env.TWILIO_ACCOUNT_SID &&
            process.env.TWILIO_AUTH_TOKEN &&
            process.env.TWILIO_CONTENT_SID
          ) {
            const whatsappResult = await sendTicketWhatsAppTwilio({
              to: order.buyerPhone,
              buyerName: order.buyerName,
              eventName,
              eventDate,
              eventLocation,
              orderNumber: order.orderNumber,
              ticketCount: order.tickets.length,
              downloadUrl,
            });

            notifications.whatsapp = whatsappResult.success;
            console.log(
              `WhatsApp: ${whatsappResult.success ? "✅ Sent" : "⚠️ Failed"}`,
            );
          } else {
            console.log("WhatsApp: Credentials not configured");
          }
        } catch (whatsappError) {
          console.log("WhatsApp: Skipped due to error");
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment processed successfully",
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        paymentStatus,
        ticketStatus,
        mpStatus: payment.status,
        notifications,
      },
    });
  } catch (error: unknown) {
    console.error("❌ Test webhook error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
