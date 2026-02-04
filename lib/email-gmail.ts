// lib/email-gmail.ts
import nodemailer from "nodemailer";

interface SendTicketEmailParams {
  to: string;
  orderNumber: string;
  buyerName: string;
  tickets: Array<{
    id: string;
    qrCode: string;
    order: {
      orderNumber: string;
      buyerName: string;
    };
  }>;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  downloadUrl?: string;
}

export async function sendTicketEmailWithGmail(
  params: SendTicketEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const {
      to,
      orderNumber,
      buyerName,
      tickets,
      eventName,
      eventDate,
      eventLocation,
      downloadUrl,
    } = params;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #8B5CF6;
    }
    .header h1 {
      color: #8B5CF6;
      margin: 0;
      font-size: 32px;
    }
    .info-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
      color: white;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.2);
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .download-button {
      display: inline-block;
      background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
      color: white !important;
      text-decoration: none;
      padding: 18px 36px;
      border-radius: 12px;
      font-weight: bold;
      font-size: 18px;
      box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
    }
    .ticket-qr {
      text-align: center;
      margin: 15px 0;
      padding: 20px;
      background: #f5f7fa;
      border-radius: 8px;
      border: 2px dashed #8B5CF6;
    }
    .qr-code {
      font-family: monospace;
      font-size: 11px;
      color: #4B5563;
      word-break: break-all;
      background: white;
      padding: 10px;
      border-radius: 4px;
    }
    .important {
      background-color: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 20px;
      margin: 25px 0;
      border-radius: 6px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Compra Exitosa!</h1>
      <p>Tus entradas estan listas</p>
    </div>

    <div style="text-align: center; margin: 20px 0;">
      <h2>Hola ${buyerName},</h2>
      <p>Tu pago ha sido confirmado exitosamente.</p>
    </div>

    <div class="info-box">
      <div class="info-row">
        <span>Evento:</span>
        <span>${eventName}</span>
      </div>
      <div class="info-row">
        <span>Lugar:</span>
        <span>${eventLocation}</span>
      </div>
      <div class="info-row">
        <span>Fecha:</span>
        <span>${eventDate}</span>
      </div>
      <div class="info-row">
        <span>Numero de Orden:</span>
        <span>${orderNumber}</span>
      </div>
      <div class="info-row">
        <span>Cantidad:</span>
        <span>${tickets.length} entrada(s)</span>
      </div>
    </div>

    ${
      downloadUrl
        ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${downloadUrl}" class="download-button">
        Descargar Entradas en PDF
      </a>
      <p style="color: #6B7280; font-size: 13px; margin-top: 10px;">
        Descarga tus entradas ahora o guarda este link para despues
      </p>
    </div>
    `
        : ""
    }

    <div class="important">
      <strong>Instrucciones Importantes:</strong>
      <ul>
        <li>Guarda el PDF en un lugar seguro</li>
        <li>Puedes presentar el QR desde tu celular o impreso</li>
        <li>Llega con tiempo suficiente al evento</li>
        <li>Cada entrada tiene un codigo QR unico</li>
      </ul>
    </div>

    <div style="margin: 25px 0;">
      <h3 style="text-align: center;">Tus Codigos QR</h3>
      ${tickets
        .map(
          (ticket, index) => `
        <div class="ticket-qr">
          <h3>Entrada #${index + 1}</h3>
          <div class="qr-code">${ticket.qrCode}</div>
        </div>
      `,
        )
        .join("")}
    </div>

    <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; text-align: center;">
      <p><strong>Necesitas ayuda?</strong></p>
      <p>Email: fabriciobarreto2610@gmail.com</p>
      <p>Telefono: 3734-469110</p>
    </div>

    <div style="text-align: center; color: #6B7280; font-size: 13px; margin-top: 30px;">
      <p>Este es un email automatico, por favor no respondas directamente.</p>
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Hola ${buyerName}!

Tu compra ha sido exitosa. Aqui estan los detalles:

EVENTO: ${eventName}
FECHA: ${eventDate}
LUGAR: ${eventLocation}
ORDEN: ${orderNumber}
CANTIDAD: ${tickets.length} entrada(s)

${downloadUrl ? `DESCARGA TUS ENTRADAS:\n${downloadUrl}\n\n` : ""}

CODIGOS QR:
${tickets.map((t, i) => `Entrada #${i + 1}: ${t.qrCode}`).join("\n")}

IMPORTANTE:
- Guarda este PDF en un lugar seguro
- Presenta el codigo QR en tu dispositivo o impreso
- Llega con tiempo al evento

Necesitas ayuda?
Email: fabriciobarreto2610@gmail.com
Telefono: 3734-469110

---
Este es un email automatico, por favor no respondas directamente.
    `;

    const mailOptions = {
      from: {
        name: "Carnavales Makalle",
        address: process.env.GMAIL_USER || "",
      },
      to,
      subject: `Tus entradas para ${eventName} - Orden ${orderNumber}`,
      text: textContent,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email enviado con Gmail SMTP");
    console.log("Message ID:", info.messageId);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error: unknown) {
    console.error("Error enviando email con Gmail:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function verifyGmailConfig(): Promise<boolean> {
  try {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
      console.error("Gmail credenciales no configuradas");
      return false;
    }

    console.log("Gmail configurado correctamente");
    console.log("Email:", user);
    return true;
  } catch (error) {
    console.error("Error verificando configuracion:", error);
    return false;
  }
}
