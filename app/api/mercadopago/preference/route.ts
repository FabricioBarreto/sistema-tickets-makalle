import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeUrl(url: string) {
  // saca espacios y el "/" final para evitar "//checkout/..."
  return url.trim().replace(/\/$/, "");
}

function isLocalOrHttp(url: string) {
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.startsWith("http://")
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("🔍 MP Preference - Body recibido:", body);

    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId requerido" },
        { status: 400 },
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { tickets: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!mpAccessToken) {
      return NextResponse.json(
        { success: false, error: "MP no configurado" },
        { status: 500 },
      );
    }

    const config = await prisma.systemConfig.findFirst();

    // IMPORTANTE: en prod poné NEXT_PUBLIC_APP_URL con HTTPS
    const rawAppUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const appUrl = normalizeUrl(rawAppUrl);
    const localMode = isLocalOrHttp(appUrl);

    const back_urls = {
      success: `${appUrl}/checkout/success?orderId=${order.id}`,
      failure: `${appUrl}/checkout/failure?orderId=${order.id}`,
      pending: `${appUrl}/checkout/pending?orderId=${order.id}`,
    };

    interface PreferenceItem {
      title: string;
      description: string;
      quantity: number;
      unit_price: number;
      currency_id: string;
    }

    interface PreferencePayer {
      name: string;
      email: string;
      phone?: {
        area_code: string;
        number: string;
      };
      identification?: {
        type: string;
        number: string;
      };
    }

    interface PreferenceData {
      items: PreferenceItem[];
      payer: PreferencePayer;
      back_urls: {
        success: string;
        failure: string;
        pending: string;
      };
      external_reference: string;
      statement_descriptor: string;
      auto_return?: string;
      notification_url?: string;
    }

    // Base payer siempre
    const payer: PreferencePayer = {
      name: order.buyerName,
      email: order.buyerEmail,
    };

    // ✅ Solo agregamos phone si existe y tiene algo útil
    const phone = (order.buyerPhone ?? "").toString().trim();
    if (phone.length > 0) {
      payer.phone = {
        area_code: "",
        number: phone,
      };
    }

    // ✅ Solo agregamos DNI si existe
    const dni = (order.buyerDNI ?? "").toString().trim();
    if (dni.length > 0) {
      payer.identification = {
        type: "DNI",
        number: dni,
      };
    }

    const preferenceData: PreferenceData = {
      items: [
        {
          title: `${config?.eventName || "Entrada"} - Entrada General`,
          description: `${order.quantity} entrada(s)`,
          quantity: order.quantity,
          unit_price: Number(order.unitPrice),
          currency_id: "ARS",
        },
      ],
      payer,
      back_urls,
      external_reference: order.id,
      statement_descriptor: "CARNAVAL",
    };

    // ✅ Solo habilitamos esto cuando NO es localhost y es HTTPS accesible por MP
    if (!localMode) {
      preferenceData.auto_return = "approved";
      preferenceData.notification_url = `${appUrl}/api/mercadopago/webhook`;
    } else {
      console.log(
        "⚠️ Modo local detectado (http/localhost). Se omiten auto_return y notification_url para evitar 400.",
      );
    }

    console.log("🚀 Creando preferencia MP:", {
      orderId: order.id,
      appUrl,
      localMode,
      back_urls,
      auto_return: preferenceData.auto_return,
      notification_url: preferenceData.notification_url,
      hasPhone: !!payer.phone,
      hasDni: !!payer.identification,
    });

    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${mpAccessToken}`,
        },
        body: JSON.stringify(preferenceData),
      },
    );

    const mpData = await response.json();

    if (!response.ok) {
      console.error("❌ Error de MercadoPago:", mpData);
      throw new Error(mpData.message || "Error al crear preferencia");
    }

    console.log("✅ Preferencia MP creada:", mpData.id);

    await prisma.order.update({
      where: { id: order.id },
      data: { mercadoPagoId: mpData.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        preferenceId: mpData.id,
        initPoint: mpData.init_point,
        sandboxInitPoint: mpData.sandbox_init_point,
      },
    });
  } catch (error: unknown) {
    console.error("❌ Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
