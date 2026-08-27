"use client";

import { useActionState, useRef } from "react";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { loginAction } from "./actions";

// Matches scripts/seed-test-users.mts — keep in sync if that script's
// credentials ever change.
const TEST_ACCOUNTS = [
  { label: "Support Agent", email: "cs@test.local", password: "password123" },
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
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        <Field label="Email">
          <Input ref={emailRef} id="email" name="email" type="email" required autoComplete="email" icon="at-sign" />
        </Field>
        <Field label="Password">
          <Input ref={passwordRef} id="password" name="password" type="password" required autoComplete="current-password" icon="lock" />
        </Field>
        {state?.error && <p className="font-ui text-small text-danger">{state.error}</p>}
        <Button full type="submit" disabled={pending} icon="log-in">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {/* Test-only helper — never shipped in a production build. */}
      {process.env.NODE_ENV !== "production" && (
        <div className="rounded-md border border-line-hairline p-3">
          <p className="font-ui text-small-strong text-text-strong">Test accounts</p>
          <ul className="mt-2 grid gap-2">
            {TEST_ACCOUNTS.map((account) => (
              <li key={account.email} className="flex items-center justify-between gap-2">
                <span className="font-ui text-small text-text-body">
                  {account.label} — <code className="font-mono text-code">{account.email}</code>
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => fillTestAccount(account.email, account.password)}>
                  Use
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
