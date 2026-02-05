"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/QRScanner";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Hash,
  Calendar,
  ShieldCheck,
  LogOut,
  Loader2,
  Smartphone,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface TicketInfo {
  id: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerDNI?: string;
  quantity: number;
  validated: boolean;
  validatedAt?: Date;
  validatedBy?: { name: string };
}

type ScanStatus = "idle" | "validating" | "success" | "error" | "already-used";

export default function ValidatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [message, setMessage] = useState("");
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState("");
  const [validationCount, setValidationCount] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/operador/login");
    }
  }, [status, router]);

  const handleScan = async (decodedText: string) => {
    if (scanStatus === "validating") return;
    if (decodedText === lastScannedCode) return;

    setLastScannedCode(decodedText);
    setScanStatus("validating");
    setMessage("Verificando entrada...");
    setTicketInfo(null);

    try {
      const response = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCode: decodedText }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setScanStatus("success");
        setMessage("✅ Entrada validada correctamente");
        setTicketInfo(data.ticket);
        setValidationCount((prev) => prev + 1);

        // Vibración de éxito
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }

        // Auto-reset después de 5 segundos
        setTimeout(() => {
          resetScan();
        }, 5000);
      } else if (data.message?.includes("ya fue utilizada")) {
        setScanStatus("already-used");
        setMessage("⚠️ Entrada ya utilizada anteriormente");
        setTicketInfo(data.ticket);

        // Vibración de advertencia
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
      } else {
        setScanStatus("error");
        setMessage(data.message || "Error al validar la entrada");

        // Vibración de error
        if (navigator.vibrate) {
          navigator.vibrate([500]);
        }
      }
    } catch (error) {
      setScanStatus("error");
      setMessage("Error de conexión. Intenta nuevamente.");

      if (navigator.vibrate) {
        navigator.vibrate([500]);
      }
    }
  };

  const resetScan = () => {
    setScanStatus("idle");
    setMessage("");
    setTicketInfo(null);
    setLastScannedCode("");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/operador/login");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600">
      {/* Header */}
      <div className="bg-white/95 backdrop-blur-lg shadow-lg sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-black text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
                  Validador QR
                </h1>
                <p className="text-xs text-gray-600 font-medium">
                  {session.user.name}
                </p>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-green-600" />
              <p className="text-xs font-semibold text-gray-600 uppercase">
                Sesión Actual
              </p>
            </div>
            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-600">
              {validationCount}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {validationCount === 1 ? "validación" : "validaciones"}
            </p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="h-4 w-4 text-purple-600" />
              <p className="text-xs font-semibold text-gray-600 uppercase">
                Estado
              </p>
            </div>
            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600">
              {scanStatus === "validating" ? "..." : "OK"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {scanStatus === "idle"
                ? "Listo para escanear"
                : scanStatus === "validating"
                  ? "Procesando..."
                  : scanStatus === "success"
                    ? "Validado ✓"
                    : "Error"}
            </p>
          </div>
        </div>

        {/* Scanner Section */}
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-4">
            <h2 className="text-xl font-black text-white text-center">
              📱 Escaneá el QR
            </h2>
            <p className="text-white/90 text-sm text-center mt-1">
              Apuntá la cámara al código de la entrada
            </p>
          </div>

          <div className="p-4">
            {scanStatus === "idle" || scanStatus === "validating" ? (
              <QRScanner
                onScan={handleScan}
                onError={(error) => {
                  setScanStatus("error");
                  setMessage(error);
                }}
              />
            ) : (
              <div className="space-y-4">
                {/* Status Card */}
                <div
                  className={`rounded-xl p-6 border-4 ${
                    scanStatus === "success"
                      ? "bg-green-50 border-green-300"
                      : scanStatus === "already-used"
                        ? "bg-orange-50 border-orange-300"
                        : "bg-red-50 border-red-300"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {scanStatus === "success" ? (
                      <CheckCircle2 className="h-12 w-12 text-green-600 flex-shrink-0" />
                    ) : scanStatus === "already-used" ? (
                      <AlertCircle className="h-12 w-12 text-orange-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-12 w-12 text-red-600 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <h3
                        className={`text-xl font-black mb-2 ${
                          scanStatus === "success"
                            ? "text-green-900"
                            : scanStatus === "already-used"
                              ? "text-orange-900"
                              : "text-red-900"
                        }`}
                      >
                        {message}
                      </h3>

                      {ticketInfo && (
                        <div className="space-y-3 mt-4">
                          <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                            <User className="h-5 w-5 text-gray-600" />
                            <div>
                              <p className="text-xs text-gray-600 font-semibold">
                                Comprador
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {ticketInfo.buyerName}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                            <Hash className="h-5 w-5 text-gray-600" />
                            <div>
                              <p className="text-xs text-gray-600 font-semibold">
                                Orden
                              </p>
                              <p className="text-sm font-bold text-gray-900 font-mono">
                                #{ticketInfo.orderNumber}
                              </p>
                            </div>
                          </div>

                          {ticketInfo.buyerDNI && (
                            <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                              <User className="h-5 w-5 text-gray-600" />
                              <div>
                                <p className="text-xs text-gray-600 font-semibold">
                                  DNI
                                </p>
                                <p className="text-sm font-bold text-gray-900">
                                  {ticketInfo.buyerDNI}
                                </p>
                              </div>
                            </div>
                          )}

                          {ticketInfo.validatedAt && (
                            <div className="flex items-center gap-3 bg-white/60 rounded-lg p-3">
                              <Calendar className="h-5 w-5 text-gray-600" />
                              <div>
                                <p className="text-xs text-gray-600 font-semibold">
                                  Validado
                                </p>
                                <p className="text-sm font-bold text-gray-900">
                                  {new Date(
                                    ticketInfo.validatedAt,
                                  ).toLocaleString("es-AR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                                {ticketInfo.validatedBy && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    Por: {ticketInfo.validatedBy.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  onClick={resetScan}
                  className="w-full h-14 text-base font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  size="lg"
                >
                  Escanear Siguiente
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Instrucciones
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">1.</span>
              <span>
                Presioná <strong>&quot;Iniciar Cámara&quot;</strong> para
                activar el escáner
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">2.</span>
              <span>
                Apuntá la cámara al código QR de la entrada del usuario
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">3.</span>
              <span>
                El sistema validará automáticamente y mostrará el resultado
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">4.</span>
              <span>
                Si la entrada es válida, permitir el ingreso. Si ya fue usada,
                <strong> denegar el acceso</strong>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
