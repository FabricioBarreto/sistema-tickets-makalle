// src/lib/qr.ts

import QRCode from "qrcode";
import crypto from "crypto";

/**
 * Genera un hash seguro para el código QR
 */
export function generateSecureHash(ticketId: string): string {
  const salt = process.env.QR_SALT || "carnaval-2026-secret-salt";
  const hash = crypto
    .createHash("sha256")
    .update(`${ticketId}-${salt}`)
    .digest("hex");
  return hash.substring(0, 32).toUpperCase();
}

/**
 * Genera un código QR alfanumérico único
 */
export function generateQRCodeString(ticketId: string): string {
  const hash = generateSecureHash(ticketId);
  const timestamp = Date.now().toString(36).toUpperCase();
  return `CV25-${hash.substring(0, 12)}-${timestamp}`;
}

/**
 * Verifica si un código QR es válido
 */
export function validateQRCode(qrCode: string): boolean {
  // Formato: CV25-XXXXXXXXXXXX-XXXXXXXX
  const pattern = /^CV25-[A-Z0-9]{12}-[A-Z0-9]+$/;
  return pattern.test(qrCode);
}

export interface QRCodeOptions {
  width?: number;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Genera una imagen QR en formato Data URL (base64)
 */
export async function generateQRImage(
  data: string,
  options: QRCodeOptions = {},
): Promise<string> {
  const defaultOptions: QRCodeOptions = {
    width: 500,
    errorCorrectionLevel: "H", // Alta corrección de errores
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
    ...options,
  };

  try {
    const dataUrl = await QRCode.toDataURL(data, defaultOptions);
    return dataUrl;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Failed to generate QR code");
  }
}

/**
 * Genera una imagen QR con información del ticket
 * Incluye el código QR y datos visuales
 */
export async function generateTicketQR(ticketData: {
  qrCode: string;
  orderNumber: string;
  buyerName: string;
  eventName?: string;
}): Promise<string> {
  // Genera el QR code básico
  const qrDataUrl = await generateQRImage(ticketData.qrCode, {
    width: 400,
    errorCorrectionLevel: "H",
  });

  // Retorna el data URL del QR
  // En una implementación más completa, podrías usar Canvas
  // para agregar el logo y texto adicional
  return qrDataUrl;
}

/**
 * Convierte un Data URL a Buffer (para enviar por email o guardar)
 */
export function dataURLtoBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(base64Data, "base64");
}

/**
 * Genera múltiples QR codes para una orden con varias entradas
 */
export async function generateMultipleQRs(
  tickets: Array<{
    id: string;
    qrCode: string;
    orderNumber: string;
    buyerName: string;
  }>,
): Promise<Array<{ ticketId: string; qrImage: string }>> {
  const results = await Promise.all(
    tickets.map(async (ticket) => {
      const qrImage = await generateTicketQR({
        qrCode: ticket.qrCode,
        orderNumber: ticket.orderNumber,
        buyerName: ticket.buyerName,
        eventName: "Carnavales 2026",
      });

      return {
        ticketId: ticket.id,
        qrImage,
      };
    }),
  );

  return results;
}
