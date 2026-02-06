"use client";

import { useEffect, useState, useRef } from "react";
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
  Clock,
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
  validatedBy?: { name: string; email?: string };
}

type ScanStatus =
  | "idle"
  | "validating"
  | "success"
  | "error"
  | "already-used"
  | "payment-pending"
  | "not-found";

export default function ValidatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [message, setMessage] = useState("");
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [validationCount, setValidationCount] = useState(0);
  const [scannerEnabled, setScannerEnabled] = useState(true);
  const [lastScannedCode, setLastScannedCode] = useState<string>("");

  // Anti-spam y rate limiting
  const lastScanTimeRef = useRef(0);
  const scanCooldown = 2000; // 2 segundos entre escaneos

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/operador/login");
    }
  }, [status, router]);

  async function validateCode(code: string) {
    const response = await fetch("/api/tickets/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrCode: code }),
    });

    const data = await response.json().catch(() => ({}));
    return { response, data };
  }

  const handleScan = async (decodedText: string) => {
    // 🛑 Prevenir múltiples escaneos
    if (!scannerEnabled) {
      console.log("🚫 Scanner deshabilitado");
      return;
    }
    
    if (scanStatus === "validating") {
      console.log("🚫 Ya validando...");
      return;
    }

    // Anti-spam temporal
    const now = Date.now();
    if (now - lastScanTimeRef.current < scanCooldown) {
      console.log("🚫 Cooldown activo");
      return;
    }

    // Prevenir re-escanear el mismo código
    if (decodedText === lastScannedCode && scanStatus !== "idle") {
      console.log("🚫 Mismo código ya procesado");
      return;
    }

    lastScanTimeRef.current = now;
    setLastScannedCode(decodedText);

    // 🔥 Apagar cámara inmediatamente
    setScannerEnabled(false);
    setScanStatus("validating");
    setMessage("🔍 Verificando entrada...");
    setTicketInfo(null);

    try {
      const { response, data } = await validateCode(decodedText);

      // ✅ ÉXITO
      if (response.ok && data.success) {
        setScanStatus("success");
        setMessage(data.message || "✅ Entrada validada correctamente");
        setTicketInfo(data.ticket);
        setValidationCount((prev) => prev + 1);
        
        // Auto-reset después de 3 segundos
        setTimeout(() => {
          if (scanStatus === "success") {
            resetScan();
          }
        }, 3000);
        return;
      }

      // 💳 PAGO PENDIENTE
      if (
        response.status === 409 &&
        data?.error === "PAYMENT_PENDING"
      ) {
        setScanStatus("payment-pending");
        setMessage(data.message || "⏳ Pago pendiente");
        setTicketInfo(data.ticket ?? null);
        return;
      }

      // 🔄 YA VALIDADA
      if (
        response.status === 409 &&
        (data.message?.includes("ya fue utilizada") ||
          data.message?.includes("ya fue validada"))
      ) {
        setScanStatus("already-used");
        setMessage(data.message || "⚠️ Entrada ya utilizada");
        setTicketInfo(data.ticket);
        return;
      }

      // 🔍 NO ENCONTRADA
      if (response.status === 404) {
        setScanStatus("not-found");
        setMessage(data.message || "❌ Entrada no encontrada");
        return;
      }

      // ❌ OTRO ERROR
      setScanStatus("error");
      setMessage(data.message || "Error al validar la entrada");
      
    } catch (error) {
      console.error("Error en validación:", error);
      setScanStatus("error");
      setMessage("Error de conexión. Verificá tu internet.");
    }
  };

  // 🔁 Reintentar MISMO QR (pago pendiente)
  const retryScan = async () => {
    if (!lastScannedCode) {
      resetScan();
      return;
    }

    setScanStatus("validating");
    setMessage("🔄 Reintentando...");
    await handleScan(lastScannedCode);
  };

  // 🔄 Escanear NUEVO QR
  const resetScan = () => {
    setScanStatus("idle");
    setMessage("");
    setTicketInfo(null);
    setLastScannedCode("");
    setScannerEnabled(true);
    lastScanTimeRef.current = 0;
  };

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/operador/login");
  };

  // 🔄 Loading
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 via-pink-600 to-red-600">
        <div className="text-center text-white">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-red-600">
      {/* HEADER */}
      <div className="bg-white shadow sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex gap-3 items-center">
            <ShieldCheck className="text-purple-600 h-8 w-8" />
            <div>
              <h1 className="font-black text-lg">Validador QR</h1>
              <p className="text-xs text-gray-600">{session.user.name}</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {validationCount > 0 && (
              <div className="bg-green-100 px-3 py-1 rounded-full">
                <span className="text-green-800 font-bold text-sm">
                  {validationCount}
                </span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* SCANNER */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          {scannerEnabled ? (
            <QRScanner
              onScan={handleScan}
              onError={(err) => {
                console.error("Error en scanner:", err);
                setScanStatus("error");
                setMessage(err);
                setScannerEnabled(false);
              }}
            />
          ) : (
            <div className="text-center text-gray-500 py-20 space-y-3">
              <div className="text-4xl">📷</div>
              <p className="font-medium">Cámara pausada</p>
              {scanStatus === "validating" && (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
              )}
            </div>
          )}
        </div>

        {/* RESULTADO */}
        {scanStatus !== "idle" && (
          <div className={`rounded-xl shadow-lg p-6 space-y-4 ${
            scanStatus === "success" ? "bg-green-50 border-2 border-green-500" :
            scanStatus === "already-used" ? "bg-orange-50 border-2 border-orange-500" :
            scanStatus === "payment-pending" ? "bg-yellow-50 border-2 border-yellow-500" :
            scanStatus === "not-found" ? "bg-red-50 border-2 border-red-500" :
            "bg-white"
          }`}>
            
            {/* ICONO + MENSAJE */}
            <div className="flex items-start gap-4">
              {scanStatus === "validating" && (
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 flex-shrink-0" />
              )}
              {scanStatus === "success" && (
                <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0" />
              )}
              {scanStatus === "already-used" && (
                <AlertCircle className="h-8 w-8 text-orange-600 flex-shrink-0" />
              )}
              {scanStatus === "payment-pending" && (
                <Clock className="h-8 w-8 text-yellow-600 flex-shrink-0" />
              )}
              {(scanStatus === "error" || scanStatus === "not-found") && (
                <XCircle className="h-8 w-8 text-red-600 flex-shrink-0" />
              )}
              
              <div className="flex-1">
                <h2 className="font-bold text-xl">{message}</h2>
              </div>
            </div>

            {/* INFO DEL TICKET */}
            {ticketInfo && (
              <div className="bg-white rounded-lg p-4 space-y-2 text-sm border">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-semibold">{ticketInfo.buyerName}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    Orden: <strong>#{ticketInfo.orderNumber}</strong>
                  </span>
                </div>

                {ticketInfo.buyerDNI && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">
                      DNI: <strong>{ticketInfo.buyerDNI}</strong>
                    </span>
                  </div>
                )}

                {ticketInfo.validated && ticketInfo.validatedBy && (
                  <div className="pt-2 border-t text-xs text-gray-500">
                    Validada por: {ticketInfo.validatedBy.name}
                  </div>
                )}
              </div>
            )}

            {/* BOTONES DE ACCIÓN */}
            <div className="space-y-2">
              {scanStatus === "payment-pending" && (
                <>
                  <Button
                    onClick={retryScan}
                    className="w-full h-12 bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
                  >
                    🔄 Reintentar validación
                  </Button>
                  <Button
                    onClick={resetScan}
                    variant="outline"
                    className="w-full h-12"
                  >
                    Escanear otra entrada
                  </Button>
                </>
              )}

              {scanStatus === "success" && (
                <Button
                  onClick={resetScan}
                  className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-bold text-lg"
                >
                  ✅ Escanear siguiente
                </Button>
              )}

              {(scanStatus === "already-used" || 
                scanStatus === "error" || 
                scanStatus === "not-found") && (
                <Button
                  onClick={resetScan}
                  className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg"
                >
                  🔄 Escanear otra entrada
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STATS */}
        {scanStatus === "idle" && validationCount > 0 && (
          <div className="bg-white/90 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-600">
              Entradas validadas en esta sesión
            </p>
            <p className="text-3xl font-black text-purple-600">
              {validationCount}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}