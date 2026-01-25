// src/lib/pdf.ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Uint8Array.from(Buffer.from(base64, "base64"));
}

/**
 * pdf-lib con StandardFonts usa WinAnsi => no soporta emojis ni muchos Unicode.
 * Esto limpia cualquier caracter fuera de Latin-1 (0x00-0xFF).
 */
function safeText(text: string): string {
  return (text ?? "").replace(/[^\x00-\xFF]/g, "");
}

export async function generateTicketsPdf(params: {
  eventName: string;
  eventDate: string;
  eventLocation: string;
  orderNumber: string;
  buyerName: string;
  tickets: Array<{ qrCode: string }>;
  qrDataUrls: string[];
}): Promise<Buffer> {
  const {
    eventName,
    eventDate,
    eventLocation,
    orderNumber,
    buyerName,
    tickets,
    qrDataUrls,
  } = params;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  // A4 en puntos
  const pageW = 595.28;
  const pageH = 841.89;

  for (let i = 0; i < tickets.length; i++) {
    const page = pdfDoc.addPage([pageW, pageH]);

    const margin = 48;
    const top = pageH - margin;

    // Header (sin emoji para evitar quilombo)
    page.drawText(safeText("Tus Entradas"), {
      x: margin,
      y: top,
      size: 22,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(safeText(eventName), {
      x: margin,
      y: top - 30,
      size: 16,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });

    page.drawText(
      safeText(`Orden: ${orderNumber}  |  Comprador: ${buyerName}`),
      {
        x: margin,
        y: top - 52,
        size: 11,
        font,
        color: rgb(0.25, 0.25, 0.25),
      },
    );

    page.drawText(safeText(`Fecha: ${eventDate}`), {
      x: margin,
      y: top - 70,
      size: 11,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });

    page.drawText(safeText(`Lugar: ${eventLocation}`), {
      x: margin,
      y: top - 86,
      size: 11,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });

    // Badge entrada
    page.drawText(safeText(`ENTRADA #${i + 1} de ${tickets.length}`), {
      x: margin,
      y: top - 120,
      size: 12,
      font,
      color: rgb(0.55, 0.1, 0.45),
    });

    // QR grande y centrado
    const qrBytes = dataUrlToUint8Array(qrDataUrls[i]);
    const qrImage = await pdfDoc.embedPng(qrBytes);

    const qrSize = 340;
    const qrX = (pageW - qrSize) / 2;
    const qrY = (pageH - qrSize) / 2 - 20;

    // marco suave
    page.drawRectangle({
      x: qrX - 14,
      y: qrY - 14,
      width: qrSize + 28,
      height: qrSize + 28,
      color: rgb(0.97, 0.97, 0.98),
      borderColor: rgb(0.9, 0.9, 0.92),
      borderWidth: 1,
    });

    page.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    });

    // Código de verificación abajo (mono)
    page.drawText(safeText("CODIGO DE VERIFICACION"), {
      x: margin,
      y: qrY - 40,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.48),
    });

    const code = tickets[i].qrCode;
    page.drawText(safeText(code), {
      x: margin,
      y: qrY - 58,
      size: 10,
      font: mono,
      color: rgb(0.2, 0.2, 0.22),
      maxWidth: pageW - margin * 2,
    });

    // mini footer
    page.drawText(
      safeText("Mostra este QR en el ingreso. Cada entrada se usa una sola vez."),
      {
        x: margin,
        y: 40,
        size: 9,
        font,
        color: rgb(0.35, 0.35, 0.37),
      },
    );
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
