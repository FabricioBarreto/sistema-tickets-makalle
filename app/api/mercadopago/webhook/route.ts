import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPaymentStatus,
  mapMPStatusToInternal,
  mapMPStatusToPaymentStatus,
} from "@/lib/mercadopago";
import { sendTicketEmailWithQRs } from "@/lib/email";

/**
 * POST /api/mercadopago/webhook - Webhook de Mercado Pago
 * Recibe notificaciones de cambios en el estado de pagos
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("🔔 Webhook received:", JSON.stringify(body, null, 2));

    // Filtrar solo notificaciones de tipo payment
    if (body.type !== "payment") {
      return NextResponse.json({ received: true });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return NextResponse.json({ received: true });
    }

    console.log(`💳 Processing payment ID: ${paymentId}`);

    // Obtener información del pago
    const paymentInfo = await getPaymentStatus(paymentId);
    if (!paymentInfo.success || !paymentInfo.payment) {
      console.error("❌ Failed to get payment info:", paymentInfo.error);
      return NextResponse.json({ received: true });
    }

    const payment = paymentInfo.payment;
    const orderId = payment.externalReference;

    if (!orderId) {
      console.error("❌ No external reference found in payment");
      return NextResponse.json({ received: true });
    }

    console.log(`📦 Processing order ID: ${orderId}`);

    // Buscar la orden con sus tickets
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tickets: true,
      },
    });

    if (!order || !order.tickets || order.tickets.length === 0) {
      console.error("❌ Order not found or has no tickets:", orderId);
      return NextResponse.json({ received: true });
    }

    console.log(`🎫 Found order with ${order.tickets.length} tickets`);

    // Mapear estados
    const ticketStatus = mapMPStatusToInternal(payment.status);
    const paymentStatus = mapMPStatusToPaymentStatus(payment.status);

    // Actualizar orden
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus,
        mercadoPagoId: payment.id?.toString(),
        mercadoPagoStatus: payment.status,
      },
    });

    // Actualizar todos los tickets
    await prisma.ticket.updateMany({
      where: { orderId: order.id },
      data: {
        status: ticketStatus,
      },
    });

    console.log(`✅ Updated order and tickets - Status: ${ticketStatus}`);

    // Si el pago fue aprobado, enviar email con QRs
    if (payment.status === "approved") {
      console.log("💳 Payment approved! Sending confirmation email...");

      try {
        // Obtener configuración del evento
        const config = await prisma.systemConfig.findFirst();

        const emailResult = await sendTicketEmailWithQRs({
          to: order.buyerEmail,
          orderNumber: order.orderNumber,
          buyerName: order.buyerName,
          tickets: order.tickets.map((ticket) => ({
            id: ticket.id,
            qrCode: ticket.qrHash, // ✅ Usar qrHash del schema
            order: {
              orderNumber: order.orderNumber,
              buyerName: order.buyerName,
            },
          })),
          eventName: config?.eventName || "Carnavales Makallé 2026",
          eventDate:
            config?.eventDate?.toLocaleDateString("es-AR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            }) || "Febrero 2026",
          eventLocation: config?.eventLocation || "Makallé, Chaco",
        });

        if (emailResult.success) {
          console.log(`✅ Email sent successfully to ${order.buyerEmail}`);
          console.log(`📬 Message ID: ${emailResult.messageId}`);
        } else {
          console.error("❌ Failed to send email:", emailResult.error);
        }
      } catch (emailError) {
        console.error("❌ Error sending confirmation email:", emailError);
        // No fallar el webhook si el email falla
      }
    } else {
      console.log(
        `⏸️  Payment status is ${payment.status}, not sending email yet`,
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    // Retornar 200 para que MP no reintente
    return NextResponse.json({ received: true, error: error.message });
  }
}

/**
 * GET /api/mercadopago/webhook - Verificar que el webhook esté activo
 */
export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Mercado Pago webhook endpoint",
  });
}
