import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

// Helpers
function parseDateRange(from?: string | null, to?: string | null) {
  // from/to vienen como YYYY-MM-DD
  // Interpretamos rango inclusivo (00:00 -> 23:59:59.999)
  const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;
  return { fromDate, toDate };
}

function csvEscape(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (
    s.includes('"') ||
    s.includes(",") ||
    s.includes("\n") ||
    s.includes("\r")
  ) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSV(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const type = (searchParams.get("type") ?? "sales").toLowerCase();
    const format = (searchParams.get("format") ?? "csv").toLowerCase();
    const { fromDate, toDate } = parseDateRange(
      searchParams.get("from"),
      searchParams.get("to"),
    );

    if (!["sales", "tickets", "validations"].includes(type)) {
      return NextResponse.json({ error: "type inválido" }, { status: 400 });
    }
    if (!["csv", "xlsx"].includes(format)) {
      return NextResponse.json({ error: "format inválido" }, { status: 400 });
    }

    // Filtros de fecha (según entidad)
    const dateFilter: Record<string, Date> = {};
    if (fromDate) dateFilter.gte = fromDate;
    if (toDate) dateFilter.lte = toDate;

    let rows: Record<string, unknown>[] = [];
    let filenameBase = "";

    if (type === "sales") {
      filenameBase = "reporte_ventas";
      const orders = await prisma.order.findMany({
        where: {
          ...(fromDate || toDate ? { purchaseDate: dateFilter } : {}),
        },
        orderBy: { purchaseDate: "desc" },
        select: {
          orderNumber: true,
          buyerName: true,
          buyerEmail: true,
          buyerDNI: true,
          buyerPhone: true,
          quantity: true,
          unitPrice: true,
          totalAmount: true,
          paymentStatus: true,
          mercadoPagoStatus: true,
          mercadoPagoId: true,
          purchaseDate: true,
        },
      });

      rows = orders.map((o) => ({
        orderNumber: o.orderNumber,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        buyerDNI: o.buyerDNI || "N/A", // ✅ Muestra N/A si está vacío
        buyerPhone: o.buyerPhone || "N/A", // ✅ También puede estar vacío
        quantity: o.quantity,
        unitPrice: Number(o.unitPrice),
        totalAmount: Number(o.totalAmount),
        paymentStatus: o.paymentStatus,
        mercadoPagoStatus: o.mercadoPagoStatus ?? "",
        mercadoPagoId: o.mercadoPagoId ?? "",
        purchaseDate: o.purchaseDate.toISOString(),
      }));
    }

    if (type === "tickets") {
      filenameBase = "reporte_tickets";
      const tickets = await prisma.ticket.findMany({
        where: {
          ...(fromDate || toDate ? { createdAt: dateFilter } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              orderNumber: true,
              buyerName: true,
              buyerEmail: true,
              buyerDNI: true,
              buyerPhone: true,
              paymentStatus: true,
              purchaseDate: true,
            },
          },
        },
      });

      rows = tickets.map((t) => ({
        ticketCode: t.code,
        ticketStatus: t.status,
        validated: t.status === "VALIDATED",
        validatedAt: t.validatedAt ? t.validatedAt.toISOString() : "",
        orderNumber: t.order.orderNumber,
        buyerName: t.order.buyerName,
        buyerEmail: t.order.buyerEmail,
        buyerDNI: t.order.buyerDNI || "N/A", // ✅ Opcional
        buyerPhone: t.order.buyerPhone || "N/A", // ✅ Opcional
        orderPaymentStatus: t.order.paymentStatus,
        orderPurchaseDate: t.order.purchaseDate.toISOString(),
        createdAt: t.createdAt.toISOString(),
      }));
    }

    if (type === "validations") {
      filenameBase = "reporte_validaciones";
      const validations = await prisma.validation.findMany({
        where: {
          ...(fromDate || toDate ? { timestamp: dateFilter } : {}),
        },
        orderBy: { timestamp: "desc" },
        include: {
          ticket: {
            include: {
              order: {
                select: {
                  orderNumber: true,
                  buyerName: true,
                  buyerEmail: true,
                  buyerDNI: true,
                },
              },
            },
          },
          user: { select: { name: true, email: true, role: true } },
        },
      });

      rows = validations.map((v) => ({
        timestamp: v.timestamp.toISOString(),
        ticketCode: v.ticket.code,
        orderNumber: v.ticket.order.orderNumber,
        buyerName: v.ticket.order.buyerName,
        buyerEmail: v.ticket.order.buyerEmail,
        buyerDNI: v.ticket.order.buyerDNI || "N/A", // ✅ Opcional
        validatedByName: v.user.name,
        validatedByEmail: v.user.email,
        validatedByRole: v.user.role,
        ipAddress: v.ipAddress ?? "",
        userAgent: v.userAgent ?? "",
      }));
    }

    const fromStr = searchParams.get("from") ?? "all";
    const toStr = searchParams.get("to") ?? "all";
    const filename = `${filenameBase}_${fromStr}_${toStr}.${format}`;

    // Return CSV
    if (format === "csv") {
      const csv = toCSV(rows);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // Return XLSX
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("export error:", err);
    return NextResponse.json(
      { error: "Error exportando reporte" },
      { status: 500 },
    );
  }
}
