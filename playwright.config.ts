import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: "off", screenshot: "off" },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
        url: `${baseURL}/login`,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
