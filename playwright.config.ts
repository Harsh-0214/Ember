import { defineConfig, devices } from "@playwright/test";

/**
 * e2e tests run against a production build connected to a real Supabase
 * project. They need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * and SUPABASE_SERVICE_ROLE_KEY (used to create a throwaway test user).
 * Without them the specs skip themselves.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "off",
  },
  projects: [{ name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium" } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next start -p 3100", port: 3100, reuseExistingServer: true, timeout: 120_000 },
});
