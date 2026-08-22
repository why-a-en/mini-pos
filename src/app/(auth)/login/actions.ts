"use server";

import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

export type LoginActionState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const result = await login(email, password);
  if (!result.ok) return { error: result.error };

  redirect("/");
}
