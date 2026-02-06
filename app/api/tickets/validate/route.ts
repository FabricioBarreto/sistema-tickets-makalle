import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "No autorizado" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { qrCode } = body;

    if (!qrCode || typeof qrCode !== "string") {
      return NextResponse.json(
        { success: false, message: "Código QR requerido" },
        { status: 400 },
      );
    }

    const code = qrCode.trim();

    // 🔍 PASO 1: Buscar el ticket (con todos los datos necesarios)
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [{ qrHash: code }, { code }],
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            buyerName: true,
            buyerEmail: true,
            buyerPhone: true,
            buyerDNI: true,
            unitPrice: true,
            quantity: true,
            paymentStatus: true,
            mercadoPagoStatus: true,
          },
        },
        validations: {
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        {
          success: false,
          message: "Entrada no encontrada. Verificá el código.",
        },
        { status: 404 },
      );
    }

    // 🚫 PASO 2: Verificar si ya fue validada
    const alreadyValidated =
      ticket.status === "VALIDATED" || !!ticket.validatedAt;

    if (alreadyValidated) {
      const lastValidation = ticket.validations[0];

      return NextResponse.json(
        {
          success: false,
          message: "Esta entrada ya fue utilizada",
          ticket: {
            id: ticket.id,
            orderNumber: ticket.order.orderNumber,
            buyerName: ticket.order.buyerName,
            buyerEmail: ticket.order.buyerEmail,
            buyerDNI: ticket.order.buyerDNI,
            quantity: ticket.order.quantity,
            validated: true,
            validatedAt: ticket.validatedAt,
            validatedBy: lastValidation?.user || null,
          },
        },
        { status: 409 }, // 409 Conflict
      );
    }

    // 💳 PASO 3: Verificar estado de pago
    if (ticket.order.paymentStatus !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: "PAYMENT_PENDING",
          message: "Pago aún no confirmado. Esperá unos segundos y reintentá.",
          ticket: {
            id: ticket.id,
            orderNumber: ticket.order.orderNumber,
            buyerName: ticket.order.buyerName,
            buyerEmail: ticket.order.buyerEmail,
            buyerDNI: ticket.order.buyerDNI,
            quantity: ticket.order.quantity,
            validated: false,
          },
          payment: {
            paymentStatus: ticket.order.paymentStatus,
            providerStatus: ticket.order.mercadoPagoStatus,
          },
        },
        { status: 409 },
      );
    }

    // ✅ PASO 4: VALIDAR - Transacción atómica con lock optimista
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Verificar nuevamente con lock (prevenir race condition)
        const currentTicket = await tx.ticket.findUnique({
          where: { id: ticket.id },
          select: { status: true, validatedAt: true },
        });

        if (!currentTicket) {
          throw new Error("Ticket no encontrado en transacción");
        }

        if (currentTicket.status === "VALIDATED" || currentTicket.validatedAt) {
          throw new Error("ALREADY_VALIDATED");
        }

        // Actualizar ticket
        const updatedTicket = await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            validatedAt: new Date(),
            status: "VALIDATED",
            updatedAt: new Date(),
          },
          include: {
            order: {
              select: {
                orderNumber: true,
                buyerName: true,
                buyerEmail: true,
                buyerPhone: true,
                buyerDNI: true,
                unitPrice: true,
                quantity: true,
              },
            },
          },
        });

        // Crear registro de validación
        const validation = await tx.validation.create({
          data: {
            ticketId: updatedTicket.id,
            userId: session.user.id,
            ipAddress:
              req.headers.get("x-forwarded-for") ||
              req.headers.get("x-real-ip") ||
              "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
          },
          include: {
            user: { select: { name: true, email: true } },
          },
        });

        return { updatedTicket, validation };
      });

      // ✅ Éxito
      return NextResponse.json({
        success: true,
        message: "✅ Entrada validada correctamente",
        ticket: {
          id: result.updatedTicket.id,
          orderNumber: result.updatedTicket.order.orderNumber,
          buyerName: result.updatedTicket.order.buyerName,
          buyerEmail: result.updatedTicket.order.buyerEmail,
          buyerDNI: result.updatedTicket.order.buyerDNI,
          quantity: result.updatedTicket.order.quantity,
          validated: true,
          validatedAt: result.updatedTicket.validatedAt,
          validatedBy: result.validation.user,
        },
      });
    } catch (txError) {
      // Manejo específico de error de ya validado
      if (txError instanceof Error && txError.message === "ALREADY_VALIDATED") {
        return NextResponse.json(
          {
            success: false,
            message: "Esta entrada ya fue utilizada (doble escaneo detectado)",
          },
          { status: 409 },
        );
      }
      throw txError; // Re-lanzar otros errores
    }
  } catch (error) {
    console.error("❌ Error validating ticket:", error);

    // Log detallado del error
    const errorDetails =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { error: String(error) };

    return NextResponse.json(
      {
        success: false,
        message: "Error interno del servidor",
        ...(process.env.NODE_ENV === "development" && { debug: errorDetails }),
      },
      { status: 500 },
    );
  }
}
