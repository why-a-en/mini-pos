import { redirect } from "next/navigation";

// "/" has no content of its own — the Supplier's core screen (PRD §6.3) is
// the real landing spot.
export default function DashboardHome() {
  redirect("/orders");
}
