import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // Warn before a source file grows past one clear responsibility; split it into sections or helpers.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/types/database.types.ts"],
    rules: { "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }] },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);
