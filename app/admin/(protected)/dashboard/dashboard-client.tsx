// src/app/(admin)/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  Ticket,
  CheckCircle2,
  TrendingUp,
  Download,
  Users,
  Clock,
  Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

interface DashboardStats {
  grossRevenue: number;
  soldCount: number;
  totalAvailable: number;
  available: number;
  validatedCount: number;
  netRevenue: number;
  estimatedMpFee: number;
  ordersPaidCount: number;
}

interface SalesByDay {
  date: string;
  sales: number;
  revenue: number;
  validated: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Stats generales
      const statsRes = await fetch("/api/stats", { cache: "no-store" });
      const statsData = await statsRes.json();

      if (statsData?.success) {
        setStats(statsData.data);
      }

      // Obtener órdenes para calcular ventas por día
      const ordersRes = await fetch("/api/orders", { cache: "no-store" });
      const ordersData = await ordersRes.json();

      if (ordersData?.success) {
        const byDay = calculateSalesByDay(ordersData.orders);
        setSalesByDay(byDay);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      toast.error("Error cargando datos del dashboard");
    } finally {
      setLoading(false);
    }
  };

  const calculateSalesByDay = (
    orders: Array<{
      paymentStatus: string;
      purchaseDate: string;
      quantity: number;
      totalAmount: number | string;
      tickets?: Array<{ validated: boolean }>;
    }>,
  ) => {
    const groupedByDay = new Map<
      string,
      { sales: number; revenue: number; validated: number }
    >();

    orders
      .filter((o) => o.paymentStatus === "COMPLETED")
      .forEach((order) => {
        const date = new Date(order.purchaseDate);
        const dateKey = `${date.getDate()}/${date.getMonth() + 1}`;

        const current = groupedByDay.get(dateKey) || {
          sales: 0,
          revenue: 0,
          validated: 0,
        };

        const validatedCount =
          order.tickets?.filter((t) => t.validated).length || 0;

        groupedByDay.set(dateKey, {
          sales: current.sales + order.quantity,
          revenue: current.revenue + Number(order.totalAmount),
          validated: current.validated + validatedCount,
        });
      });

    // Convertir a array y ordenar por fecha
    const result = Array.from(groupedByDay.entries())
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => {
        const [dayA, monthA] = a.date.split("/").map(Number);
        const [dayB, monthB] = b.date.split("/").map(Number);
        if (monthA !== monthB) return monthA - monthB;
        return dayA - dayB;
      })
      .slice(-7); // Últimos 7 días

    return result;
  };

  const exportDashboard = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/reports/export?type=financial");

      if (!response.ok) throw new Error("Error exportando");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Reporte exportado");
    } catch (err) {
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  const conversionRate = useMemo(() => {
    if (!stats) return 0;
    return (stats.validatedCount / Math.max(stats.soldCount, 1)) * 100;
  }, [stats]);

  const avgPerOrder = useMemo(() => {
    if (!stats) return 0;
    return stats.grossRevenue / Math.max(stats.ordersPaidCount, 1);
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-purple-600 mb-4" />
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  const pieData = [{ name: "General", value: 100 }];

  const validationData = [
    { name: "Válidas", value: stats?.validatedCount ?? 0, color: "#10b981" },
    {
      name: "Pendientes",
      value: Math.max(
        (stats?.soldCount ?? 0) - (stats?.validatedCount ?? 0),
        0,
      ),
      color: "#f59e0b",
    },
    { name: "Canceladas", value: 0, color: "#ef4444" },
  ];

  const total = (stats?.soldCount ?? 0) + (stats?.available ?? 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Panel de Administración
          </h1>
          <p className="text-gray-600 mt-1">Carnaval 2026</p>
        </div>
        <button
          onClick={exportDashboard}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Exportar
            </>
          )}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Recaudado */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-8 h-8 text-blue-600" />
            {salesByDay.length > 0 &&
              salesByDay[salesByDay.length - 1].revenue >
                (salesByDay[salesByDay.length - 2]?.revenue || 0) && (
                <TrendingUp className="w-5 h-5 text-green-500" />
              )}
          </div>
          <p className="text-sm text-gray-600 mb-1">Total Recaudado</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCurrency(stats?.grossRevenue ?? 0)}
          </p>
          <div className="mt-4">
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByDay}>
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Entradas Vendidas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <Ticket className="w-8 h-8 text-orange-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Entradas Vendidas</p>
          <p className="text-3xl font-bold text-gray-900">
            {stats?.soldCount ?? 0}{" "}
            <span className="text-lg text-gray-500">/ {total || 0}</span>
          </p>
          <div className="mt-4">
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByDay}>
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Entradas Validadas */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 mb-1">Entradas Validadas</p>
          <p className="text-3xl font-bold text-gray-900">
            {stats?.validatedCount ?? 0}
          </p>
          <div className="mt-4">
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesByDay}>
                  <Line
                    type="monotone"
                    dataKey="validated"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tasa de Conversión */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <span className="text-green-600 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">Tasa de Conversión</p>
          <p className="text-3xl font-bold text-gray-900">
            {conversionRate.toFixed(1)}%
          </p>
          <div className="mt-4">
            <div className="h-12 flex items-center">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(conversionRate, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ventas por Día */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Ventas por Día</h3>
          {salesByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#666" />
                <YAxis stroke="#666" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                  formatter={(value) =>
                    value ? formatCurrency(value as number) : "$0"
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Recaudación"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No hay datos de ventas aún
            </div>
          )}
        </div>

        {/* Ventas por Tipo */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Ventas por Tipo</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                fill="#10b981"
                dataKey="value"
                label={({ name, value }) => `${name} ${value}%`}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill="#10b981" />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Estado de Validaciones */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">Estado de Validaciones</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={validationData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" stroke="#666" />
            <YAxis stroke="#666" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {validationData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-xl shadow-sm border border-yellow-200">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-6 h-6 text-yellow-700" />
            <h3 className="text-lg font-semibold text-yellow-900">
              Ingresos Netos
            </h3>
          </div>
          <p className="text-3xl font-bold text-yellow-900">
            {formatCurrency(stats?.netRevenue ?? 0)}
          </p>
          <p className="text-sm text-yellow-700 mt-2">
            Comisión estimada: {formatCurrency(stats?.estimatedMpFee ?? 0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl shadow-sm border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-blue-700" />
            <h3 className="text-lg font-semibold text-blue-900">
              Ticket Promedio
            </h3>
          </div>
          <p className="text-3xl font-bold text-blue-900">
            {formatCurrency(avgPerOrder)}
          </p>
          <p className="text-sm text-blue-700 mt-2">
            Promedio por orden pagada
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl shadow-sm border border-purple-200">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-purple-700" />
            <h3 className="text-lg font-semibold text-purple-900">
              Personas Ingresadas
            </h3>
          </div>
          <p className="text-3xl font-bold text-purple-900">
            {stats?.validatedCount ?? 0}
          </p>
          <p className="text-sm text-purple-700 mt-2">Total acumulado</p>
        </div>
      </div>
    </div>
  );
}
