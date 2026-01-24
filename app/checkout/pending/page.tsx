"use client";

import { useSearchParams } from "next/navigation";
import { Clock, Home } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CheckoutPendingPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-yellow-100 rounded-full p-6">
            <Clock className="w-20 h-20 text-yellow-600" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Pago Pendiente
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Tu pago está siendo procesado. Te notificaremos por email cuando se
          confirme.
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
