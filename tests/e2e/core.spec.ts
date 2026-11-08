import { expect, test } from "@playwright/test";
import { completeOnboarding, hasSupabase, signIn } from "./helpers";

test.describe("core flows", () => {
  test.skip(!hasSupabase, "Set NEXT_PUBLIC_SUPABASE_URL / ANON_KEY (and SUPABASE_SERVICE_ROLE_KEY) to run e2e tests.");

  test("onboarding → log a food → log a weight", async ({ page }) => {
    await signIn(page);
    await completeOnboarding(page);

    // Today shows targets
    await expect(page.getByRole("img", { name: /calories eaten/ })).toBeVisible();

    // Log a food from the Breakfast "+" (3 taps: +, result, Add)
    await page.getByRole("link", { name: "Add food to Breakfast" }).click();
    await page.getByLabel("Search foods").fill("banana");
    await page.getByRole("button", { name: /^Banana/ }).first().click();
    await expect(page.getByText(/kcal ·/)).toBeVisible();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/Added Banana to Breakfast/)).toBeVisible();
    await page.getByRole("link", { name: "Done" }).click();
    await expect(page.getByRole("heading", { name: /Breakfast/ })).toContainText("105 kcal");

    // Onboarding recorded today's weight; edit it from the Today weigh-in card
    await page.getByRole("button", { name: /Weigh-in 90.0 kg/ }).click();
    await page.getByLabel(/Edit weigh-in/).fill("89.4");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: /Weigh-in 89.4 kg/ })).toBeVisible();

    // Next day: the prompt asks for a new weigh-in
    await page.getByRole("button", { name: "Previous day" }).click();
    await expect(page.getByText(/Yesterday/)).toBeVisible();

    // Recents now offer one-tap logging
    await page.goto("/log");
    await expect(page.getByRole("button", { name: /Log Banana/ })).toBeVisible();
  });
});
