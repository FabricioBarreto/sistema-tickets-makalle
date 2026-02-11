// app/checkout/page.tsx
"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { formatCurrency, isValidEmail, isValidPhone } from "@/lib/utils";
import { toast } from "sonner";

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quantity = parseInt(searchParams.get("quantity") || "1");

  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [ticketPrice, setTicketPrice] = useState(0);
  const [formData, setFormData] = useState({
    buyerName: "",
    buyerEmail: "",
    buyerPhone: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ✅ Protección anti-duplicados
  const isProcessingRef = useRef(false);
  const lastSubmitTimeRef = useRef(0);

  const totalAmount = ticketPrice * quantity;

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      console.log("🔍 Response config:", data);

      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "No se pudo cargar la configuración");
      }

      const price = Number(data.data.ticketPrice || 0);
      console.log("💰 Precio cargado:", price);
      setTicketPrice(price);
    } catch (error: unknown) {
      console.error("❌ Error cargando config:", error);
      toast.error("Error cargando precios");
      setTicketPrice(0);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.buyerName || formData.buyerName.trim().length < 3) {
      newErrors.buyerName = "El nombre debe tener al menos 3 caracteres";
    }

    if (!isValidEmail(formData.buyerEmail)) {
      newErrors.buyerEmail = "Email inválido";
    }

    if (!isValidPhone(formData.buyerPhone)) {
      newErrors.buyerPhone = "Teléfono inválido (ej: +54 9 362 123-4567)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ PROTECCIÓN 1: Evitar doble click
    if (isProcessingRef.current) {
      console.log("⏳ Ya estamos procesando una compra, espera...");
      toast.warning("Ya estamos procesando tu compra, por favor espera");
      return;
    }

    // ✅ PROTECCIÓN 2: Rate limiting (5 segundos entre intentos)
    const now = Date.now();
    const timeSinceLastSubmit = now - lastSubmitTimeRef.current;
    if (timeSinceLastSubmit < 5000) {
      const waitTime = Math.ceil((5000 - timeSinceLastSubmit) / 1000);
      console.log(
        `⏳ Espera ${waitTime} segundos antes de intentar nuevamente`,
      );
      toast.warning(`Espera ${waitTime} segundos antes de intentar nuevamente`);
      return;
    }

    if (!validateForm()) {
      toast.error("Por favor completá todos los campos correctamente");
      return;
    }

    // Marcar como procesando
    isProcessingRef.current = true;
    lastSubmitTimeRef.current = now;
    setLoading(true);

    try {
      // Normalizar teléfono
      let phone = formData.buyerPhone.replace(/[^0-9+]/g, "");
      if (!phone.startsWith("+")) {
        phone = "+54" + phone;
      }

      console.log("📦 Creando orden con teléfono normalizado:", phone);

      // 1) Crear la orden + tickets
      const createRes = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          buyerPhone: phone,
          quantity,
        }),
      });

      const createText = await createRes.text();
      console.log("📦 Response texto:", createText);

      if (!createRes.ok) {
        throw new Error(
          `Error creando orden (${createRes.status}): ${createText}`,
        );
      }

      const createData = createText ? JSON.parse(createText) : null;
      console.log("📦 Orden creada:", createData);

      if (!createData?.success) {
        throw new Error(createData?.error || "Error al crear la orden");
      }

      const { id: orderId } = createData.data;
      console.log("✅ Order ID:", orderId);

      // 2) Crear preferencia de Unicobros
      console.log("💳 Creando preferencia Unicobros...");
      const mpRes = await fetch("/api/unicobros/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const mpText = await mpRes.text();
      console.log("💳 Response texto:", mpText);

      if (!mpRes.ok) {
        // Si es 429 (rate limit), mostrar mensaje específico
        if (mpRes.status === 429) {
          throw new Error(
            "Por favor espera unos segundos antes de intentar nuevamente",
          );
        }
        throw new Error(`Error al crear el pago (${mpRes.status}): ${mpText}`);
      }

      const mpData = mpText ? JSON.parse(mpText) : null;
      console.log("💳 Data parseado:", mpData);

      if (!mpData?.success) {
        throw new Error(
          mpData?.error || mpText || "Error al crear preferencia",
        );
      }

      if (!mpData.initPoint) {
        console.error("❌ Data completo:", JSON.stringify(mpData, null, 2));
        throw new Error("No se recibió el link de pago de Unicobros");
      }

      console.log("✅ Redirigiendo a:", mpData.initPoint);

      // 3) Mostrar mensaje de redirección
      toast.success("Redirigiendo al pago...", { duration: 2000 });

      // 4) Redirigir después de un breve delay
      setTimeout(() => {
        window.location.href = mpData.initPoint;
      }, 500);
    } catch (error: unknown) {
      console.error("❌ Error completo:", error);

      // Liberar el lock en caso de error
      isProcessingRef.current = false;
      setLoading(false);

      if (error instanceof Error) {
        toast.error(error.message || "Error al procesar la compra");
      } else {
        toast.error("Error al procesar la compra");
      }
    }
    // NO liberamos isProcessingRef aquí porque ya estamos redirigiendo
  };

  if (loadingConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            disabled={loading}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Column */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Completá tus datos
              </h1>
              <p className="text-gray-600 mb-8">
                Necesitamos esta información para enviarte las entradas
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nombre */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nombre completo *
                  </label>
                  <input
                    type="text"
                    name="buyerName"
                    value={formData.buyerName}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="Juan Pérez"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      errors.buyerName ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.buyerName && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.buyerName}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    name="buyerEmail"
                    value={formData.buyerEmail}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="juan@ejemplo.com"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      errors.buyerEmail ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.buyerEmail && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.buyerEmail}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-gray-500">
                    Recibirás las entradas en este email
                  </p>
                </div>

                {/* Teléfono */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="tel"
                    name="buyerPhone"
                    value={formData.buyerPhone}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="+54 9 362 123-4567"
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      errors.buyerPhone ? "border-red-500" : "border-gray-300"
                    }`}
                  />
                  {errors.buyerPhone && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.buyerPhone}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      Continuar al pago
                      <ShieldCheck className="w-5 h-5" />
                    </>
                  )}
                </button>

                {/* Aviso */}
                <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Aviso importante
                      </p>
                      <p className="text-sm text-amber-800 mt-1">
                        El ticket QR{" "}
                        <strong>solo puede ser utilizado una vez</strong>. Luego
                        será invalidado automáticamente.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-500 text-center">
                  Al continuar, serás redirigido a Unicobros para completar el
                  pago de forma segura
                </p>
              </form>
            </div>
          </div>

          {/* Summary Column */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Resumen</h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-gray-600">Cantidad</span>
                  <span className="font-semibold text-gray-900">
                    {quantity} entrada{quantity !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex items-center justify-between py-3 border-b">
                  <span className="text-gray-600">Precio unitario</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(ticketPrice)}
                  </span>
                </div>

                <div className="flex items-center justify-between py-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg px-4">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Pago 100% seguro
                </h3>
                <p className="text-sm text-blue-800">
                  Tu pago es procesado de forma segura por Unicobros. Aceptamos
                  todas las tarjetas de crédito y débito.
                </p>
              </div>

              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">
                  📧 Entrega instantánea
                </h3>
                <p className="text-sm text-green-800">
                  Recibirás tus entradas con código QR al instante por email
                  después de confirmar el pago.
                </p>
              </div>

              <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Aviso importante
                </h3>
                <p className="text-sm text-amber-800 font-medium">
                  El ticket QR solo puede ser utilizado una vez. Luego será
                  invalidado automáticamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
