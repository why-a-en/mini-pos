import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Real validation (getSessionUser), not cookie presence — see src/proxy.ts
  // for why that distinction is what stops this from looping.
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="ds-grain-surface flex min-h-full flex-1 items-center justify-center bg-surface-page p-4">
      <div className="w-full max-w-[360px] space-y-6">
        <div className="space-y-1">
          <Logo size={32} wordmark />
          <p className="font-ui text-small text-text-muted">Order and product coordination.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
