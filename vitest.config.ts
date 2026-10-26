import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["tests/unit/**/*.test.ts"], fileParallelism: false, testTimeout: 15000, hookTimeout: 30000 } });
