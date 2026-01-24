import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/orders/[orderId]">,
) {
  try {
    const { orderId } = await ctx.params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        unitPrice: Number(order.unitPrice),
        totalAmount: Number(order.totalAmount),
      },
    });
  } catch (error) {
    console.error("Error fetching order:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener la orden" },
      { status: 500 },
    );
  }
}
