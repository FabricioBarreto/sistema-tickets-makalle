import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formato de moneda argentina
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Validar email
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validar teléfono argentino
 * Acepta formatos como: +54 9 362 123-4567, 3624123456, etc
 */
export function isValidPhone(phone: string): boolean {
  // Eliminar espacios, guiones y paréntesis
  const cleaned = phone.replace(/[\s\-()]/g, "");

  // Debe tener entre 10 y 15 dígitos
  const phoneRegex = /^(\+?54)?9?\d{8,12}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Validar DNI argentino
 * Debe tener 7 u 8 dígitos
 */
export function isValidDNI(dni: string): boolean {
  const cleaned = dni.replace(/\D/g, "");
  return cleaned.length >= 7 && cleaned.length <= 8;
}

/**
 * Formato de fecha
 */
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Formato de fecha y hora
 */
export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
