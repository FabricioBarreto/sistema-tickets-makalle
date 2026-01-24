"use client";

import { useState, useEffect } from "react";
import { QRScanner } from "@/components/QRScanner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Camera,
  Keyboard,
  Users,
} from "lucide-react";

interface ValidationResult {
  success: boolean;
  message: string;
  ticket?: {
    id: string;
    orderNumber: string;
    buyerName: string;
    buyerEmail: string;
    buyerDNI: string;
    quantity: number;
    validated: boolean;
    validatedAt?: string;
    validatedBy?: {
      name: string;
    };
  };
}

export default function ValidateClient() {
  const [scanMode, setScanMode] = useState<"camera" | "manual">("manual");
  const [manualCode, setManualCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [validationCount, setValidationCount] = useState(0);

  useEffect(() => {
    fetchValidationCount();
  }, []);

  const fetchValidationCount = async () => {
    try {
      const res = await fetch("/api/tickets?validated=true");
      const data = await res.json();
      setValidationCount(data.tickets?.length || 0);
    } catch (error) {
      console.error("Error fetching validation count:", error);
    }
  };

  const validateTicket = async (qrCode: string) => {
    if (isValidating) return;

    setIsValidating(true);
    setResult(null);

    try {
      const res = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ qrCode: qrCode.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
        if (data.success) {
          setValidationCount((prev) => prev + 1);
        }
      } else {
        setResult({
          success: false,
          message: data.message || "Error al validar la entrada",
          ticket: data.ticket,
        });
      }
    } catch (error) {
      console.error("Error validating ticket:", error);
      setResult({
        success: false,
        message: "Error de conexión. Intenta nuevamente.",
      });
    } finally {
      setIsValidating(false);
      setManualCode("");
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      validateTicket(manualCode);
    }
  };

  const resetValidation = () => {
    setResult(null);
    setManualCode("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-3 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Validar Entradas
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Escanea o ingresa el código manualmente
            </p>
          </div>
          <Card className="p-4 bg-white shadow-lg border-2 border-purple-200">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-xs text-gray-600">Validadas</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600">
                  {validationCount}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Button
            onClick={() => setScanMode("camera")}
            variant={scanMode === "camera" ? "default" : "outline"}
            className={`h-12 sm:h-14 text-sm sm:text-base ${
              scanMode === "camera"
                ? "bg-purple-600 hover:bg-purple-700"
                : "hover:bg-purple-50"
            }`}
          >
            <Camera className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Escanear con </span>Cámara
          </Button>
          <Button
            onClick={() => setScanMode("manual")}
            variant={scanMode === "manual" ? "default" : "outline"}
            className={`h-12 sm:h-14 text-sm sm:text-base ${
              scanMode === "manual"
                ? "bg-purple-600 hover:bg-purple-700"
                : "hover:bg-purple-50"
            }`}
          >
            <Keyboard className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Ingresar </span>Manualmente
          </Button>
        </div>

        {/* Scanner or Manual Input */}
        {!result && (
          <Card className="p-4 sm:p-6 lg:p-8 bg-white shadow-xl border-2 border-gray-200">
            {scanMode === "camera" ? (
              <div className="space-y-4">
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-900 font-medium text-center">
                    📸 Coloca el código QR frente a la cámara
                  </p>
                </div>
                <QRScanner
                  onScan={(code) => validateTicket(code)}
                  onError={(error) => console.error("QR Scanner Error:", error)}
                />
              </div>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-6">
                <div className="space-y-3">
                  <Label
                    htmlFor="qrCode"
                    className="text-base sm:text-lg font-semibold"
                  >
                    Código de Entrada
                  </Label>
                  <Input
                    id="qrCode"
                    type="text"
                    value={manualCode}
                    onChange={(e) =>
                      setManualCode(e.target.value.toUpperCase())
                    }
                    placeholder="Ej: ABC123XYZ"
                    className="text-lg sm:text-xl h-14 sm:h-16 text-center font-mono tracking-wider border-2 focus:border-purple-500"
                    autoFocus
                    disabled={isValidating}
                  />
                  <p className="text-xs sm:text-sm text-gray-500 text-center">
                    Ingresa el código que aparece debajo del QR
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold bg-purple-600 hover:bg-purple-700"
                  disabled={!manualCode.trim() || isValidating}
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    "✓ Validar Entrada"
                  )}
                </Button>
              </form>
            )}
          </Card>
        )}

        {/* Validation Result */}
        {result && (
          <Card
            className={`p-6 sm:p-8 shadow-2xl border-4 ${
              result.success
                ? "bg-green-50 border-green-500"
                : "bg-red-50 border-red-500"
            }`}
          >
            <div className="text-center space-y-4 sm:space-y-6">
              {result.success ? (
                <>
                  <div className="flex justify-center">
                    <div className="bg-green-100 rounded-full p-4 sm:p-6">
                      <CheckCircle2 className="h-16 w-16 sm:h-24 sm:w-24 text-green-600" />
                    </div>
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-green-900">
                    ¡ENTRADA VÁLIDA!
                  </h2>
                  {result.ticket && (
                    <div className="space-y-3 text-left bg-white p-4 sm:p-6 rounded-xl shadow-inner">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1">
                            Comprador:
                          </p>
                          <p className="font-bold text-sm sm:text-base text-gray-900">
                            {result.ticket.buyerName}
                          </p>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1">
                            DNI:
                          </p>
                          <p className="font-bold text-sm sm:text-base text-gray-900">
                            {result.ticket.buyerDNI}
                          </p>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg sm:col-span-2">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1">
                            Email:
                          </p>
                          <p className="font-bold text-sm sm:text-base text-gray-900 break-all">
                            {result.ticket.buyerEmail}
                          </p>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1">
                            N° Orden:
                          </p>
                          <p className="font-bold text-sm sm:text-base text-gray-900">
                            {result.ticket.orderNumber}
                          </p>
                        </div>

                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1">
                            Cantidad:
                          </p>
                          <p className="font-bold text-sm sm:text-base text-gray-900">
                            {result.ticket.quantity} entrada(s)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex justify-center">
                    <div className="bg-red-100 rounded-full p-4 sm:p-6">
                      <XCircle className="h-16 w-16 sm:h-24 sm:w-24 text-red-600" />
                    </div>
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-red-900">
                    ENTRADA NO VÁLIDA
                  </h2>
                  <p className="text-base sm:text-lg text-red-700 font-semibold px-4">
                    {result.message}
                  </p>
                  {result.ticket?.validated && result.ticket.validatedAt && (
                    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-inner">
                      <p className="text-sm sm:text-base text-gray-600 mb-2">
                        ⚠️ Validada anteriormente:
                      </p>
                      <p className="font-bold text-base sm:text-lg text-gray-900">
                        {new Date(result.ticket.validatedAt).toLocaleString(
                          "es-AR",
                          {
                            dateStyle: "medium",
                            timeStyle: "short",
                          },
                        )}
                      </p>
                      {result.ticket.validatedBy && (
                        <p className="text-sm text-gray-600 mt-2">
                          Por:{" "}
                          <span className="font-semibold">
                            {result.ticket.validatedBy.name}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <Button
                onClick={resetValidation}
                size="lg"
                className="w-full h-14 sm:h-16 text-base sm:text-lg font-semibold bg-gray-900 hover:bg-gray-800"
              >
                → Validar Siguiente Entrada
              </Button>
            </div>
          </Card>
        )}

        {/* Loading State */}
        {isValidating && (
          <Card className="p-6 sm:p-8 bg-white shadow-xl">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 sm:h-16 sm:w-16 animate-spin text-purple-600 mx-auto" />
              <p className="text-lg sm:text-xl font-semibold text-gray-900">
                Validando entrada...
              </p>
              <p className="text-sm sm:text-base text-gray-600">
                Por favor espera un momento
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
