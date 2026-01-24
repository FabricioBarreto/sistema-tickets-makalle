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
} from "lucide-react";

export default function ReportsPage() {
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
        <Card className="p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-100 rounded-lg p-3">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Reporte de Ventas</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Detalle completo de todas las ventas
                </p>
              </div>
            </div>
          </div>
          <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
            <Download className="mr-2 h-4 w-4" />
            Descargar Excel
          </Button>
        </Card>

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
                  Historial de entradas validadas
                </p>
              </div>
            </div>
          </div>
          <Button className="w-full mt-4 bg-green-600 hover:bg-green-700">
            <Download className="mr-2 h-4 w-4" />
            Descargar Excel
          </Button>
        </Card>

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
              </div>
            </div>
          </div>
          <Button className="w-full mt-4 bg-purple-600 hover:bg-purple-700">
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
        </Card>

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
              </div>
            </div>
          </div>
          <Button className="w-full mt-4 bg-orange-600 hover:bg-orange-700">
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
        </Card>
      </div>

      <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="flex items-start space-x-4">
          <FileText className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-lg mb-2">Personalizar Reporte</h3>
            <p className="text-sm text-gray-600 mb-4">
              Selecciona campos específicos y rangos de fecha para crear
              reportes personalizados
            </p>
            <Button
              variant="outline"
              className="border-purple-300 hover:bg-purple-100"
            >
              Crear Reporte Personalizado
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
