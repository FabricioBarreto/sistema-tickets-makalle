import { MercadoPagoConfig, Preference, Payment } from "mercadopago";

type CreatePreferenceArgs = {
  orderId: string;
  orderNumber: string;
  buyerEmail: string;
  buyerName: string;
  quantity: number;
  unitPrice: number;
};

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BASE_URL ||
    "http://localhost:3000"
  );
}

export async function createPaymentPreference(args: CreatePreferenceArgs) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return {
        success: false,
        error: "MERCADOPAGO_ACCESS_TOKEN no configurado",
      };
    }

    const baseUrl = getBaseUrl();

    const client = new MercadoPagoConfig({ accessToken });
    const preference = new Preference(client);

    const body = {
      items: [
        {
          id: args.orderId,
          title: `Entradas - ${args.orderNumber}`,
          quantity: args.quantity,
          unit_price: args.unitPrice,
          currency_id: "ARS",
        },
      ],
      payer: {
        name: args.buyerName,
        email: args.buyerEmail,
      },
      external_reference: args.orderId,
      back_urls: {
        success: `${baseUrl}/checkout/success?orderId=${args.orderId}`,
        failure: `${baseUrl}/checkout/failure?orderId=${args.orderId}`,
        pending: `${baseUrl}/checkout/pending?orderId=${args.orderId}`,
      },
      notification_url: `${baseUrl}/api/mercadopago/webhook`,
    };

    const result = await preference.create({ body });

    return {
      success: true,
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || "Error Mercado Pago",
      details: {
        message: e?.message,
        error: e?.error,
        status: e?.status,
        cause: e?.cause,
      },
    };
  }
}

/**
 * Obtiene información de un pago desde MercadoPago
 */
export async function getPaymentStatus(paymentId: string | number) {
  try {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      return {
        success: false,
        error: "MERCADOPAGO_ACCESS_TOKEN no configurado",
      };
    }

    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    const result = await payment.get({ id: String(paymentId) });

    return {
      success: true,
      payment: {
        id: result.id,
        status: result.status,
        statusDetail: result.status_detail,
        externalReference: result.external_reference,
        transactionAmount: result.transaction_amount,
        dateApproved: result.date_approved,
        dateCreated: result.date_created,
        payer: {
          email: result.payer?.email,
          firstName: result.payer?.first_name,
          lastName: result.payer?.last_name,
        },
      },
    };
  } catch (error: any) {
    console.error("Error getting payment status:", error);
    return {
      success: false,
      error: error?.message || "Error al obtener información del pago",
    };
  }
}

/**
 * Mapea estados de MercadoPago a estados internos
 */
export function mapMPStatusToInternal(
  mpStatus: string | null | undefined,
): "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "REFUNDED" {
  switch (mpStatus) {
    case "approved":
      return "PAID";
    case "rejected":
    case "cancelled":
      return "CANCELLED";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    case "in_process":
    case "in_mediation":
    case "pending":
    default:
      return "PENDING_PAYMENT";
  }
}

/**
 * Mapea estados de MercadoPago a estados de orden (PaymentStatus)
 */
export function mapMPStatusToPaymentStatus(
  mpStatus: string | null | undefined,
): "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED" {
  switch (mpStatus) {
    case "approved":
      return "COMPLETED";
    case "rejected":
    case "cancelled":
      return "FAILED";
    case "refunded":
    case "charged_back":
      return "REFUNDED";
    case "in_process":
    case "in_mediation":
    case "pending":
    default:
      return "PENDING";
  }
}
