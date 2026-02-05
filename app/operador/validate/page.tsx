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

type ScanStatus =
  | "idle"
  | "validating"
  | "success"
  | "error"
  | "already-used"
  | "payment-pending";

export default function ValidatePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [message, setMessage] = useState("");
  const [ticketInfo, setTicketInfo] = useState<TicketInfo | null>(null);
  const [validationCount, setValidationCount] = useState(0);

  // 🔥 CLAVE: controla si la cámara está prendida o apagada
  const [scannerEnabled, setScannerEnabled] = useState(true);

  // Anti-spam extra (por si algún browser se pone loco)
  const lastScanTimeRef = useRef(0);

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
    // 🧨 BLOQUEO TOTAL DE LOOP
    if (!scannerEnabled) return;
    if (scanStatus === "validating") return;

    // Cooldown hard (mobile safety)
    const now = Date.now();
    if (now - lastScanTimeRef.current < 1500) return;
    lastScanTimeRef.current = now;

    // 🔥 APAGAMOS LA CÁMARA INMEDIATAMENTE
    setScannerEnabled(false);
    setScanStatus("validating");
    setMessage("Verificando entrada...");
    setTicketInfo(null);

    try {
      const { response, data } = await validateCode(decodedText);

      if (response.ok && data.success) {
        setScanStatus("success");
        setMessage("✅ Entrada validada correctamente");
        setTicketInfo(data.ticket);
        setValidationCount((prev) => prev + 1);
        return;
      }

      if (response.status === 409 && data?.error === "PAYMENT_PENDING") {
        setScanStatus("payment-pending");
        setMessage("⏳ Pago pendiente: todavía no fue confirmado");
        setTicketInfo(data.ticket ?? null);
        return;
      }

      if (data.message?.includes("ya fue utilizada")) {
        setScanStatus("already-used");
        setMessage("⚠️ Entrada ya utilizada anteriormente");
        setTicketInfo(data.ticket);
        return;
      }

      setScanStatus("error");
      setMessage(data.message || "Error al validar la entrada");
    } catch {
      setScanStatus("error");
      setMessage("Error de conexión. Intenta nuevamente.");
    }
  };

  // 🔁 Reintentar MISMO QR (pago pendiente)
  const retryScan = () => {
    setScanStatus("idle");
    setMessage("");
    setTicketInfo(null);
    setScannerEnabled(true);
  };

  // 🔄 Escanear otro QR
  const resetScan = () => {
    setScanStatus("idle");
    setMessage("");
    setTicketInfo(null);
    setScannerEnabled(true);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/operador/login");
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
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
            <ShieldCheck className="text-purple-600" />
            <div>
              <h1 className="font-black">Validador QR</h1>
              <p className="text-xs">{session.user.name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* CONTENIDO */}
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* SCANNER */}
        <div className="bg-white rounded-xl shadow p-4">
          {scannerEnabled ? (
            <QRScanner
              onScan={handleScan}
              onError={(err) => {
                setScanStatus("error");
                setMessage(err);
                setScannerEnabled(false);
              }}
            />
          ) : (
            <div className="text-center text-gray-500 py-10">
              Cámara pausada
            </div>
          )}
        </div>

        {/* RESULTADO */}
        {scanStatus !== "idle" && (
          <div className="bg-white rounded-xl shadow p-4 space-y-4">
            <h2 className="font-bold text-lg">{message}</h2>

            {ticketInfo && (
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Comprador:</strong> {ticketInfo.buyerName}
                </p>
                <p>
                  <strong>Orden:</strong> #{ticketInfo.orderNumber}
                </p>
              </div>
            )}

            {scanStatus === "payment-pending" ? (
              <Button
                onClick={retryScan}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                Reintentar
              </Button>
            ) : (
              <Button
                onClick={resetScan}
                className="w-full bg-purple-600 hover:bg-purple-700"
              >
                Escanear siguiente
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
