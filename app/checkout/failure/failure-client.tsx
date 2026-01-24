"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { XCircle, Home } from "lucide-react";

export default function CheckoutFailureClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // si más adelante querés usarlo
  const orderId = searchParams.get("orderId");

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 rounded-full p-6">
            <XCircle className="w-20 h-20 text-red-600" />
          </div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          Pago Rechazado
        </h1>

        <p className="text-lg text-gray-600 mb-8">
          Tu pago no pudo ser procesado. Por favor, intentá nuevamente.
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
