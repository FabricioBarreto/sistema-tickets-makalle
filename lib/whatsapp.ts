// lib/whatsapp.ts (VERSIÓN COMPLETA CON PDF)
import axios from "axios";
import FormData from "form-data";

const WA_API_URL = "https://graph.facebook.com/v22.0";
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const WA_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;

interface SendTemplateResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface SendTicketWhatsAppParams {
  to: string;
  buyerName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  orderNumber: string;
  ticketCount: number;
  downloadUrl: string;
}

interface SendTicketWhatsAppPDFParams {
  to: string;
  buyerName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  orderNumber: string;
  ticketCount: number;
  pdfBuffer: Buffer;
  caption?: string;
}

/**
 * Envía template con LINK de descarga del PDF
 *
 * Template en Meta:
 * Name: ticket_confirmation_link
 * Category: UTILITY
 * Language: es_AR
 */
export async function sendTicketWhatsAppWithLink(
  params: SendTicketWhatsAppParams,
): Promise<SendTemplateResponse> {
  try {
    console.log("[whatsapp] sendTicketWhatsAppWithLink()", {
      to: params.to,
      order: params.orderNumber,
      downloadUrl: params.downloadUrl,
    });

    const cleanPhone = params.to.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      return { success: false, error: "Número inválido" };
    }

    const url = `${WA_API_URL}/${WA_PHONE_ID}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "template",
      template: {
        name: "ticket_confirmation_link",
        language: {
          code: "es_AR",
        },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: params.buyerName },
              { type: "text", text: params.ticketCount.toString() },
              { type: "text", text: params.eventName },
              { type: "text", text: params.eventDate },
              { type: "text", text: params.eventLocation },
              { type: "text", text: params.orderNumber },
              { type: "text", text: params.downloadUrl },
            ],
          },
        ],
      },
    };

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log("[whatsapp] Message sent OK:", response.data.messages?.[0]?.id);

    return {
      success: true,
      messageId: response.data.messages?.[0]?.id,
    };
  } catch (err: unknown) {
    console.error("[whatsapp] Send error:", err);
    if (axios.isAxiosError(err)) {
      console.error("[whatsapp] Response:", err.response?.data);
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error enviando mensaje",
    };
  }
}

/**
 * Envía el PDF de tickets directamente por WhatsApp como documento
 *
 * Nota: El PDF debe ser menor a 100MB (límite de WhatsApp)
 * Se recomienda que sea menor a 16MB para mejor compatibilidad
 */
export async function sendTicketWhatsAppPDF(
  params: SendTicketWhatsAppPDFParams,
): Promise<SendTemplateResponse> {
  try {
    console.log("[whatsapp] sendTicketWhatsAppPDF()", {
      to: params.to,
      order: params.orderNumber,
      pdfSize: `${(params.pdfBuffer.byteLength / (1024 * 1024)).toFixed(2)} MB`,
    });

    const cleanPhone = params.to.replace(/[^0-9]/g, "");
    if (cleanPhone.length < 10) {
      return { success: false, error: "Número inválido" };
    }

    // Validar tamaño del PDF (límite de WhatsApp: 100MB, recomendado: <16MB)
    const pdfSizeMB = params.pdfBuffer.byteLength / (1024 * 1024);
    if (pdfSizeMB > 16) {
      console.warn(
        `[whatsapp] PDF size (${pdfSizeMB.toFixed(2)}MB) is large, may fail`,
      );
    }
    if (pdfSizeMB > 100) {
      return {
        success: false,
        error: `PDF demasiado grande (${pdfSizeMB.toFixed(2)}MB). Máximo: 100MB`,
      };
    }

    // Paso 1: Subir el PDF a WhatsApp Media API
    const uploadUrl = `${WA_API_URL}/${WA_PHONE_ID}/media`;

    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("file", params.pdfBuffer, {
      filename: `Entradas-${params.orderNumber}.pdf`,
      contentType: "application/pdf",
    });

    console.log("[whatsapp] Uploading PDF to WhatsApp...");

    const uploadResponse = await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${WA_TOKEN}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const mediaId = uploadResponse.data.id;
    console.log("[whatsapp] PDF uploaded, media ID:", mediaId);

    // Paso 2: Enviar el documento con el mediaId
    const messageUrl = `${WA_API_URL}/${WA_PHONE_ID}/messages`;

    const caption =
      params.caption ||
      `🎉 ¡Hola ${params.buyerName}!\n\n` +
        `Tus ${params.ticketCount} entrada(s) para ${params.eventName}\n\n` +
        `📅 ${params.eventDate}\n` +
        `📍 ${params.eventLocation}\n` +
        `🎫 Orden: ${params.orderNumber}\n\n` +
        `Presentá este PDF en la entrada. ¡Nos vemos! 🎭`;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "document",
      document: {
        id: mediaId,
        caption: caption.substring(0, 1024), // WhatsApp limita caption a 1024 chars
        filename: `Entradas-${params.orderNumber}.pdf`,
      },
    };

    console.log("[whatsapp] Sending document message...");

    const messageResponse = await axios.post(messageUrl, payload, {
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    console.log(
      "[whatsapp] Document sent OK:",
      messageResponse.data.messages?.[0]?.id,
    );

    return {
      success: true,
      messageId: messageResponse.data.messages?.[0]?.id,
    };
  } catch (err: unknown) {
    console.error("[whatsapp] Send PDF error:", err);
    if (axios.isAxiosError(err)) {
      console.error("[whatsapp] Response:", err.response?.data);
      return {
        success: false,
        error: err.response?.data?.error?.message || err.message,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error enviando PDF",
    };
  }
}
