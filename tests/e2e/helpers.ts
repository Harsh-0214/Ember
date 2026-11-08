import { expect, type Page } from "@playwright/test";

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Creates a fresh confirmed user (via the admin API when a service role key is
 * set) and signs in through the UI.
 */
export async function signIn(page: Page): Promise<{ email: string; password: string }> {
  const email = `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  const password = "e2e-password-123";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key) {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    // The local mock doesn't implement the admin API; it accepts any credentials.
    if (!res.ok && res.status !== 404) throw new Error(`admin createUser failed: ${res.status}`);
  }
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(onboarding)?(\?.*)?$/);
  return { email, password };
}

export async function completeOnboarding(page: Page) {
  await page.waitForURL(/\/onboarding/);
  await page.getByRole("radio", { name: /Metric/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Lose fat/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /^Male/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Birth date").fill("1990-05-15");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Height (cm)").fill("180");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Weight \(kg\)/).fill("90");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Goal weight/).fill("80");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Moderately active/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Steady/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("calories per day")).toBeVisible();
  await page.getByRole("button", { name: "Start tracking" }).click();
  await page.waitForURL(/\/\?welcome=1/);
}
