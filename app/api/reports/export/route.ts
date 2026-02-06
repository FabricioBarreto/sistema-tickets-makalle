import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "No autorizado" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "sales"; // sales, validations, financial, daily

    let workbook: XLSX.WorkBook;
    let filename: string;

    switch (type) {
      case "sales":
        workbook = await generateSalesReport();
        filename = `reporte-ventas-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;

      case "validations":
        workbook = await generateValidationsReport();
        filename = `reporte-validaciones-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;

      case "financial":
        workbook = await generateFinancialReport();
        filename = `reporte-financiero-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;

      case "daily":
        workbook = await generateDailyReport();
        filename = `reporte-diario-${new Date().toISOString().slice(0, 10)}.xlsx`;
        break;

      default:
        return NextResponse.json(
          { success: false, message: "Tipo de reporte inválido" },
          { status: 400 },
        );
    }

    // Convertir a buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Retornar como descarga
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generando reporte:", error);
    return NextResponse.json(
      { success: false, message: "Error generando reporte" },
      { status: 500 },
    );
  }
}

async function generateSalesReport() {
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "COMPLETED",
    },
    include: {
      tickets: true,
    },
    orderBy: {
      purchaseDate: "desc",
    },
  });

  const data = orders.map((order) => ({
    "Número de Orden": order.orderNumber,
    Comprador: order.buyerName,
    Email: order.buyerEmail,
    Teléfono: order.buyerPhone || "N/A",
    DNI: order.buyerDNI || "N/A",
    Cantidad: order.quantity,
    "Precio Unitario": `$${order.unitPrice}`,
    Total: `$${order.totalAmount}`,
    "Fecha de Compra": new Date(order.purchaseDate).toLocaleString("es-AR"),
    Estado: order.paymentStatus,
    Tickets: order.tickets.length,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ventas");

  return wb;
}

async function generateValidationsReport() {
  const validations = await prisma.validation.findMany({
    include: {
      ticket: {
        include: {
          order: true,
        },
      },
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      timestamp: "desc",
    },
  });

  const data = validations.map((v) => ({
    "Código Ticket": v.ticket.code,
    Orden: v.ticket.order.orderNumber,
    Comprador: v.ticket.order.buyerName,
    DNI: v.ticket.order.buyerDNI || "N/A",
    "Validado por": v.user.name,
    "Email Operador": v.user.email,
    "Fecha/Hora": new Date(v.timestamp).toLocaleString("es-AR"),
    IP: v.ipAddress || "N/A",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Validaciones");

  return wb;
}

async function generateFinancialReport() {
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "COMPLETED",
    },
  });

  const totalRevenue = orders.reduce(
    (sum, o) => sum + Number(o.totalAmount),
    0,
  );
  const estimatedFees = totalRevenue * 0.0599; // 5.99% MercadoPago
  const netRevenue = totalRevenue - estimatedFees;

  const summary = [
    {
      Concepto: "Ingresos Brutos",
      Monto: `$${totalRevenue.toFixed(2)}`,
    },
    {
      Concepto: "Comisiones MercadoPago (5.99%)",
      Monto: `-$${estimatedFees.toFixed(2)}`,
    },
    {
      Concepto: "Ingresos Netos",
      Monto: `$${netRevenue.toFixed(2)}`,
    },
    {
      Concepto: "Total Órdenes",
      Monto: orders.length.toString(),
    },
    {
      Concepto: "Tickets Vendidos",
      Monto: orders.reduce((sum, o) => sum + o.quantity, 0).toString(),
    },
    {
      Concepto: "Ticket Promedio",
      Monto: `$${(totalRevenue / orders.length).toFixed(2)}`,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(summary);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resumen Financiero");

  // Agregar detalle de órdenes
  const detail = orders.map((o) => ({
    Orden: o.orderNumber,
    Comprador: o.buyerName,
    Cantidad: o.quantity,
    Total: `$${o.totalAmount}`,
    Fecha: new Date(o.purchaseDate).toLocaleDateString("es-AR"),
  }));

  const wsDetail = XLSX.utils.json_to_sheet(detail);
  XLSX.utils.book_append_sheet(wb, wsDetail, "Detalle Órdenes");

  return wb;
}

async function generateDailyReport() {
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "COMPLETED",
    },
    orderBy: {
      purchaseDate: "asc",
    },
  });

  // Agrupar por día
  const byDay = new Map<string, { sales: number; revenue: number }>();

  orders.forEach((order) => {
    const day = new Date(order.purchaseDate).toLocaleDateString("es-AR");
    const current = byDay.get(day) || { sales: 0, revenue: 0 };
    byDay.set(day, {
      sales: current.sales + order.quantity,
      revenue: current.revenue + Number(order.totalAmount),
    });
  });

  const data = Array.from(byDay.entries()).map(([date, stats]) => ({
    Fecha: date,
    "Tickets Vendidos": stats.sales,
    Recaudación: `$${stats.revenue.toFixed(2)}`,
    "Promedio por Ticket": `$${(stats.revenue / stats.sales).toFixed(2)}`,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ventas por Día");

  return wb;
}
