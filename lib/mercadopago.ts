// lib/mercadopago.ts
import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

interface CreatePreferenceParams {
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

export async function createPreference(params: CreatePreferenceParams) {
  const preference = new Preference(client);

  const body = {
    items: [
      {
        id: params.orderId,
        title: `Entrada Carnaval Makallé - Orden ${params.orderNumber}`,
        description: `${params.quantity} entrada(s) para Carnavales Makallé`,
        quantity: params.quantity,
        unit_price: params.unitPrice,
        currency_id: "ARS",
      },
    ],
    payer: {
      name: params.buyerName,
      email: params.buyerEmail,
      ...(params.buyerPhone && {
        phone: {
          number: params.buyerPhone,
        },
      }),
      ...(params.buyerDni && {
        identification: {
          type: "DNI",
          number: params.buyerDni,
        },
      }),
    },
    back_urls: {
      success: params.successUrl,
      failure: params.failureUrl,
      pending: params.pendingUrl,
    },
    notification_url: params.notificationUrl,
    external_reference: params.orderId,
    statement_descriptor: "CARNAVAL MAKALLE",
  };

  return await preference.create({ body });
}

type GetPaymentStatusResult =
  | { success: true; payment: unknown }
  | { success: false; error: string };

/**
 * Obtiene el pago desde MercadoPago.
 * Nota: devolvemos `unknown` para evitar `any` y porque el SDK puede cambiar el shape.
 * Si después querés, lo tipamos bien con un interface.
 */
export async function getPaymentStatus(
  paymentId: string,
): Promise<GetPaymentStatusResult> {
  try {
    const payment = new Payment(client);
    const result = await payment.get({ id: paymentId });
    return { success: true, payment: result as unknown };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching payment:", error);
    return { success: false, error: errorMessage };
  }
}

export function mapMPStatusToInternal(
  mpStatus: string,
): "PENDING" | "VALID" | "USED" | "CANCELLED" {
  switch (mpStatus) {
    case "approved":
      return "VALID";
    case "pending":
    case "in_process":
      return "PENDING";
    case "rejected":
    case "cancelled":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

export function mapMPStatusToPaymentStatus(
  mpStatus: string,
): "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" {
  switch (mpStatus) {
    case "approved":
      return "COMPLETED";
    case "pending":
    case "in_process":
      return "PENDING";
    case "rejected":
    case "cancelled":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}
