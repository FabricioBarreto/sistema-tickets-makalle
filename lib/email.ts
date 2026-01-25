import { Resend } from "resend";
import { generateQRImage } from "./qr";
import { generateTicketsPdf } from "./pdf";

const resend = new Resend(process.env.RESEND_API_KEY);

interface Ticket {
  id: string;
  qrCode: string;
  order: {
    orderNumber: string;
    buyerName: string;
  };
}

interface SendTicketEmailData {
  to: string;
  orderNumber: string;
  buyerName: string;
  tickets: Ticket[];
  eventName: string;
  eventDate: string;
  eventLocation: string;
}

function getEmailHTML(data: SendTicketEmailData): string {
  return `
  <html>
    <body style="font-family:Arial;background:#f9fafb;padding:24px">
      <h2>🎭 ¡Tu compra fue exitosa!</h2>
      <p>Hola <strong>${data.buyerName}</strong>,</p>
      <p>
        Te adjuntamos tus entradas en <strong>PDF</strong> para ${data.eventName}.
        <br/>Tip: usá el PDF para ingresar (QR grande, 0 problemas).
      </p>
      <ul>
        <li><strong>Orden:</strong> ${data.orderNumber}</li>
        <li><strong>Entradas:</strong> ${data.tickets.length}</li>
        <li><strong>Evento:</strong> ${data.eventName}</li>
        <li><strong>Fecha:</strong> ${data.eventDate}</li>
        <li><strong>Lugar:</strong> ${data.eventLocation}</li>
      </ul>
      <p style="font-size:12px;color:#666;margin-top:20px">
        Si necesitás soporte: soporte@carnaval.com
      </p>
    </body>
  </html>
  `;
}

export async function sendTicketEmailWithQRs(
  data: SendTicketEmailData,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log("[tickets] sendTicketEmailWithQRs() start", {
      to: data.to,
      tickets: data.tickets.length,
      order: data.orderNumber,
    });

    if (!process.env.RESEND_API_KEY) {
      console.error("[tickets] Missing RESEND_API_KEY");
      return { success: false, error: "RESEND_API_KEY no configurada" };
    }

    // 1) Generar QRs (solo para armar el PDF)
    const qrDataUrls = await Promise.all(
      data.tickets.map((t) =>
        generateQRImage(t.qrCode, {
          width: 500,
          errorCorrectionLevel: "H",
          margin: 2,
        }),
      ),
    );

    // 2) Generar PDF
    const pdfBuffer = await generateTicketsPdf({
      eventName: data.eventName,
      eventDate: data.eventDate,
      eventLocation: data.eventLocation,
      orderNumber: data.orderNumber,
      buyerName: data.buyerName,
      tickets: data.tickets.map((t) => ({ qrCode: t.qrCode })),
      qrDataUrls,
    });

    // Logs de tamaño (IMPORTANTÍSIMO)
    const pdfBytes = pdfBuffer.byteLength;
    console.log(
      "[tickets] pdf size bytes:",
      pdfBytes,
      "≈",
      (pdfBytes / (1024 * 1024)).toFixed(2),
      "MB",
    );

    // Si querés ser más estricto:
    if (pdfBytes > 35 * 1024 * 1024) {
      console.error("[tickets] PDF too large, aborting");
      return {
        success: false,
        error: "El PDF es demasiado grande para enviarlo por email",
      };
    }

    // 3) HTML liviano
    const html = getEmailHTML(data);

    // 4) Enviar
    const { data: sent, error } = await resend.emails.send({
      from:
        process.env.EMAIL_FROM || "Carnavales Makallé <onboarding@resend.dev>",
      to: data.to,
      subject: `🎉 Tus entradas para ${data.eventName} – Orden ${data.orderNumber}`,
      html,
      replyTo: "soporte@carnaval.com",
      attachments: [
        {
          filename: `Entradas-${data.orderNumber}.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });

    if (error) {
      console.error("[tickets] Resend error:", error);
      return { success: false, error: error.message || "Resend error" };
    }

    console.log("[tickets] Email sent OK:", sent);
    return { success: true, messageId: sent?.id };
  } catch (err: unknown) {
    console.error("[tickets] Unexpected error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error enviando email" };
  }
}
