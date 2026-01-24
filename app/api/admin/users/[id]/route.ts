import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { hashPassword } from "@/lib/password";

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "OPERATOR", "VIEWER"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  interface SessionUser {
    id: string;
    name?: string;
    email?: string;
    role: "ADMIN" | "OPERATOR" | "VIEWER";
  }
  const me = session.user as SessionUser;
  if (me.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const data: {
    name?: string;
    role?: "ADMIN" | "OPERATOR" | "VIEWER";
    active?: boolean;
    password?: string;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.role !== undefined) data.role = parsed.data.role;
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.password !== undefined)
    data.password = await hashPassword(parsed.data.password);

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  interface SessionUser {
    id: string;
    name?: string;
    email?: string;
    role: "ADMIN" | "OPERATOR" | "VIEWER";
  }
  const me = session.user as SessionUser;
  if (me.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;

  // evitá borrarte a vos mismo sin querer
  if (me.id === id) {
    return NextResponse.json(
      { error: "No podés borrarte a vos mismo" },
      { status: 400 },
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
