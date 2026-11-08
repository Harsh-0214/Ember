import { expect, test } from "@playwright/test";
import { completeOnboarding, hasSupabase, signIn } from "./helpers";

test.describe("food extras", () => {
  test.skip(!hasSupabase, "Set Supabase env vars to run e2e tests.");

  test("unknown barcode → add product → found next time; recipe; saved meal", async ({ page }) => {
    await signIn(page);
    await completeOnboarding(page);

    // Barcode: type it (camera isn't available in CI), product unknown → add it
    const code = "0012345678905";
    await page.goto("/log/scan?meal=0");
    await page.getByLabel("Type a barcode").fill(code);
    await page.getByRole("button", { name: "Look up" }).click();
    await page.getByRole("link", { name: "Add this product" }).click();
    await expect(page.getByLabel("Barcode (optional)", { exact: true })).toHaveValue(code);
    await page.getByLabel("Name", { exact: true }).fill("Test Protein Bar");
    await page.getByLabel("Size (g)", { exact: true }).fill("60");
    await page.getByLabel("Calories (kcal)", { exact: true }).fill("210");
    await page.getByLabel("Protein (g)", { exact: true }).fill("20");
    await page.getByLabel("Carbs (g)", { exact: true }).fill("22");
    await page.getByLabel("Fat (g)", { exact: true }).fill("7");
    await page.getByRole("button", { name: "Save food" }).click();
    // Picker opens for the new food, log it
    await expect(page.getByText("Test Protein Bar").first()).toBeVisible();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/Added Test Protein Bar/)).toBeVisible();

    // Same barcode is now found locally
    await page.goto("/log/scan?meal=1");
    await page.getByLabel("Type a barcode").fill(code);
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeVisible();
    await expect(page.getByText("Test Protein Bar").first()).toBeVisible();

    // Recipe
    await page.goto("/recipes/new");
    await page.getByLabel("Name", { exact: true }).fill("Overnight oats");
    await page.getByLabel("Servings").fill("2");
    await page.getByRole("button", { name: "Add ingredient" }).click();
    await page.getByLabel("Search ingredients").fill("oats");
    await page.getByRole("button", { name: /Oats, rolled, dry/ }).first().click();
    await page.getByRole("button", { name: "Add to recipe" }).click();
    await page.getByRole("button", { name: "Add ingredient" }).click();
    await page.getByLabel("Search ingredients").fill("milk, 2");
    await page.getByRole("button", { name: /Milk, 2%/ }).first().click();
    await page.getByRole("button", { name: "Add to recipe" }).click();
    await expect(page.getByText(/Per serving/)).toBeVisible();
    await page.getByRole("button", { name: "Save recipe" }).click();
    await expect(page.getByText("Recipe saved")).toBeVisible();

    // Recipe is searchable and loggable
    await page.goto("/log?meal=0");
    await page.getByLabel("Search foods").fill("overnight");
    await page.getByRole("button", { name: /Overnight oats/ }).first().click();
    await expect(page.getByRole("radio", { name: /1 serving/ })).toBeVisible();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("link", { name: "Done" }).click();

    // Save breakfast as a meal, then log it in one tap from search
    await page.getByRole("button", { name: "Breakfast options" }).click();
    await page.getByRole("button", { name: /Save as meal/ }).click();
    await page.getByLabel("Meal name").fill("Usual breakfast");
    await page.getByRole("button", { name: "Save meal" }).click();
    await expect(page.getByText(/Meal saved/)).toBeVisible();
    await page.goto("/log?meal=3");
    await page.getByLabel("Search foods").fill("usual");
    await page.getByRole("button", { name: "Log saved meal Usual breakfast" }).click();
    await expect(page.getByText(/Logged Usual breakfast to Snacks/)).toBeVisible();
  });
});
