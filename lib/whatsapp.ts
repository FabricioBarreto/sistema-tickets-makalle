// src/lib/whatsapp.ts

export function normalizePhoneToE164AR(phone: string): string {
  // Argentina: +54 + código área sin 0 + número sin 15
  // Ej: 11 15 2345 6789 -> +541123456789
  let digits = (phone || "").replace(/\D/g, "");

  // sacar prefijos comunes
  if (digits.startsWith("00")) digits = digits.slice(2);

  // si empieza con 54, ok; si no, asumimos AR
  if (!digits.startsWith("54")) digits = "54" + digits;

  // remover "0" de área si quedó (a veces meten 5411.. vs 54011..)
  digits = digits.replace(/^540/, "54");

  // remover "15" después del código de área (caso típico AR)
  // Esto es heurístico: 54 + (2-4 dígitos area) + 15 + resto
  digits = digits.replace(/^54(\d{2,4})15/, "54$1");

  return `+${digits}`;
}

export function buildWhatsAppClickToChatLink(
  phoneE164: string,
  message: string,
): string {
  const digits = phoneE164.replace(/\D/g, ""); // wa.me quiere números solos
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}
