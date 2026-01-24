import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cfg = await prisma.systemConfig.findFirst();
    if (!cfg) {
      return NextResponse.json(
        { error: "SystemConfig no encontrado" },
        { status: 500 },
      );
    }

    // 1) Tickets emitidos (vendidos): PAID o VALIDATED
    const soldCount = await prisma.ticket.count({
      where: { status: { in: ["PAID", "VALIDATED"] } },
    });

    // 2) Tickets validados
    const validatedCount = await prisma.ticket.count({
      where: { status: "VALIDATED" },
    });

    // 3) Órdenes pagadas
    const paidOrders = await prisma.order.aggregate({
      where: { paymentStatus: "COMPLETED" },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const gross = Number(paidOrders._sum.totalAmount ?? 0);

    // Comisión estimada (inmediata): 6.49% + IVA 21% sobre comisión => ~7.8529%
    const feeRate = 0.0649 * 1.21; // 0.078529
    const fee = gross * feeRate;
    const net = gross - fee;

    const available = Math.max(cfg.totalAvailable - soldCount, 0);

    return NextResponse.json({
      success: true,
      data: {
        eventName: cfg.eventName,
        eventDate: cfg.eventDate,
        eventLocation: cfg.eventLocation,
        salesEnabled: cfg.salesEnabled,

        totalAvailable: cfg.totalAvailable,
        available,
        soldCount,
        validatedCount,

        ordersPaidCount: paidOrders._count.id,
        grossRevenue: gross,
        estimatedMpFee: fee,
        netRevenue: net,
      },
    });
  } catch (err) {
    console.error("Error fetching stats:", err);
    return NextResponse.json(
      { success: false, error: "Error al obtener stats" },
      { status: 500 },
    );
  }
}
