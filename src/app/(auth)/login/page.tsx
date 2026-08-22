import { LoginForm } from "./login-form";

export default function LoginPage() {
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
