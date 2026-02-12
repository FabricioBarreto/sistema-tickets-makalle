// lib/unicobros.ts
/**
 * Cliente de Unicobros basado en documentación oficial
 * https://ayuda.unicobros.com.ar/IrPd3Rjz0_qkzVFQXEO2F
 */

interface CreateCheckoutParams {
  orderId: string;
  orderNumber: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  buyerEmail: string;
  buyerName: string;
  buyerPhone?: string;
  buyerDni?: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  notificationUrl: string;
}

export interface UnicobrosPayment {
  id: string | number;
  status?: number | string | { code?: number | string };
  status_code?: number | string;
  code?: number | string;
  reference?: string;
  external_reference?: string;
  total?: number;
  currency?: string;
  created?: number;
  // otros campos pueden existir
}

type JsonRecord = Record<string, unknown>;
function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function hasId(v: unknown): v is { id: string | number } {
  return (
    isRecord(v) &&
    "id" in v &&
    (typeof v.id === "string" || typeof v.id === "number")
  );
}

/**
 * Crea un checkout en Unicobros
 * (Formato tipo Mobbex: total/currency/reference/description/items(total)/return_url/webhook)
 */
export async function createPreference(
  params: CreateCheckoutParams,
): Promise<{ id: string; init_point: string; external_reference: string }> {
  const apiKey = process.env.UNICOBROS_API_KEY;
  const accessToken = process.env.UNICOBROS_ACCESS_TOKEN;
  const baseUrl =
    process.env.UNICOBROS_BASE_URL || "https://api.unicobros.com.ar";

  if (!apiKey || !accessToken) {
    throw new Error(
      "UNICOBROS_API_KEY o UNICOBROS_ACCESS_TOKEN no están configurados",
    );
  }

  const total = params.totalAmount;

  const checkout: Record<string, unknown> = {
    total,
    currency: "ARS",
    reference: params.orderId,
    description: `Orden ${params.orderNumber} - ${params.quantity} entrada(s)`,
    items: [
      {
        quantity: params.quantity,
        description: "Entrada Carnavales Makallé 2026",
        total,
      },
    ],
    return_url: params.successUrl,
    webhook: params.notificationUrl,
  };

  console.log("🚀 Creando checkout en Unicobros (payload real):", checkout);

  const endpoint = `${baseUrl}/p/checkout`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-access-token": accessToken,
    },
    body: JSON.stringify(checkout),
  });

  const contentType = response.headers.get("content-type") || "";
  const raw = await response.text();

  console.log("UNICOBROS status:", response.status);
  console.log("UNICOBROS content-type:", contentType);
  console.log("UNICOBROS raw body:", raw);

  if (!response.ok) {
    throw new Error(`Error de Unicobros (${response.status}): ${raw}`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`Unicobros devolvió no-JSON: ${raw}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Unicobros devolvió JSON inválido: ${raw}`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Respuesta inesperada de Unicobros: ${raw}`);
  }

  // 200 con result=false
  if (parsed.result === false) {
    const code = typeof parsed.code === "string" ? parsed.code : "UNKNOWN";
    const err = typeof parsed.error === "string" ? parsed.error : "Error";
    throw new Error(`Unicobros ${code}: ${err}`);
  }

  const obj = isRecord(parsed.data) ? (parsed.data as JsonRecord) : parsed;

  const id =
    (obj.id as string | number | undefined) ??
    (obj.checkout_id as string | number | undefined);

  const url =
    (obj.url as string | undefined) ??
    (obj.init_point as string | undefined) ??
    (obj.checkout_url as string | undefined) ??
    (obj.payment_url as string | undefined) ??
    (obj.redirect_url as string | undefined);

  if (!id || !url) {
    throw new Error(
      `Unicobros: respuesta sin id/url. Keys: ${Object.keys(obj).join(", ")} | raw: ${raw.slice(0, 800)}`,
    );
  }

  return {
    id: String(id),
    init_point: String(url),
    external_reference: params.orderId,
  };
}

/**
 * Obtiene estado de pago (para cron)
 */
export async function getPaymentStatus(
  paymentId: string,
): Promise<{ success: boolean; payment?: UnicobrosPayment; error?: string }> {
  const apiKey = process.env.UNICOBROS_API_KEY;
  const accessToken = process.env.UNICOBROS_ACCESS_TOKEN;
  const baseUrl =
    process.env.UNICOBROS_BASE_URL || "https://api.unicobros.com.ar";

  if (!apiKey || !accessToken) {
    return { success: false, error: "Credenciales no configuradas" };
  }

  const endpoint = `${baseUrl}/p/operations/${paymentId}`;

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-access-token": accessToken,
      },
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();

    if (!response.ok) {
      return {
        success: false,
        error: `Error ${response.status}${raw ? `: ${raw}` : ""}`,
      };
    }

    if (!contentType.includes("application/json")) {
      return { success: false, error: `Respuesta no-JSON: ${raw}` };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { success: false, error: `JSON inválido: ${raw}` };
    }

    if (!isRecord(parsed)) {
      return { success: false, error: "Respuesta inválida" };
    }

    if (parsed.result === false) {
      const code = typeof parsed.code === "string" ? parsed.code : "UNKNOWN";
      const err = typeof parsed.error === "string" ? parsed.error : "Error";
      return { success: false, error: `Unicobros ${code}: ${err}` };
    }

    const dataUnknown: unknown = parsed.data;

    if (!hasId(dataUnknown)) {
      return { success: false, error: "Respuesta inválida: falta data.id" };
    }

    return { success: true, payment: dataUnknown as UnicobrosPayment };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Mapeos (los usa payment-confirm.ts)
 */
export function mapMPStatusToInternal(
  status: number | string,
): "PENDING_PAYMENT" | "PAID" | "VALIDATED" | "CANCELLED" {
  const statusNum = typeof status === "string" ? parseInt(status, 10) : status;

  switch (statusNum) {
    case 200:
      return "PAID";
    case 4:
    case 2:
      return "PENDING_PAYMENT";
    case 0:
    case 401:
    case 3:
      return "CANCELLED";
    default:
      console.warn(`⚠️ Estado desconocido: ${status}`);
      return "PENDING_PAYMENT";
  }
}

export function mapMPStatusToPaymentStatus(
  status: number | string,
): "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" {
  const statusNum = typeof status === "string" ? parseInt(status, 10) : status;

  switch (statusNum) {
    case 200:
      return "COMPLETED";
    case 4:
    case 2:
      return "PENDING";
    case 0:
    case 401:
    case 3:
      return "FAILED";
    case 603:
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

/**
 * Verifica webhook (placeholder)
 */
export function verifyWebhookSignature(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as Record<string, unknown>;
  return !!data.payment;
}
