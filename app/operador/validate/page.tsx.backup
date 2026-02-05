"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/QRScanner";

export default function OperadorValidatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    router.push("/operador/login");
    return null;
  }

  async function handleScan(token: string) {
    setScanning(true);
    setResult(null);

    try {
      const res = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ success: true, message: "✓ Entrada válida" });
      } else {
        setResult({
          success: false,
          message: data.error || "Entrada inválida",
        });
      }
    } catch (error) {
      setResult({ success: false, message: "Error al validar" });
    } finally {
      setScanning(false);
      setTimeout(() => setResult(null), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-purple-600">
                Validador QR
              </h1>
              <p className="text-sm text-gray-600">
                Operador: {session?.user?.name}
              </p>
            </div>
            <button
              onClick={() => router.push("/api/auth/signout")}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Salir
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <QRScanner onScan={handleScan} />

          {result && (
            <div
              className={`mt-4 p-4 rounded-lg text-center font-medium ${
                result.success
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {result.message}
            </div>
          )}

          {scanning && (
            <div className="mt-4 text-center text-gray-600">
              Validando entrada...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
