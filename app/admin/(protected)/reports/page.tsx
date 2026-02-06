"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Download,
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ReportType = "sales" | "validations" | "financial" | "daily";

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<ReportType | null>(null);

  const downloadReport = async (type: ReportType) => {
    setDownloading(type);

    try {
      const response = await fetch(`/api/reports/export?type=${type}`);

      if (!response.ok) {
        throw new Error("Error descargando el reporte");
      }

      // Obtener el blob
      const blob = await response.blob();

      // Crear URL temporal
      const url = window.URL.createObjectURL(blob);

      // Crear link temporal y hacer click
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte-${type}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();

      // Limpiar
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Reporte descargado exitosamente");
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al descargar el reporte");
    } finally {
      setDownloading(null);
    }
  };

  const isDownloading = (type: ReportType) => downloading === type;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Reportes
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Genera y descarga reportes del evento
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reporte de Ventas */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 rounded-lg p-3">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Reporte de Ventas</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Detalle completo de todas las órdenes pagadas
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Incluye: Orden, comprador, email, teléfono, DNI, cantidad,
                  precios
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => downloadReport("sales")}
            disabled={isDownloading("sales")}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
          >
            {isDownloading("sales") ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Descargar Excel
              </>
            )}
          </Button>
        </Card>

        {/* Reporte de Validaciones */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 rounded-lg p-3">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  Reporte de Validaciones
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Historial completo de entradas validadas
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Incluye: Ticket, comprador, operador, fecha/hora, IP
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => downloadReport("validations")}
            disabled={isDownloading("validations")}
            className="w-full mt-4 bg-green-600 hover:bg-green-700"
          >
            {isDownloading("validations") ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Descargar Excel
              </>
            )}
          </Button>
        </Card>

        {/* Reporte por Fecha */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-purple-100 rounded-lg p-3">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Reporte por Fecha</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Ventas agrupadas por día
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Incluye: Fecha, tickets vendidos, recaudación, promedios
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => downloadReport("daily")}
            disabled={isDownloading("daily")}
            className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
          >
            {isDownloading("daily") ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Descargar Excel
              </>
            )}
          </Button>
        </Card>

        {/* Reporte Financiero */}
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-orange-100 rounded-lg p-3">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Reporte Financiero</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Ingresos, comisiones y netos
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Incluye: Resumen financiero + detalle de órdenes
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => downloadReport("financial")}
            disabled={isDownloading("financial")}
            className="w-full mt-4 bg-orange-600 hover:bg-orange-700"
          >
            {isDownloading("financial") ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Descargar Excel
              </>
            )}
          </Button>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <div className="flex items-start space-x-4">
          <FileText className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-lg mb-2">Información</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                • Todos los reportes se descargan en formato Excel (.xlsx)
              </li>
              <li>• Los datos son en tiempo real desde la base de datos</li>
              <li>
                • El reporte financiero incluye comisiones estimadas de
                Unicobros
              </li>
              <li>• Los reportes solo incluyen órdenes con pago completado</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
