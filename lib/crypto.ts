import crypto from "crypto";

const SALT = process.env.QR_SALT || "carnaval-secret-salt-2026";

/**
 * Genera un hash único para el QR del ticket
 */
export async function generateQRHash(
  orderId: string,
  ticketIndex: number,
): Promise<string> {
  const data = `${orderId}-${ticketIndex}-${Date.now()}`;
  const hash = crypto.createHmac("sha256", SALT).update(data).digest("hex");

  return hash.substring(0, 32).toUpperCase();
}

/**
 * Genera un código legible para el ticket (para ingreso manual)
 */
export function generateReadableCode(
  orderNumber: string,
  index: number,
): string {
  // Extraer parte del orderNumber
  const parts = orderNumber.split("-");
  const timestamp = parts[1]
    ? parts[1].substring(0, 6)
    : Date.now().toString(36).substring(0, 6);
  const random = parts[2] || Math.random().toString(36).substring(2, 6);

  return `${timestamp}-${random}-${(index + 1).toString().padStart(2, "0")}`.toUpperCase();
}

/**
 * Verifica la integridad de un código QR
 */
export function verifyQRCode(qrCode: string): boolean {
  // Verificar formato básico
  if (!qrCode || qrCode.length !== 32) {
    return false;
  }

  // Verificar que solo contenga caracteres hexadecimales
  return /^[0-9A-F]+$/.test(qrCode);
}
