// scripts/test-gmail.ts
import {
  sendTicketEmailWithGmail,
  verifyGmailConfig,
} from "../lib/email-gmail";

async function testEmail() {
  // Verificar configuración
  console.log("🔍 Verificando configuración de Gmail...");
  const configOk = await verifyGmailConfig();

  if (!configOk) {
    console.error("❌ Configuración incorrecta");
    console.log(
      "Verifica que GMAIL_USER y GMAIL_APP_PASSWORD estén en .env.local",
    );
    return;
  }

  // Enviar email de prueba
  console.log("📧 Enviando email de prueba...");
  const result = await sendTicketEmailWithGmail({
    to: "fabrib40@gmail.com", // Tu email para probar
    orderNumber: "TEST-GMAIL-001",
    buyerName: "Fabricio Test",
    tickets: [
      {
        id: "test-1",
        qrCode: "GMAIL-TEST-ABC123XYZ789",
        order: {
          orderNumber: "TEST-GMAIL-001",
          buyerName: "Fabricio Test",
        },
      },
      {
        id: "test-2",
        qrCode: "GMAIL-TEST-DEF456UVW012",
        order: {
          orderNumber: "TEST-GMAIL-001",
          buyerName: "Fabricio Test",
        },
      },
    ],
    eventName: "Carnavales Makallé 2026",
    eventDate: "15 de febrero de 2026",
    eventLocation: "Makallé, Chaco",
    downloadUrl: "https://tudominio.com/download/test-token-123",
  });

  if (result.success) {
    console.log("✅ ¡Email enviado exitosamente!");
    console.log("📨 Message ID:", result.messageId);
    console.log("");
    console.log("👉 Revisa tu bandeja de entrada en Gmail");
  } else {
    console.error("❌ Error al enviar:", result.error);
  }
}

testEmail();
