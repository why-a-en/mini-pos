"use client";

import { useActionState, useRef } from "react";
import { fieldInputClass } from "@/components/form-field";
import { loginAction } from "./actions";

// Matches scripts/seed-test-users.mts — keep in sync if that script's
// credentials ever change.
const TEST_ACCOUNTS = [
  { label: "Customer Service", email: "cs@test.local", password: "password123" },
  { label: "Supplier", email: "supplier@test.local", password: "password123" },
] as const;

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fillTestAccount(email: string, password: string) {
    if (emailRef.current) emailRef.current.value = email;
    if (passwordRef.current) passwordRef.current.value = password;
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={fieldInputClass}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={fieldInputClass}
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-md bg-neutral-900 px-3 text-base font-medium text-white disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Test-only helper — never shipped in a production build. */}
      {process.env.NODE_ENV !== "production" && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-3 text-sm">
          <p className="font-medium text-neutral-700">Test accounts</p>
          <ul className="mt-2 space-y-2">
            {TEST_ACCOUNTS.map((account) => (
              <li key={account.email} className="flex items-center justify-between gap-2">
                <span className="text-neutral-600">
                  {account.label} — <code className="text-xs">{account.email}</code>
                </span>
                <button
                  type="button"
                  onClick={() => fillTestAccount(account.email, account.password)}
                  className="shrink-0 rounded-md border border-neutral-300 px-2 py-1 text-xs"
                >
                  Use
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
