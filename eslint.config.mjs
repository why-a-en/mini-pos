import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
