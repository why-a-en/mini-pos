import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The service layer must stay callable from outside a Next.js request —
  // by an HTTP handler, a background job, or a test. That only holds if the
  // boundary is enforced rather than remembered, so this makes a stray
  // import a build failure. See docs/ARCHITECTURE_ROADMAP.md §4 (Stage 1).
  {
    files: ["src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["next", "next/*", "server-only", "@/app/*", "@/components/*"],
              message:
                "src/services must not depend on Next.js or the UI. Keep framework concerns (revalidatePath, redirect, cookies) in the Server Action that calls this.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees carry their own node_modules and .next output. Without
    // this, `pnpm lint` walks them and reports thousands of errors from
    // generated and third-party files, which made the command unusable.
    ".claude/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
