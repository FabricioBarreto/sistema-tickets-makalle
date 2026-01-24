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
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesByDay, setSalesByDay] = useState<SalesByDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      const data = await response.json();

      if (data?.success) setStats(data.data);

      // TODO: reemplazar por data real desde API (ventas por día)
      setSalesByDay([
        { date: "4 Feb", sales: 120, revenue: 240000 },
        { date: "5 Feb", sales: 150, revenue: 300000 },
        { date: "6 Feb", sales: 180, revenue: 360000 },
        { date: "7 Feb", sales: 280, revenue: 560000 },
        { date: "8 Feb", sales: 200, revenue: 400000 },
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const conversionRate = useMemo(() => {
    if (!stats) return 0;
    // Conversión = validadas / vendidas (si querés vendidas/disponibles, lo cambiamos)
    return (stats.validatedCount / Math.max(stats.soldCount, 1)) * 100;
  }, [stats]);

  const avgPerOrder = useMemo(() => {
    if (!stats) return 0;
    return stats.grossRevenue / Math.max(stats.ordersPaidCount, 1);
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  // Pie: solo GENERAL (100%)
  const pieData = [{ name: "General", value: 100 }];

  // Estado de validaciones: validadas vs pendientes
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

  // Para mostrar total = vendidas + disponibles restantes
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
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Recaudado */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-8 h-8 text-blue-600" />
            <TrendingUp className="w-5 h-5 text-green-500" />
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
                <LineChart
                  data={salesByDay.map((d, i) => ({
                    ...d,
                    validated: Math.floor(d.sales * 0.8),
                  }))}
                >
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
            <div className="h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={salesByDay.map((d, i) => ({ ...d, rate: 70 + i * 2 }))}
                >
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#a855f7"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ventas por Día */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Ventas por Día</h3>
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
                formatter={(value: number | undefined) => formatCurrency(value ?? 0)}
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
