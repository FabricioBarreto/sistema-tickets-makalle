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

/**
 * Crea un checkout en Unicobros
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

  // Body según documentación oficial de Unicobros
  const body = {
    total: params.totalAmount, // Número directo
    description: `🎭 Carnavales Makallé 2026 - ${params.quantity} Entrada(s) - Orden ${params.orderNumber}`,
    reference: params.orderId,
    currency: "ARS",
    test: process.env.NODE_ENV !== "production",
    return_url: params.successUrl,
    webhook: params.notificationUrl,
    customer: {
      email: params.buyerEmail,
      name: params.buyerName,
      identification: params.buyerDni || "00000000",
      ...(params.buyerPhone && { phone: params.buyerPhone }),
    },
  };

  console.log("🚀 Creando checkout en Unicobros:", {
    orderId: params.orderId,
    amount: params.totalAmount,
    email: params.buyerEmail,
    test: body.test,
  });

  // Endpoint oficial
  const endpoint = `${baseUrl}/p/checkout`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "x-access-token": accessToken,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Error de Unicobros:", {
        status: response.status,
        body: errorText,
      });
      throw new Error(`Error de Unicobros (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    console.log("✅ Checkout creado:", {
      id: data.data?.id,
      url: data.data?.url,
    });

    return {
      id: data.data.id,
      init_point: data.data.url,
      external_reference: params.orderId,
    };
  } catch (error) {
    console.error("❌ Error creando checkout:", error);
    throw error;
  }
}

/**
 * Obtiene el estado de un pago
 */
export async function getPaymentStatus(
  paymentId: string,
): Promise<{ success: boolean; payment?: any; error?: string }> {
  const apiKey = process.env.UNICOBROS_API_KEY;
  const accessToken = process.env.UNICOBROS_ACCESS_TOKEN;
  const baseUrl =
    process.env.UNICOBROS_BASE_URL || "https://api.unicobros.com.ar";

  if (!apiKey || !accessToken) {
    return {
      success: false,
      error: "Credenciales no configuradas",
    };
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

    if (!response.ok) {
      return { success: false, error: `Error ${response.status}` };
    }

    const data = await response.json();
    return { success: true, payment: data.data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/**
 * Mapea estados de Unicobros (números) a estados internos
 */
export function mapMPStatusToInternal(
  status: number | string,
): "PENDING_PAYMENT" | "PAID" | "VALIDATED" | "CANCELLED" {
  const statusNum = typeof status === "string" ? parseInt(status) : status;

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

/**
 * Mapea estados de Unicobros a estados de pago
 */
export function mapMPStatusToPaymentStatus(
  status: number | string,
): "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" {
  const statusNum = typeof status === "string" ? parseInt(status) : status;

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
 * Verifica webhook (básico)
 */
export function verifyWebhookSignature(
  payload: unknown,
  signature?: string,
): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as Record<string, unknown>;
  return !!data.payment;
}
