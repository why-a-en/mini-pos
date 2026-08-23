import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Real validation (getSessionUser), not cookie presence — see src/proxy.ts
  // for why that distinction is what stops this from looping.
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Mini POS</h1>
          <p className="text-sm text-neutral-500">Sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
