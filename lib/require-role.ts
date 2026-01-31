import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireRole(
  allowed: Array<"ADMIN" | "OPERATOR" | "VIEWER">,
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/admin/login");

  const role = session.user.role as "ADMIN" | "OPERATOR" | "VIEWER";

  if (!allowed.includes(role)) {
    // Si es operador, mandarlo a su portal
    if (role === "OPERATOR") redirect("/operador/validate");

    // Si no tiene permiso, mandarlo al login
    redirect("/admin/login");
  }

  return session;
}
