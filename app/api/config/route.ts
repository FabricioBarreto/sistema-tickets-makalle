import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const cfg = await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (!cfg) {
      return NextResponse.json(
        { success: false, error: "No hay configuración cargada" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ticketPrice: Number(cfg.ticketPrice),
        totalAvailable: cfg.totalAvailable,
        maxPerPurchase: cfg.maxPerPurchase,
        salesEnabled: cfg.salesEnabled,
        eventDate: cfg.eventDate.toISOString(),
        eventName: cfg.eventName,
        eventLocation: cfg.eventLocation ?? "",
      },
    });
  } catch (error: unknown) {
    console.error("Error /api/config:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Error interno";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
