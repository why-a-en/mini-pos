import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

// "/" has no content of its own — each role lands on its own dedicated
// screen (PRD §4): Supplier → Purchase Queue, Customer Service → Orders.
export default async function DashboardHome() {
  const user = await requireUser();
  redirect(user.role === "supplier" ? "/purchase-queue" : "/orders");
}
