import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQRHash, generateReadableCode } from "@/lib/crypto";

// POST - Crear nueva orden con tickets
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { buyerName, buyerEmail, buyerPhone, buyerDNI, quantity } = body;

    // Validaciones básicas
    if (!buyerName || !buyerEmail || !buyerPhone || !buyerDNI || !quantity) {
      return NextResponse.json(
        { success: false, error: "Faltan datos requeridos" },
        { status: 400 },
      );
    }

    if (quantity < 1 || quantity > 50) {
      return NextResponse.json(
        { success: false, error: "Cantidad inválida" },
        { status: 400 },
      );
    }

    // Obtener configuración
    const config = await prisma.systemConfig.findFirst();
    if (!config) {
      return NextResponse.json(
        { success: false, error: "Configuración del sistema no encontrada" },
        { status: 500 },
      );
    }

    if (!config.salesEnabled) {
      return NextResponse.json(
        { success: false, error: "Las ventas están cerradas" },
        { status: 400 },
      );
    }

    // Verificar disponibilidad
    const soldCount = await prisma.ticket.count({
      where: { status: { in: ["PAID", "VALIDATED"] } },
    });

    const available = config.totalAvailable - soldCount;
    if (available < quantity) {
      return NextResponse.json(
        {
          success: false,
          error: `Solo quedan ${available} entradas disponibles`,
        },
        { status: 400 },
      );
    }

    // Generar número de orden único
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `ORD-${timestamp}-${random}`;

    const unitPrice = Number(config.ticketPrice);
    const totalAmount = unitPrice * quantity;

    // Crear orden
    const order = await prisma.order.create({
      data: {
        orderNumber,
        buyerName,
        buyerEmail,
        buyerPhone,
        buyerDNI,
        unitPrice,
        quantity,
        totalAmount,
        paymentStatus: "PENDING",
        status: "ACTIVE",
      },
    });

    // Crear tickets individuales
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      const code = generateReadableCode(orderNumber, i);
      const qrHash = await generateQRHash(order.id, i);

      const ticket = await prisma.ticket.create({
        data: {
          orderId: order.id,
          code,
          qrHash,
          status: "PENDING_PAYMENT",
          validated: false,
        },
      });

      tickets.push(ticket);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        quantity: order.quantity,
        tickets: tickets.map((t) => ({
          id: t.id,
          code: t.code,
          qrHash: t.qrHash,
        })),
      },
    });
  } catch (error: unknown) {
    console.error("Error creating order:", error);
    let errorMessage = "Error al crear la orden";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
