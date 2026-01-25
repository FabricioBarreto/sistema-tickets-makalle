import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "No autorizado" },
        { status: 401 },
      );
    }

    const { qrCode } = await req.json();

    if (!qrCode) {
      return NextResponse.json(
        { success: false, message: "Código QR requerido" },
        { status: 400 },
      );
    }

    const code = qrCode.trim();

    // Buscar el ticket por QR hash o código manual
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
          },
        },
        validations: {
          include: {
            user: {
              select: { name: true },
            },
          },
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, message: "Entrada no encontrada" },
        { status: 404 },
      );
    }

    // ✅ Verificar si ya fue validada (sin campo validated)
    const alreadyValidated =
      ticket.status === "VALIDATED" || !!ticket.validatedAt;

    if (alreadyValidated) {
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
            validatedBy: ticket.validations[0]?.user || null,
          },
        },
        { status: 400 },
      );
    }

    // Verificar estado de pago
    if (ticket.order.paymentStatus !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          message: "Entrada no pagada o pago pendiente",
        },
        { status: 400 },
      );
    }

    // ✅ Validar la entrada (sin validated)
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        validatedAt: new Date(),
        status: "VALIDATED",
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

    // Registrar la validación
    const validation = await prisma.validation.create({
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
        user: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Entrada validada correctamente",
      ticket: {
        id: updatedTicket.id,
        orderNumber: updatedTicket.order.orderNumber,
        buyerName: updatedTicket.order.buyerName,
        buyerEmail: updatedTicket.order.buyerEmail,
        buyerDNI: updatedTicket.order.buyerDNI,
        quantity: updatedTicket.order.quantity,
        validated: true, // ✅ lo devolvemos para tu UI
        validatedAt: updatedTicket.validatedAt,
        validatedBy: validation.user,
      },
    });
  } catch (error) {
    console.error("Error validating ticket:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error interno del servidor",
        error: String(error),
      },
      { status: 500 },
    );
  }
}
