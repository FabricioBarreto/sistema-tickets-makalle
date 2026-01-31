// lib/whatsapp-twilio.ts
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER!;
const contentSid = process.env.TWILIO_CONTENT_SID!;

const client = twilio(accountSid, authToken);

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

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendTicketWhatsAppTwilio(
  params: SendTicketWhatsAppParams,
): Promise<SendResult> {
  try {
    console.log("[twilio] Sending WhatsApp with approved template", {
      to: params.to,
      order: params.orderNumber,
      contentSid,
    });

    const cleanPhone = params.to.replace(/[^0-9+]/g, "");
    if (!cleanPhone.startsWith("+")) {
      return {
        success: false,
        error: "El número debe incluir código de país con +",
      };
    }

    // Enviar usando template aprobado
    const message = await client.messages.create({
      from: twilioWhatsAppNumber,
      to: `whatsapp:${cleanPhone}`,
      contentSid: contentSid,
      contentVariables: JSON.stringify({
        "1": params.buyerName, // {{1}} - Nombre
        "2": params.ticketCount.toString(), // {{2}} - Cantidad
        "3": params.eventName, // {{3}} - Evento
        "4": params.eventDate, // {{4}} - Fecha
        "5": params.eventLocation, // {{5}} - Lugar
        "6": params.orderNumber, // {{6}} - Orden
        "7": params.downloadUrl, // {{7}} - Link
      }),
    });

    console.log("[twilio] Message sent successfully:", message.sid);

    return {
      success: true,
      messageId: message.sid,
    };
  } catch (error: any) {
    console.error("[twilio] Error sending message:", error);
    return {
      success: false,
      error: error.message || "Error desconocido",
    };
  }
}
