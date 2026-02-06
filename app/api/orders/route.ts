import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ✅ DNI ya no es requerido en el schema
const bodySchema = z.object({
  buyerName: z.string().min(3),
  buyerEmail: z.string().email(),
  buyerPhone: z.string().min(6),
  quantity: z.number().int().min(1).max(10),
});

// 🆕 GET - Para obtener órdenes (usado por dashboard)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, message: "No autorizado" },
        { status: 401 },
      );
    }

    // Obtener todas las órdenes con sus tickets
    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: "COMPLETED",
      },
      include: {
        tickets: {
          select: {
            id: true,
            status: true,
            validatedAt: true,
          },
        },
      },
      orderBy: {
        purchaseDate: "desc",
      },
    });

    // 🔧 Transformar para agregar campo "validated" calculado
    const ordersWithValidated = orders.map((order) => ({
      ...order,
      tickets: order.tickets.map((ticket) => ({
        ...ticket,
        validated: ticket.status === "VALIDATED",
      })),
    }));

    return NextResponse.json({
      success: true,
      orders: ordersWithValidated,
    });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { success: false, message: "Error obteniendo órdenes" },
      { status: 500 },
    );
  }
}

// POST - Crear orden (ya existente)
export async function POST(req: Request) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cfg = await prisma.systemConfig.findFirst();
  if (!cfg || !cfg.salesEnabled) {
    return NextResponse.json(
      { error: "Ventas deshabilitadas" },
      { status: 403 },
    );
  }

  const sold = await prisma.ticket.count({
    where: { status: { in: ["PAID", "VALIDATED"] } },
  });

  const available = cfg.totalAvailable - sold;

  if (available <= 0)
    return NextResponse.json({ error: "Entradas agotadas" }, { status: 409 });

  if (parsed.data.quantity > Math.min(cfg.maxPerPurchase, available)) {
    return NextResponse.json(
      { error: "Cantidad supera el máximo o el stock disponible" },
      { status: 409 },
    );
  }

  const unitPrice = cfg.ticketPrice;
  const totalAmount = unitPrice.mul(parsed.data.quantity);

  // orderNumber simple y único (mejor: prefijo + fecha + random)
  const orderNumber = `CAR-${Date.now().toString(36).toUpperCase()}`;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      buyerName: parsed.data.buyerName,
      buyerEmail: parsed.data.buyerEmail,
      buyerPhone: parsed.data.buyerPhone,
      // ✅ buyerDNI se omite
      quantity: parsed.data.quantity,
      unitPrice,
      totalAmount,
      paymentStatus: "PENDING",
    },
  });

  return NextResponse.json({
    orderId: order.id,
    orderNumber: order.orderNumber,
  });
}
