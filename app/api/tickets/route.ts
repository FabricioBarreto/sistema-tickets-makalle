import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQRHash, generateReadableCode } from "@/lib/crypto";

// GET - Listar tickets (admin)
export async function GET() {
  try {
    const tickets = await prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        order: true,
        validations: {
          orderBy: { timestamp: "desc" },
          take: 1,
          include: {
            user: { select: { name: true } },
          },
        },
      },
    });

    const formatted = tickets.map((t) => {
      const lastValidation = t.validations[0] ?? null;

      const validated = t.status === "VALIDATED" || !!t.validatedAt;

      return {
        id: t.id,
        code: t.code,
        orderNumber: t.order.orderNumber,
        buyerName: t.order.buyerName,
        buyerEmail: t.order.buyerEmail,
        buyerDNI: t.order.buyerDNI ?? "",
        quantity: t.order.quantity,
        price: t.order.unitPrice.toString(),
        validated,
        validatedAt: t.validatedAt?.toISOString?.() ?? null,
        purchaseDate: t.order.purchaseDate.toISOString(),
        paymentStatus: t.order.paymentStatus,
        validatedBy: lastValidation
          ? { name: lastValidation.user.name }
          : validated
            ? { name: "Desconocido" }
            : null,
      };
    });

    return NextResponse.json({ success: true, tickets: formatted });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener tickets" },
      { status: 500 },
    );
  }
}

// POST - Crear nueva orden con tickets
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { buyerName, buyerEmail, buyerPhone, quantity } = body;

    // ✅ Validación básica
    if (!buyerName || !buyerEmail || !quantity) {
      return NextResponse.json(
        { success: false, error: "Faltan datos requeridos" },
        { status: 400 },
      );
    }

    // ✅ SEGURIDAD 1: Bloquear emails de prueba en producción
    if (process.env.NODE_ENV === "production") {
      const testDomains = [
        "@example.com",
        "@test.com",
        "@testing.com",
        "@mail.com",
        "@temp-mail",
        "@throwaway",
        "@guerrillamail",
        "@10minutemail",
      ];

      const isTestEmail = testDomains.some((domain) =>
        buyerEmail.toLowerCase().includes(domain),
      );

      if (isTestEmail) {
        console.log(`⛔ Blocked test email: ${buyerEmail}`);
        return NextResponse.json(
          {
            success: false,
            error:
              "Email de prueba no permitido. Por favor usa un email válido.",
          },
          { status: 400 },
        );
      }
    }

    // ✅ SEGURIDAD 2: Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(buyerEmail)) {
      return NextResponse.json(
        { success: false, error: "Formato de email inválido" },
        { status: 400 },
      );
    }

    // ✅ SEGURIDAD 3: Validar longitud de nombre
    if (buyerName.length < 3 || buyerName.length > 100) {
      return NextResponse.json(
        { success: false, error: "Nombre inválido" },
        { status: 400 },
      );
    }

    // ✅ SEGURIDAD 4: Validar cantidad
    if (quantity < 1 || quantity > 50) {
      return NextResponse.json(
        { success: false, error: "Cantidad inválida" },
        { status: 400 },
      );
    }

    const normalizedPhone =
      typeof buyerPhone === "string" && buyerPhone.trim().length > 0
        ? buyerPhone.trim()
        : null;

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

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `ORD-${timestamp}-${random}`;

    const unitPrice = Number(config.ticketPrice);
    const totalAmount = unitPrice * quantity;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        buyerName,
        buyerEmail,
        buyerPhone: normalizedPhone,
        unitPrice,
        quantity,
        totalAmount,
        paymentStatus: "PENDING",
        status: "ACTIVE",
      },
    });

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
        },
      });

      tickets.push(ticket);
    }

    console.log(`✅ Order created: ${orderNumber} - ${buyerEmail}`);

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
    const errorMessage =
      error instanceof Error ? error.message : "Error al crear la orden";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
