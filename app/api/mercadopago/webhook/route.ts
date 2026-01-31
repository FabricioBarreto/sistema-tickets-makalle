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

/**
 * GET /api/mercadopago/webhook/test?paymentId=XXXX
 * Endpoint para forzar procesamiento manual de un pago
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: "paymentId required" },
        { status: 400 },
      );
    }

    console.log(`🧪 Manual webhook test for payment: ${paymentId}`);

    const paymentInfo = await getPaymentStatus(paymentId);

    if (!paymentInfo.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to get payment info",
          details: paymentInfo.error,
        },
        { status: 500 },
      );
    }

    const payment = paymentInfo.payment as MPPaymentData;
    const orderId = payment.external_reference;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "No external reference in payment" },
        { status: 404 },
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order || !order.tickets || order.tickets.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
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

    console.log(`✅ Order updated: ${order.orderNumber}`);

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

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const downloadUrl = `${baseUrl}/api/tickets/download/${downloadToken}`;

      const ticketsData = order.tickets.map((ticket) => ({
        id: ticket.id,
        qrCode: ticket.qrHash,
        order: {
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
        },
      }));

      // Enviar email
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

        console.log(`Email: ${emailResult.success ? "✅ Sent" : "❌ Failed"}`);
      } catch (emailError) {
        console.error("Email error:", emailError);
      }

      // Intentar WhatsApp
      if (order.buyerPhone) {
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

            console.log(
              `WhatsApp: ${whatsappResult.success ? "✅ Sent" : "⚠️ Failed"}`,
            );
          }
        } catch (whatsappError) {
          console.log("WhatsApp skipped");
        }
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentStatus,
      ticketStatus,
    });
  } catch (error: unknown) {
    console.error("Test webhook error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
