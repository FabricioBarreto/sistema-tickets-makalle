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
    if (role === "OPERATOR") redirect("/admin/validate");
    redirect("/admin/login");
  }

  return session;
}
