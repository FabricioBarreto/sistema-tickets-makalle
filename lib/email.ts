// lib/email.ts
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
  downloadUrl?: string; // 👈 LINK DE DESCARGA
}

function getEmailHTML(data: SendTicketEmailData): string {
  return `
  <html>
    <body style="font-family:Arial;background:#f9fafb;padding:24px">
      <h2 style="color:#8b5cf6">🎭 ¡Tu compra fue exitosa!</h2>
      <p>Hola <strong>${data.buyerName}</strong>,</p>
      <p>
        Te adjuntamos tus entradas en <strong>PDF</strong> para ${data.eventName}.
        <br/>Presentá el PDF en la entrada (QR grande, escaneo rápido).
      </p>
      <div style="background:#fff;padding:20px;border-radius:8px;margin:20px 0;border:1px solid #e5e7eb">
        <ul style="list-style:none;padding:0;margin:0">
          <li style="margin:8px 0"><strong>🎫 Orden:</strong> ${data.orderNumber}</li>
          <li style="margin:8px 0"><strong>📝 Entradas:</strong> ${data.tickets.length}</li>
          <li style="margin:8px 0"><strong>🎉 Evento:</strong> ${data.eventName}</li>
          <li style="margin:8px 0"><strong>📅 Fecha:</strong> ${data.eventDate}</li>
          <li style="margin:8px 0"><strong>📍 Lugar:</strong> ${data.eventLocation}</li>
        </ul>
      </div>
      ${
        data.downloadUrl
          ? `
      <div style="background:#fef3c7;padding:15px;border-radius:8px;margin:20px 0;border:1px solid #fbbf24">
        <p style="margin:0 0 10px 0"><strong>💡 Consejo:</strong> También podés descargar tus entradas en cualquier momento desde este link:</p>
        <p style="margin:10px 0">
          <a href="${data.downloadUrl}" style="display:inline-block;background:#8b5cf6;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">
            📥 Descargar Entradas
          </a>
        </p>
        <p style="margin:10px 0 0 0;font-size:11px;color:#666">
          ${data.downloadUrl}
        </p>
        <p style="margin:10px 0 0 0;font-size:11px;color:#666">
          (Guardá este link por si necesitás descargar las entradas nuevamente)
        </p>
      </div>
      `
          : ""
      }
      <p style="font-size:12px;color:#666;margin-top:20px">
        Si tenés alguna consulta, escribinos a: <strong>fabriciobarreto2610@gmail.com</strong>
      </p>
      <p style="font-size:11px;color:#999;margin-top:30px">
        Este email contiene tus entradas oficiales. No lo compartas.
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

    // 1) Generar QRs
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

    const pdfBytes = pdfBuffer.byteLength;
    console.log(
      "[tickets] PDF size:",
      pdfBytes,
      "bytes ≈",
      (pdfBytes / (1024 * 1024)).toFixed(2),
      "MB",
    );

    if (pdfBytes > 35 * 1024 * 1024) {
      console.error("[tickets] PDF too large, aborting");
      return {
        success: false,
        error: "El PDF es demasiado grande para enviarlo por email",
      };
    }

    // 3) Generar HTML
    const html = getEmailHTML(data);

    // 4) Enviar
    const { data: sent, error } = await resend.emails.send({
      from:
        process.env.EMAIL_FROM || "Carnavales Makallé <onboarding@resend.dev>",
      to: data.to,
      subject: `🎉 Tus entradas para ${data.eventName} – Orden ${data.orderNumber}`,
      html,
      replyTo: "fabriciobarreto2610@gmail.com",
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

    console.log("[tickets] Email sent OK:", sent?.id);
    return { success: true, messageId: sent?.id };
  } catch (err: unknown) {
    console.error("[tickets] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error enviando email",
    };
  }
}
