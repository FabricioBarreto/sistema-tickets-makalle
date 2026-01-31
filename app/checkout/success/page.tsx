"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  Mail,
  Home,
  Loader2,
  Clock,
  FileText,
} from "lucide-react";

interface Order {
  orderNumber: string;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  totalAmount: number;
  paymentStatus: string;
  downloadToken?: string; // 👈 TOKEN DE DESCARGA
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
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentStatus, setPaymentStatus] = useState<string>("PENDING");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null); // 👈 URL DE DESCARGA

  useEffect(() => {
    if (orderId) {
      fetchOrder();
      const interval = setInterval(fetchOrder, 3000);
      const timeout = setTimeout(() => clearInterval(interval), 120000);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.data);
        setPaymentStatus(data.data.paymentStatus);

        // 👇 GENERAR URL DE DESCARGA
        if (
          data.data.downloadToken &&
          data.data.paymentStatus === "COMPLETED"
        ) {
          // Usar ruta relativa (funciona en dev y producción)
          setDownloadUrl(`/api/tickets/download/${data.data.downloadToken}`);
        }

        if (data.data.paymentStatus === "COMPLETED") {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error("Error fetching order:", error);
    } finally {
      if (loading) setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Verificando tu pago...</p>
          <p className="text-gray-500 text-sm mt-2">
            Esto puede tomar unos segundos
          </p>
        </div>
      </div>
    );
  }

  if (paymentStatus === "PENDING") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-yellow-100 rounded-full p-6">
              <Clock className="w-20 h-20 text-yellow-600 animate-pulse" />
            </div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Pago en Proceso
          </h1>

          <p className="text-lg text-gray-600 mb-8">
            Tu pago está siendo procesado. Te notificaremos por email cuando se
            confirme.
          </p>

          {order && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-8">
              <p className="text-sm text-yellow-800">
                Número de Orden:{" "}
                <span className="font-bold">{order.orderNumber}</span>
              </p>
            </div>
          )}

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

  // Pago completado
  const waPhoneDigits = order?.buyerPhone
    ? normalizePhoneForWhatsApp(order.buyerPhone)
    : null;

  const waMessage = order
    ? `Hola ${order.buyerName}! 👋
Tu compra fue exitosa ✅
Orden: ${order.orderNumber}
Entradas: ${order.quantity}

Te envié las entradas en PDF al email: ${order.buyerEmail}
Si no te llegó, avisame por acá y te lo reenvío.`
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

          {/* Title */}
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

          {/* 👇 BOTÓN DE DESCARGA DEL PDF */}
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
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                💬 Abrir WhatsApp con mis datos
              </a>
            )}

            <button
              onClick={() => router.push("/")}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" />
              Volver al inicio
            </button>
          </div>

          {/* Help Text */}
          <p className="text-sm text-gray-500 mt-6">
            ¿Problemas? Contactanos a fabriciobarreto2610@gmail.com
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
