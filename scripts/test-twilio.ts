// scripts/test-twilio.ts
import "dotenv/config";
import { sendTicketWhatsAppTwilio } from "../lib/whatsapp-twilio";

console.log("🔍 Variables cargadas:");
console.log(
  "TWILIO_ACCOUNT_SID:",
  process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + "...",
);
console.log("TWILIO_AUTH_TOKEN:", process.env.TWILIO_AUTH_TOKEN ? "✅" : "❌");
console.log("TWILIO_WHATSAPP_NUMBER:", process.env.TWILIO_WHATSAPP_NUMBER);

async function testTwilio() {
  console.log("\n🧪 Testing Twilio WhatsApp...");

  // Simular link de descarga
  const downloadUrl = "https://tuapp.com/api/tickets/download/abc123token456";

  const result = await sendTicketWhatsAppTwilio({
    to: "+5493734415050", // 👈 Tu número
    buyerName: "Juan Pérez",
    eventName: "Carnavales Makallé 2026",
    eventDate: "15 de febrero",
    eventLocation: "Makallé, Chaco",
    orderNumber: "TEST-001",
    ticketCount: 1,
    downloadUrl,
  });

  console.log("\n✅ Resultado:", result);
}

testTwilio().catch(console.error);
