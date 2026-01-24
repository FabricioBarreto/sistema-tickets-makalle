import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface AdminUser {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return {
      ok: false as const,
      res: NextResponse.json({ error: "No autorizado" }, { status: 401 }),
    };
  const me = session.user as AdminUser;
  if (me.role !== "ADMIN")
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  return { ok: true as const };
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  let cfg = await prisma.systemConfig.findFirst();

  // Si no existe, creamos una default razonable
  if (!cfg) {
    cfg = await prisma.systemConfig.create({
      data: {
        ticketPrice: 2000,
        totalAvailable: 1000,
        maxPerPurchase: 10,
        salesEnabled: true,
        eventName: "Carnaval Makalle 2026",
        eventLocation: "Anfiteatro Municipal",
        eventDate: new Date("2026-02-14T20:00:00"),
        emailFrom: "noreply@carnaval.com",
        emailEnabled: true,
      },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      ...cfg,
      ticketPrice: Number(cfg.ticketPrice),
      eventDate: cfg.eventDate.toISOString(),
    },
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;

  try {
    const body = await req.json();

    // Obtener configuración actual
    let current = await prisma.systemConfig.findFirst();

    // Si no existe, crear una
    if (!current) {
      current = await prisma.systemConfig.create({
        data: {
          ticketPrice: 2000,
          totalAvailable: 1000,
          maxPerPurchase: 10,
          salesEnabled: true,
          eventName: "Carnaval Makalle 2026",
          eventLocation: "Anfiteatro Municipal",
          eventDate: new Date("2026-02-14T20:00:00"),
          emailFrom: "noreply@carnaval.com",
          emailEnabled: true,
        },
      });
    }

    // Preparar datos para actualizar (solo lo que viene en el body)
    type UpdateData = {
      ticketPrice?: number;
      totalAvailable?: number;
      maxPerPurchase?: number;
      salesEnabled?: boolean;
      eventName?: string;
      eventDate?: Date;
      eventLocation?: string;
      emailFrom?: string | null;
      emailEnabled?: boolean;
    };
    const updateData: UpdateData = {};

    // Entradas
    if (body.ticketPrice !== undefined) {
      updateData.ticketPrice = Number(body.ticketPrice);
    }
    if (body.totalAvailable !== undefined) {
      updateData.totalAvailable = Number(body.totalAvailable);
    }
    if (body.maxPerPurchase !== undefined) {
      updateData.maxPerPurchase = Number(body.maxPerPurchase);
    }
    if (body.salesEnabled !== undefined) {
      updateData.salesEnabled = Boolean(body.salesEnabled);
    }

    // Evento
    if (body.eventName !== undefined) {
      updateData.eventName = String(body.eventName);
    }
    if (body.eventDate !== undefined) {
      updateData.eventDate = new Date(body.eventDate);
    }
    if (body.eventLocation !== undefined) {
      updateData.eventLocation = String(body.eventLocation);
    }

    // Email
    if (body.emailFrom !== undefined) {
      updateData.emailFrom = body.emailFrom ? String(body.emailFrom) : null;
    }
    if (body.emailEnabled !== undefined) {
      updateData.emailEnabled = Boolean(body.emailEnabled);
    }

    // ❌ YA NO SE GUARDAN EN DB (están en .env)
    // Mercado Pago credentials removed

    // Validaciones básicas
    if (updateData.ticketPrice !== undefined && updateData.ticketPrice < 0) {
      return NextResponse.json(
        { success: false, error: "El precio no puede ser negativo" },
        { status: 400 },
      );
    }

    if (
      updateData.totalAvailable !== undefined &&
      updateData.totalAvailable < 0
    ) {
      return NextResponse.json(
        { success: false, error: "El total disponible no puede ser negativo" },
        { status: 400 },
      );
    }

    if (
      updateData.maxPerPurchase !== undefined &&
      (updateData.maxPerPurchase < 1 || updateData.maxPerPurchase > 1000)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "El máximo por compra debe estar entre 1 y 1000",
        },
        { status: 400 },
      );
    }

    if (
      updateData.eventDate !== undefined &&
      isNaN(updateData.eventDate.getTime())
    ) {
      return NextResponse.json(
        { success: false, error: "Fecha de evento inválida" },
        { status: 400 },
      );
    }

    // Actualizar
    const saved = await prisma.systemConfig.update({
      where: { id: current.id },
      data: updateData,
    });

    // ✅ Registrar en audit log (con verificación)
    try {
      const session = await getServerSession(authOptions);
      if (session?.user?.id) {
        // Verificar que el usuario existe antes de crear el log
        const userExists = await prisma.user.findUnique({
          where: { id: session.user.id },
        });

        if (userExists) {
          await prisma.auditLog.create({
            data: {
              userId: session.user.id,
              userName: session.user.name || "Unknown",
              userEmail: session.user.email || "unknown@example.com",
              action: "UPDATE",
              entity: "SystemConfig",
              entityId: saved.id,
              newValue: JSON.stringify(updateData),
              ipAddress: req.headers.get("x-forwarded-for") || "unknown",
              userAgent: req.headers.get("user-agent") || "unknown",
            },
          });
        } else {
          console.warn(`⚠️ User ${session.user.id} not found in database`);
        }
      }
    } catch (auditError) {
      console.error("❌ Error creating audit log:", auditError);
      // No fallar la request si el audit log falla
    }

    return NextResponse.json({
      success: true,
      message: "Configuración actualizada",
      data: {
        ...saved,
        ticketPrice: Number(saved.ticketPrice),
        eventDate: saved.eventDate.toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error("Error PUT /api/admin/settings:", error);
    let errorMessage = "Error al guardar";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
