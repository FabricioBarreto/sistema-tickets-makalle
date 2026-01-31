// src/app/api/tickets/download/[token]/route.ts
/**
 * Endpoint para descarga segura de tickets
 * El PDF se genera DINÁMICAMENTE cada vez que se solicita (no se almacena)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQRImage } from "@/lib/qr";
import { generateTicketsPdf } from "@/lib/pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;

    console.log(`[download] Token received: ${token}`);

    // Validar formato del token
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    // Buscar orden por token
    const order = await prisma.order.findFirst({
      where: {
        downloadToken: token,
        paymentStatus: "COMPLETED", // Solo órdenes pagas
      },
      include: {
        tickets: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Orden no encontrada o pago pendiente" },
        { status: 404 },
      );
    }

    console.log(`[download] Order found: ${order.orderNumber}`);
    console.log(`[download] Tickets: ${order.tickets.length}`);

    // Obtener configuración del evento
    const config = await prisma.systemConfig.findFirst();

    const eventName = config?.eventName || "Carnavales Makallé 2026";
    const eventDate =
      config?.eventDate?.toLocaleDateString("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) || "Febrero 2026";
    const eventLocation = config?.eventLocation || "Makallé, Chaco";

    // Generar QRs dinámicamente
    console.log("[download] Generating QR codes...");
    const qrDataUrls = await Promise.all(
      order.tickets.map((t) =>
        generateQRImage(t.qrHash, {
          width: 500,
          errorCorrectionLevel: "H",
          margin: 2,
        }),
      ),
    );

    // Generar PDF dinámicamente
    console.log("[download] Generating PDF...");
    const pdfBuffer = await generateTicketsPdf({
      eventName,
      eventDate,
      eventLocation,
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      tickets: order.tickets.map((t) => ({ qrCode: t.qrHash })),
      qrDataUrls,
    });

    const pdfSize = (pdfBuffer.byteLength / 1024).toFixed(2);
    console.log(`[download] PDF generated: ${pdfSize} KB`);

    // Retornar PDF como descarga
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Entradas-${order.orderNumber}.pdf"`,
        "Cache-Control": "private, max-age=3600", // Cache 1 hora
        "X-Order-Number": order.orderNumber,
        "X-Ticket-Count": order.tickets.length.toString(),
      },
    });
  } catch (error) {
    console.error("[download] Error:", error);
    return NextResponse.json(
      {
        error: "Error generando PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * HEAD - Para verificar si el token es válido sin descargar el PDF
 */
export async function HEAD(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const { token } = params;

    const order = await prisma.order.findFirst({
      where: {
        downloadToken: token,
        paymentStatus: "COMPLETED",
      },
      select: {
        orderNumber: true,
        tickets: { select: { id: true } },
      },
    });

    if (!order) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        "X-Order-Number": order.orderNumber,
        "X-Ticket-Count": order.tickets.length.toString(),
      },
    });
  } catch (error) {
    return new NextResponse(null, { status: 500 });
  }
}
