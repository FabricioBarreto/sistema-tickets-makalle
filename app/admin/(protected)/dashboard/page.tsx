import { requireRole } from "@/lib/require-role";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  await requireRole(["ADMIN"]); // SOLO ADMIN
  return <DashboardClient />;
}
