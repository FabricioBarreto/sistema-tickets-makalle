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
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

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

    // ⭐ SOLUCIÓN: Convertir Buffer a Uint8Array para Next.js 15.5+
    // Esto resuelve el error de tipo BodyInit
    const uint8Array = new Uint8Array(pdfBuffer);

    // Retornar PDF como descarga
    return new Response(uint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Entradas-${order.orderNumber}.pdf"`,
        "Cache-Control": "private, max-age=3600", // Cache 1 hora
        "X-Order-Number": order.orderNumber,
        "X-Ticket-Count": order.tickets.length.toString(),
      },
    });
  } catch {
    console.error("[download] Error generando PDF");
    return NextResponse.json(
      {
        error: "Error generando PDF",
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
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

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
      return new Response(null, { status: 404 });
    }

    return new Response(null, {
      status: 200,
      headers: {
        "X-Order-Number": order.orderNumber,
        "X-Ticket-Count": order.tickets.length.toString(),
      },
    });
  } catch {
    return new Response(null, { status: 500 });
  }
}
