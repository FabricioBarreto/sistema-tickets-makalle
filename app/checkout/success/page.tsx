// app/checkout/success/page.tsx
"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Mail,
  Home,
  Loader2,
  Clock,
  FileText,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface Order {
  orderNumber: string;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  totalAmount: number;
  paymentStatus: string;
  downloadToken?: string;
}

// Helpers WhatsApp
function normalizePhoneForWhatsApp(phone: string): string {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("54")) digits = "54" + digits;
  digits = digits.replace(/^540/, "54");
  digits = digits.replace(/^54(\d{2,4})15/, "54$1");
  return digits;
}

function buildWaMeLink(phoneDigits: string, message: string): string {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("orderId");
  const transactionId =
    searchParams.get("transactionId") ||
    searchParams.get("transaction_id") ||
    searchParams.get("id");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<string>("PENDING");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [confirmAttempts, setConfirmAttempts] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>(
    "Verificando tu pago...",
  );

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxAttempts = 40; // 40 intentos × 3s = 2 minutos

  useEffect(() => {
    if (!orderId) return;

    // Llamada inicial inmediata
    verifyPayment();

    // Polling cada 3 segundos
    intervalRef.current = setInterval(verifyPayment, 3000);

    // Timeout de seguridad: parar después de 2 minutos
    const timeout = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }, 120000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const verifyPayment = async () => {
    try {
      setConfirmAttempts((prev) => prev + 1);

      // 1. Llamar al endpoint de confirmación (intenta verificar con Unicobros)
      const confirmParams = new URLSearchParams({ orderId: orderId! });

      const status = searchParams.get("status") || searchParams.get("code");
      if (status) confirmParams.set("status", status);

      if (transactionId) {
        confirmParams.set("transactionId", transactionId);
      }

      const confirmRes = await fetch(`/api/unicobros/confirm?${confirmParams}`);
      const confirmData = await confirmRes.json();

      if (confirmData.success && confirmData.status === "COMPLETED") {
        // ¡Pago confirmado!
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPaymentStatus("COMPLETED");
        setLoading(false);

        if (confirmData.downloadToken) {
          setDownloadUrl(`/api/tickets/download/${confirmData.downloadToken}`);
        }

        // Cargar datos completos de la orden para mostrar
        await fetchOrderDetails();
        return;
      }

      if (confirmData.status === "FAILED") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setPaymentStatus("FAILED");
        setStatusMessage("El pago fue rechazado");
        setLoading(false);
        return;
      }

      // 2. Si confirm no resolvió, también consultar el estado de la orden directamente
      const orderRes = await fetch(`/api/orders/${orderId}`);
      const orderData = await orderRes.json();

      if (orderData.success) {
        setOrder(orderData.data);

        if (orderData.data.paymentStatus === "COMPLETED") {
          // Confirmado por webhook mientras tanto
          if (intervalRef.current) clearInterval(intervalRef.current);
          setPaymentStatus("COMPLETED");
          setLoading(false);

          if (orderData.data.downloadToken) {
            setDownloadUrl(
              `/api/tickets/download/${orderData.data.downloadToken}`,
            );
          }
          return;
        }
      }

      // Actualizar mensaje según intentos
      if (confirmAttempts > 10) {
        setStatusMessage("Seguimos verificando tu pago con Unicobros...");
      }
      if (confirmAttempts > 20) {
        setStatusMessage(
          "Esto está tardando más de lo normal. No cierres esta página.",
        );
      }

      // Si llegamos al máximo de intentos, parar el polling
      if (confirmAttempts >= maxAttempts) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error verificando pago:", error);
    } finally {
      if (loading && confirmAttempts >= 3) {
        // Dejar de mostrar spinner después de unos intentos
        // pero seguir verificando en background
        setLoading(false);
      }
    }
  };

  const fetchOrderDetails = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.data);
        if (
          data.data.downloadToken &&
          data.data.paymentStatus === "COMPLETED"
        ) {
          setDownloadUrl(`/api/tickets/download/${data.data.downloadToken}`);
        }
      }
    } catch (error) {
      console.error("Error fetching order:", error);
    }
  };

  // ─── Retry manual ───
  const handleManualRetry = async () => {
    setLoading(true);
    setConfirmAttempts(0);
    setStatusMessage("Verificando tu pago...");

    // Reiniciar polling
    if (intervalRef.current) clearInterval(intervalRef.current);
    await verifyPayment();
    intervalRef.current = setInterval(verifyPayment, 3000);

    setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }, 60000);
  };

  // ─── LOADING STATE ───
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center max-w-md">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">{statusMessage}</p>
          <p className="text-gray-500 text-sm mt-2">
            Esto puede tomar unos segundos
          </p>
        </div>
      </div>
    );
  }

  // ─── FAILED STATE ───
  if (paymentStatus === "FAILED") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-red-100 rounded-full p-6">
              <AlertTriangle className="w-20 h-20 text-red-600" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Pago Rechazado
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Tu pago no pudo ser procesado. Podés intentar nuevamente.
          </p>
          <button
            onClick={() => router.push("/")}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 mx-auto"
          >
            <Home className="w-5 h-5" />
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ─── PENDING STATE (timeout) ───
  if (paymentStatus === "PENDING") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-yellow-100 rounded-full p-6">
              <Clock className="w-20 h-20 text-yellow-600" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Pago en Proceso
          </h1>

          <p className="text-lg text-gray-600 mb-4">
            Tu pago está siendo procesado. Puede demorar unos minutos en
            confirmarse.
          </p>
          <p className="text-md text-gray-500 mb-8">
            Te notificaremos por email a <strong>{order?.buyerEmail}</strong>{" "}
            cuando se confirme.
          </p>

          {order && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-8">
              <p className="text-sm text-yellow-800">
                Número de Orden:{" "}
                <span className="font-bold">{order.orderNumber}</span>
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleManualRetry}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Verificar nuevamente
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Volver al inicio
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Si ya pagaste y no se confirma, contactanos a
            fabriciobarreto2610@gmail.com o al 3734-469110
          </p>
        </div>
      </div>
    );
  }

  // ─── COMPLETED STATE ───
  const waPhoneDigits = order?.buyerPhone
    ? normalizePhoneForWhatsApp(order.buyerPhone)
    : null;

  const waMessage = order
    ? `Hola ${order.buyerName}! 👋\nTu compra fue exitosa ✅\nOrden: ${order.orderNumber}\nEntradas: ${order.quantity}\n\nTe envié las entradas en PDF al email: ${order.buyerEmail}\nSi no te llegó, avisame por acá y te lo reenvío.`
    : "Hola! Necesito ayuda con mi compra de entradas.";

  const waLink = waPhoneDigits ? buildWaMeLink(waPhoneDigits, waMessage) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
          {/* Success Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 rounded-full p-6 animate-bounce">
              <CheckCircle2 className="w-20 h-20 text-green-600" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            ¡Compra Exitosa!
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            Tu pago ha sido procesado correctamente
          </p>

          {/* Order Details */}
          {order && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-6 mb-8 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Número de Orden</p>
                  <p className="font-bold text-gray-900">{order.orderNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cantidad</p>
                  <p className="font-bold text-gray-900">
                    {order.quantity} entrada(s)
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Comprador</p>
                  <p className="font-bold text-gray-900">{order.buyerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Pagado</p>
                  <p className="font-bold text-green-600">
                    ${Number(order.totalAmount).toLocaleString("es-AR")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Botón de descarga del PDF */}
          {downloadUrl && (
            <div className="mb-6">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
              >
                <FileText className="w-6 h-6" />
                Descargar Entradas (PDF)
                <Download className="w-6 h-6" />
              </a>
              <p className="text-xs text-gray-500 mt-2">
                Descargá tus entradas ahora o guardá este link para después
              </p>
            </div>
          )}

          {/* Email Info */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Mail className="w-6 h-6 text-blue-600" />
              <h3 className="font-bold text-blue-900">Revisa tu email</h3>
            </div>
            <p className="text-sm text-blue-800">
              También te enviamos tus entradas con código QR a{" "}
              <span className="font-semibold">{order?.buyerEmail}</span>
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Si no lo ves, revisa la carpeta de spam
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={() => router.push("/")}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Volver al inicio
            </button>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            ¿Problemas? Contactanos a fabriciobarreto2610@gmail.com o al
            teléfono 3734-469110
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
