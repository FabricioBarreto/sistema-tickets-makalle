import { Resend } from "resend";
import { generateQRImage } from "./qr";

const resend = new Resend(process.env.RESEND_API_KEY);

interface Ticket {
  id: string;
  qrCode: string; // Este será el qrHash del ticket
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
 * Genera el HTML del email con diseño profesional
 */
function getEmailHTML(data: SendTicketEmailData, qrDataUrls: string[]): string {
  const ticketCards = qrDataUrls
    .map(
      (qrDataUrl, index) => `
    <div style="background: white; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <div style="text-align: center; margin-bottom: 16px;">
        <span style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
          ENTRADA #${index + 1} de ${data.tickets.length}
        </span>
      </div>
      <div style="text-align: center; background: #f9fafb; padding: 20px; border-radius: 8px;">
        <img src="${qrDataUrl}" alt="QR Code ${index + 1}" style="max-width: 300px; width: 100%; height: auto; border-radius: 8px;" />
      </div>
      <div style="margin-top: 16px; padding: 12px; background: #f3f4f6; border-radius: 8px; text-align: center;">
        <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">
          Código de verificación
        </div>
        <div style="font-size: 12px; color: #374151; font-family: 'Courier New', monospace; font-weight: 600; word-break: break-all;">
          ${data.tickets[index].qrCode}
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tus Entradas - ${data.eventName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07);">
          
          <!-- Header con degradado -->
          <tr>
            <td style="background: linear-gradient(135deg, #ec4899 0%, #ef4444 50%, #f97316 100%); padding: 48px 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">🎭</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                ¡Tu compra fue exitosa!
              </h1>
              <p style="margin: 12px 0 0 0; color: rgba(255,255,255,0.95); font-size: 18px;">
                Tus entradas para ${data.eventName}
              </p>
            </td>
          </tr>

          <!-- Contenido -->
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Hola <strong>${data.buyerName}</strong>,
              </p>
              <p style="margin: 0 0 32px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                ¡Gracias por tu compra! Tu pago fue confirmado exitosamente. Abajo encontrarás tu(s) entrada(s) con código QR.
              </p>

              <!-- Detalles de la orden -->
              <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 24px; margin-bottom: 32px; border: 2px solid #fbbf24;">
                <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #92400e; font-weight: 700;">
                  📋 Detalles de tu Compra
                </h2>
                <table width="100%" cellpadding="8" cellspacing="0">
                  <tr>
                    <td style="color: #78350f; font-size: 14px; font-weight: 500;">Número de Orden</td>
                    <td style="color: #78350f; font-weight: 700; text-align: right; font-size: 14px;">${data.orderNumber}</td>
                  </tr>
                  <tr>
                    <td style="color: #78350f; font-size: 14px; font-weight: 500;">Cantidad de Entradas</td>
                    <td style="color: #78350f; font-weight: 700; text-align: right; font-size: 14px;">${data.tickets.length}</td>
                  </tr>
                  <tr>
                    <td style="color: #78350f; font-size: 14px; font-weight: 500;">Evento</td>
                    <td style="color: #78350f; font-weight: 700; text-align: right; font-size: 14px;">${data.eventName}</td>
                  </tr>
                  <tr>
                    <td style="color: #78350f; font-size: 14px; font-weight: 500;">Fecha</td>
                    <td style="color: #78350f; font-weight: 700; text-align: right; font-size: 14px;">${data.eventDate}</td>
                  </tr>
                  <tr>
                    <td style="color: #78350f; font-size: 14px; font-weight: 500;">Lugar</td>
                    <td style="color: #78350f; font-weight: 700; text-align: right; font-size: 14px;">${data.eventLocation}</td>
                  </tr>
                </table>
              </div>

              <!-- Códigos QR -->
              <div style="margin-bottom: 32px;">
                <h2 style="margin: 0 0 24px 0; font-size: 24px; color: #111827; font-weight: 700; text-align: center;">
                  🎟️ Tus Códigos QR
                </h2>
                <p style="margin: 0 0 24px 0; color: #6b7280; text-align: center; font-size: 14px; line-height: 1.6;">
                  Presentá estos códigos en la entrada del evento.<br/>
                  Podés mostrarlos desde tu celular o imprimirlos.
                </p>
                ${ticketCards}
              </div>

              <!-- Instrucciones -->
              <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin-bottom: 20px; border-radius: 8px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #991b1b; font-weight: 700;">
                  ⚠️ Instrucciones Importantes
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #7f1d1d; font-size: 14px; line-height: 1.8;">
                  <li>Presentá tu código QR en la entrada del evento</li>
                  <li>Podés mostrar el QR desde tu celular o imprimirlo</li>
                  <li>Cada entrada se puede usar <strong>una sola vez</strong></li>
                  <li>Llegá temprano para evitar filas</li>
                  <li>Guardá este email para cualquier consulta</li>
                </ul>
              </div>

              <!-- Tips -->
              <div style="background: #dcfce7; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #065f46; font-weight: 700;">
                  💡 Consejos
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #047857; font-size: 14px; line-height: 1.8;">
                  <li>Asegurate que la pantalla de tu celular tenga buen brillo</li>
                  <li>Si imprimís, usá buena calidad de impresión</li>
                  <li>Podés hacer una captura de pantalla como respaldo</li>
                  <li>Llegá con tiempo suficiente para el escaneo</li>
                </ul>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 32px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px;">
                ¿Tenés alguna consulta? Escribinos a
              </p>
              <p style="margin: 0 0 24px 0;">
                <a href="mailto:soporte@carnaval.com" style="color: #ec4899; text-decoration: none; font-weight: 600;">
                  soporte@carnaval.com
                </a>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                © 2026 Carnavales Makallé - Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Envía email con las entradas y códigos QR
 * GRATIS: 100 emails/día con Resend (3000/mes)
 */
export async function sendTicketEmailWithQRs(
  data: SendTicketEmailData,
): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn("⚠️  RESEND_API_KEY not configured");
      return { success: false, error: "Email service not configured" };
    }

    console.log(
      `📧 Generating ${data.tickets.length} QR codes for ${data.to}...`,
    );

    // Generar imágenes QR en paralelo
    const qrDataUrls = await Promise.all(
      data.tickets.map(async (ticket) => {
        const qrDataUrl = await generateQRImage(ticket.qrCode, {
          width: 500,
          errorCorrectionLevel: "H",
          margin: 2,
        });
        return qrDataUrl;
      }),
    );

    console.log("✅ QR codes generated successfully");

    // Generar HTML del email
    const emailHTML = getEmailHTML(data, qrDataUrls);

    console.log(`📤 Sending email to: ${data.to}`);

    // Enviar email
    const result = await resend.emails.send({
      from:
        process.env.EMAIL_FROM || "Carnavales Makallé <onboarding@resend.dev>",
      to: data.to,
      subject: `🎉 ¡Tus entradas para ${data.eventName}! - Orden ${data.orderNumber}`,
      html: emailHTML,
      replyTo: "soporte@carnaval.com",
    });

    if (result.error) {
      console.error("❌ Resend error:", result.error);
      return {
        success: false,
        error: result.error.message || "Failed to send email",
      };
    }

    console.log("✅ Email sent successfully:", result.data);

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send email";
    console.error("❌ Error sending email:", error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
