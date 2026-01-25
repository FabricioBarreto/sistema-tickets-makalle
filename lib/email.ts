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

/**
 * Genera el HTML del email (preview + fallback visual)
 */
function getEmailHTML(data: SendTicketEmailData, qrDataUrls: string[]): string {
  const ticketCards = qrDataUrls
    .map(
      (qr, i) => `
      <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:16px">
        <div style="text-align:center;margin-bottom:12px">
          <strong>Entrada ${i + 1} de ${data.tickets.length}</strong>
        </div>
        <div style="text-align:center">
          <img src="${qr}" style="max-width:260px;width:100%" />
        </div>
        <p style="font-family:monospace;font-size:12px;text-align:center;margin-top:8px">
          ${data.tickets[i].qrCode}
        </p>
      </div>
    `,
    )
    .join("");

  return `
  <html>
    <body style="font-family:Arial;background:#f9fafb;padding:24px">
      <h2>🎭 ¡Tu compra fue exitosa!</h2>
      <p>Hola <strong>${data.buyerName}</strong>,</p>
      <p>
        Adjuntamos tus <strong>entradas en PDF</strong> para ${data.eventName}.  
        También te dejamos una vista previa abajo.
      </p>

      <ul>
        <li><strong>Orden:</strong> ${data.orderNumber}</li>
        <li><strong>Evento:</strong> ${data.eventName}</li>
        <li><strong>Fecha:</strong> ${data.eventDate}</li>
        <li><strong>Lugar:</strong> ${data.eventLocation}</li>
      </ul>

      <h3>🎟️ Vista previa</h3>
      ${ticketCards}

      <p style="margin-top:24px;font-size:12px;color:#666">
        Consejo: usá el PDF adjunto para ingresar al evento (QR más grande, cero problemas).
      </p>
    </body>
  </html>
  `;
}

/**
 * Envía el email con QRs + PDF adjunto
 */
export async function sendTicketEmailWithQRs(
  data: SendTicketEmailData,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      return { success: false, error: "RESEND_API_KEY no configurada" };
    }

    // 1️⃣ Generar QRs
    const qrDataUrls = await Promise.all(
      data.tickets.map((t) =>
        generateQRImage(t.qrCode, {
          width: 500,
          errorCorrectionLevel: "H",
          margin: 2,
        }),
      ),
    );

    // 2️⃣ Generar PDF (1 entrada por página)
    const pdfBuffer = await generateTicketsPdf({
      eventName: data.eventName,
      eventDate: data.eventDate,
      eventLocation: data.eventLocation,
      orderNumber: data.orderNumber,
      buyerName: data.buyerName,
      tickets: data.tickets.map((t) => ({ qrCode: t.qrCode })),
      qrDataUrls,
    });

    // 3️⃣ HTML del mail
    const html = getEmailHTML(data, qrDataUrls);

    // 4️⃣ Enviar
    const result = await resend.emails.send({
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

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Error enviando email";
    return { success: false, error: errorMessage };
  }
}
