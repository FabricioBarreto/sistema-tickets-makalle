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

      // ✅ Regla “realista”: si la orden está COMPLETED, para el panel es pagado
      const isPaid =
        t.order.paymentStatus === "COMPLETED" ||
        t.status === "PAID" ||
        t.status === "VALIDATED";

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
        ticketStatus: t.status, // 👈 NUEVO
        displayStatus: isPaid ? "PAID" : "PENDING_PAYMENT", // 👈 NUEVO

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
  // 🚨 DEBUG: LOGGING TEMPORAL PARA IDENTIFICAR ATACANTE
  const clientIP =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const debugInfo = {
    timestamp: new Date().toISOString(),
    ip: clientIP,
    userAgent: req.headers.get("user-agent") || "none",
    referer: req.headers.get("referer") || "none",
    origin: req.headers.get("origin") || "none",
    cfCountry: req.headers.get("cf-ipcountry") || "unknown",
    cfRay: req.headers.get("cf-ray") || "none",
    host: req.headers.get("host"),
    acceptLanguage: req.headers.get("accept-language") || "none",
  };

  console.log(
    "🚨 POST /api/tickets REQUEST:",
    JSON.stringify(debugInfo, null, 2),
  );
  // FIN DEBUG

  try {
    const body = await req.json();
    const { buyerName, buyerEmail, buyerPhone, quantity } = body;

    // 🚨 DEBUG: Log del contenido del request
    console.log("🚨 REQUEST BODY:", {
      buyerName,
      buyerEmail,
      buyerPhone,
      quantity,
      ip: clientIP,
    });

    // ✅ Validación básica
    if (!buyerName || !buyerEmail || !quantity) {
      console.log("⛔ BLOCKED: Missing required fields from IP:", clientIP);
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
        console.log(
          `⛔ BLOCKED test email: ${buyerEmail} from IP: ${clientIP}`,
        );
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
      console.log(
        `⛔ BLOCKED invalid email: ${buyerEmail} from IP: ${clientIP}`,
      );
      return NextResponse.json(
        { success: false, error: "Formato de email inválido" },
        { status: 400 },
      );
    }

    // ✅ SEGURIDAD 3: Validar longitud de nombre
    if (buyerName.length < 3 || buyerName.length > 100) {
      console.log(`⛔ BLOCKED invalid name length from IP: ${clientIP}`);
      return NextResponse.json(
        { success: false, error: "Nombre inválido" },
        { status: 400 },
      );
    }

    // ✅ SEGURIDAD 4: Validar cantidad
    if (quantity < 1 || quantity > 50) {
      console.log(
        `⛔ BLOCKED invalid quantity: ${quantity} from IP: ${clientIP}`,
      );
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
      console.log(`⛔ BLOCKED: Sales disabled - IP: ${clientIP}`);
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
      console.log(`⛔ BLOCKED: Insufficient tickets - IP: ${clientIP}`);
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

    // 🚨 DEBUG: Log de orden exitosa
    console.log(
      `✅ Order created: ${orderNumber} - ${buyerEmail} - IP: ${clientIP} - Country: ${debugInfo.cfCountry}`,
    );

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
    console.log("🚨 ERROR from IP:", clientIP);
    const errorMessage =
      error instanceof Error ? error.message : "Error al crear la orden";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
