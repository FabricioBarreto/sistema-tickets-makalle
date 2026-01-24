"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onError?: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrCodeRegionId = "qr-reader";

  const startScanning = async () => {
    try {
      setError(null);

      const html5QrCode = new Html5Qrcode(qrCodeRegionId);
      scannerRef.current = html5QrCode;

      // Configuración optimizada para móviles
      const config = {
        fps: 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.8);
          return {
            width: qrboxSize,
            height: qrboxSize,
          };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText);
          stopScanning();
        },
        (errorMessage) => {
          // Ignorar errores de escaneo continuo
        },
      );

      setIsScanning(true);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Error al iniciar la cámara";
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <div className="space-y-4">
      <div
        id={qrCodeRegionId}
        className="rounded-xl overflow-hidden border-4 border-purple-300 bg-gray-900 mx-auto"
        style={{
          minHeight: "250px",
          maxWidth: "100%",
        }}
      />

      {error && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-900 text-sm font-semibold">{error}</p>
              <p className="text-red-700 text-xs mt-1">
                Asegúrate de permitir el acceso a la cámara en tu navegador
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!isScanning ? (
          <Button
            onClick={startScanning}
            className="w-full h-14 text-base font-semibold bg-purple-600 hover:bg-purple-700"
            size="lg"
          >
            <Camera className="mr-2 h-5 w-5" />
            Iniciar Cámara
          </Button>
        ) : (
          <Button
            onClick={stopScanning}
            variant="destructive"
            className="w-full h-14 text-base font-semibold"
            size="lg"
          >
            <CameraOff className="mr-2 h-5 w-5" />
            Detener Cámara
          </Button>
        )}
      </div>

      {isScanning && (
        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
          <p className="text-sm text-blue-900 text-center font-medium">
            📱 Apunta la cámara al código QR
          </p>
        </div>
      )}
    </div>
  );
}
