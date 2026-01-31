// scripts/check-twilio-env.ts
console.log("🔍 Verificando variables de Twilio:");
console.log(
  "TWILIO_ACCOUNT_SID:",
  process.env.TWILIO_ACCOUNT_SID || "❌ NO CONFIGURADO",
);
console.log(
  "TWILIO_AUTH_TOKEN:",
  process.env.TWILIO_AUTH_TOKEN ? "✅ Configurado" : "❌ NO CONFIGURADO",
);
console.log(
  "TWILIO_WHATSAPP_NUMBER:",
  process.env.TWILIO_WHATSAPP_NUMBER || "❌ NO CONFIGURADO",
);
