import { expect, test } from "@playwright/test";

test("web app manifest is installable", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/");
  expect(m.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBeTruthy();
  expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBeTruthy();
});

test("service worker is served with the right scope header", async ({ request }) => {
  const res = await request.get("/serwist/sw.js");
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["service-worker-allowed"]).toBe("/");
  expect(res.headers()["content-type"]).toContain("javascript");
});

test("iOS meta tags are present", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute("content", "black-translucent");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).toContain("viewport-fit=cover");
});
