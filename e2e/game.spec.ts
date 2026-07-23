import { test, expect } from "@playwright/test";

test("loads the picker with the title and a search box", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Country Fighter" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder(/Search 194 countries/i)).toBeVisible();
});

test("search narrows the country grid", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/Search 194 countries/i).fill("Brazil");
  await expect(page.getByRole("button", { name: "Brazil" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Japan" })).toHaveCount(0);
});

test("picking two countries reveals the versus button and the ready screen", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Brazil" }).click();
  await page.getByRole("button", { name: "Argentina" }).click();

  const vs = page.getByRole("button", { name: /Brazil vs Argentina|Argentina vs Brazil/ });
  await expect(vs).toBeVisible();
  await vs.click();

  await expect(page.getByRole("button", { name: "Fight!" })).toBeVisible();
});

test("a full match runs to a winner and can restart", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Brazil" }).click();
  await page.getByRole("button", { name: "Argentina" }).click();
  await page.getByRole("button", { name: /vs/ }).click();
  await page.getByRole("button", { name: "Fight!" }).click();

  // Health bars are shown during the fight.
  await expect(page.getByRole("progressbar").first()).toBeVisible();

  // The match is hard-bounded to ~15s of play by the storm backstop; allow
  // generous headroom for the WebGL canvas to warm up under a slow headless
  // (software) GL context.
  await expect(page.getByText("Winner")).toBeVisible({ timeout: 40_000 });
  await expect(page.getByRole("button", { name: "New Battle" })).toBeVisible();

  await page.getByRole("button", { name: "New Battle" }).click();
  await expect(
    page.getByRole("heading", { name: "Country Fighter" }),
  ).toBeVisible();
});
