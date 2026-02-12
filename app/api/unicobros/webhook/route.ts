// app/api/unicobros/webhook/route.ts
/**
 * Webhook de Unicobros - tolerante a formatos de payload
 *
 * - Acepta payment en body.data.payment o body.payment
 * - Extrae orderId de external_reference, reference o metadata.orderId
 * - Guarda siempre paymentId + status en la orden
 * - Confirma SOLO si status=200
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { confirmPayment } from "@/lib/payment-confirm";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getPaymentFromPayload(raw: unknown): JsonRecord | undefined {
  if (!isRecord(raw)) return undefined;

  // Caso 1: { data: { payment: {...} } }
  const data = isRecord(raw.data) ? (raw.data as JsonRecord) : undefined;
  const paymentInData =
    data && isRecord(data.payment) ? (data.payment as JsonRecord) : undefined;
  if (paymentInData) return paymentInData;

  // Caso 2: { payment: {...} }
  const paymentTop = isRecord(raw.payment)
    ? (raw.payment as JsonRecord)
    : undefined;
  if (paymentTop) return paymentTop;

  return undefined;
}

function getOrderIdFromPayment(payment: JsonRecord): string {
  const ext = payment.external_reference;
  if (typeof ext === "string" && ext.trim()) return ext;

  const ref = payment.reference;
  if (typeof ref === "string" && ref.trim()) return ref;

  const meta = payment.metadata;
  if (isRecord(meta)) {
    const oid = meta.orderId;
    if (typeof oid === "string" && oid.trim()) return oid;
  }

  return "";
}

function parseStatusNum(payment: JsonRecord): number {
  const status = payment.status;

  const statusRaw =
    (isRecord(status) && "code" in status ? (status.code as unknown) : null) ??
    status ??
    payment.status_code ??
    payment.code ??
    "0";

  const n = parseInt(String(statusRaw), 10);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody: unknown = await request.json();

    const payment = getPaymentFromPayload(rawBody);
    if (!payment) {
      console.log("[webhook] ⏭️ Sin payment en payload");
      return new NextResponse(null, { status: 200 });
    }

    if (!("id" in payment) || !payment.id) {
      console.log("[webhook] ⏭️ Sin payment.id");
      return new NextResponse(null, { status: 200 });
    }

    console.log("[webhook] 🧾 Payment:", JSON.stringify(payment, null, 2));

    const paymentId = String(payment.id);
    const orderId = getOrderIdFromPayment(payment);

    if (!orderId) {
      console.log(
        "[webhook] ⏭️ Sin external_reference/reference/metadata.orderId",
      );
      return new NextResponse(null, { status: 200 });
    }

    const statusNum = parseStatusNum(payment);

    // ✅ Guardar SIEMPRE paymentId + status (aunque no sea 200)
    try {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          mercadoPagoId: paymentId,
          mercadoPagoStatus: String(statusNum),
        },
      });
    } catch (e) {
      console.log(
        "[webhook] ⚠️ No se pudo actualizar orden (quizá no existe):",
        e,
      );
    }

    if (statusNum !== 200) {
      console.log(`[webhook] ⏭️ Status no aprobado: ${statusNum}`);
      return new NextResponse(null, { status: 200 });
    }

    const result = await confirmPayment({
      orderId,
      paymentId,
      statusNum,
      source: "webhook",
    });

    if (!result.success) {
      console.error(`[webhook] ❌ Error confirmando: ${result.error}`);
      return new NextResponse(null, { status: 200 });
    }

    return NextResponse.json({
      received: true,
      processed: !result.alreadyProcessed,
      orderId,
      orderNumber: result.orderNumber,
      emailSent: result.emailSent,
      whatsappSent: result.whatsappSent,
    });
  } catch (error: unknown) {
    console.error("[webhook] ❌ Error:", error);
    return new NextResponse(null, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    message: "Unicobros webhook endpoint (v7 - tolerant payload)",
    version: "7.0",
    timestamp: new Date().toISOString(),
  });
}
