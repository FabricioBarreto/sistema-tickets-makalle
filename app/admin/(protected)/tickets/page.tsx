"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import {
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

interface Ticket {
  id: string;
  code: string;
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerDNI: string;
  quantity: number;
  price: string;
  validated: boolean;
  validatedAt?: string;
  purchaseDate: string;
  paymentStatus: string;
  validatedBy?: {
    name: string;
  };
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "validated" | "pending"
  >("all");

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [tickets, searchTerm, filterStatus]);

  const fetchTickets = async () => {
    try {
      const res = await fetch("/api/tickets");
      const data = await res.json();
      if (data.success) {
        setTickets(data.tickets);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    // Filtrar por estado
    if (filterStatus === "validated") {
      filtered = filtered.filter((t) => t.validated);
    } else if (filterStatus === "pending") {
      filtered = filtered.filter((t) => !t.validated);
    }

    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.buyerName.toLowerCase().includes(term) ||
          t.buyerEmail.toLowerCase().includes(term) ||
          t.buyerDNI.includes(term) ||
          t.orderNumber.toLowerCase().includes(term) ||
          t.code.toLowerCase().includes(term),
      );
    }

    setFilteredTickets(filtered);
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");

    const data = filteredTickets.map((t) => ({
      Código: t.code,
      Orden: t.orderNumber,
      Comprador: t.buyerName,
      Email: t.buyerEmail,
      DNI: t.buyerDNI,
      "Fecha compra": new Date(t.purchaseDate).toLocaleString("es-AR"),
      "Estado pago": t.paymentStatus,
      Validada: t.validated ? "SI" : "NO",
      "Validada el": t.validatedAt
        ? new Date(t.validatedAt).toLocaleString("es-AR")
        : "",
      "Validada por": t.validatedBy?.name ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tickets");
    XLSX.writeFile(wb, `tickets_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const getStatusBadge = (ticket: Ticket) => {
    if (ticket.validated) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Validada
        </span>
      );
    } else if (ticket.paymentStatus === "COMPLETED") {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          Pendiente
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
          <XCircle className="h-3 w-3 mr-1" />
          Sin pagar
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Entradas
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona todas las entradas del evento
          </p>
        </div>
        <Button
          className="bg-purple-600 hover:bg-purple-700"
          onClick={exportExcel}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-600">Total Entradas</p>
          <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Validadas</p>
          <p className="text-2xl font-bold text-green-600">
            {tickets.filter((t) => t.validated).length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-600">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-600">
            {
              tickets.filter(
                (t) => !t.validated && t.paymentStatus === "COMPLETED",
              ).length
            }
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por nombre, email, DNI, orden o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              onClick={() => setFilterStatus("all")}
              className={filterStatus === "all" ? "bg-purple-600" : ""}
            >
              Todas
            </Button>
            <Button
              variant={filterStatus === "validated" ? "default" : "outline"}
              onClick={() => setFilterStatus("validated")}
              className={
                filterStatus === "validated"
                  ? "bg-green-600 hover:bg-green-700"
                  : ""
              }
            >
              Validadas
            </Button>
            <Button
              variant={filterStatus === "pending" ? "default" : "outline"}
              onClick={() => setFilterStatus("pending")}
              className={
                filterStatus === "pending"
                  ? "bg-yellow-600 hover:bg-yellow-700"
                  : ""
              }
            >
              Pendientes
            </Button>
          </div>
        </div>
      </Card>

      {/* Tickets Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Código
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Comprador
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  DNI
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Fecha
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <p className="font-mono text-sm font-semibold text-gray-900">
                      {ticket.code}
                    </p>
                    <p className="text-xs text-gray-500">
                      {ticket.orderNumber}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-medium text-gray-900">
                      {ticket.buyerName}
                    </p>
                    <p className="text-xs text-gray-500">{ticket.buyerEmail}</p>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {ticket.buyerDNI}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900">
                    {new Date(ticket.purchaseDate).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-4">{getStatusBadge(ticket)}</td>
                  <td className="px-4 py-4">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredTickets.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No se encontraron entradas</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
