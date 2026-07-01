import { test, expect } from "@playwright/test";

// On a cold `next dev` server the first credentials request can race route
// compilation / Prisma connect and return an error. Retry warms the routes.
async function loginAsClient(page: import("@playwright/test").Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto("/login");
    await page.getByRole("button", { name: "Войти как Клиент" }).click();
    try {
      await page.waitForURL("**/workspace", { timeout: 30000 });
      return;
    } catch {
      /* retry on cold-start error */
    }
  }
  throw new Error("login did not reach /workspace after retries");
}

test("client can log in, browse, build a working list and export", async ({ page }) => {
  // 1. One-click demo login
  await loginAsClient(page);

  // 2. Workspace loaded with surfaces (count reflects seeded data)
  await expect(page.getByText("Найдено:")).toBeVisible();

  // 3. Open a surface card from the list and see the availability calendar
  await page.getByRole("button", { name: "Список", exact: true }).click();
  await page.locator("tbody tr").first().waitFor();
  await page.locator("tbody tr").first().click();
  await expect(page.getByText("Занятость по месяцам")).toBeVisible();

  // 4. Create a working list (name via prompt dialog). The add controls only
  //    render once a list is active, so their appearance confirms creation.
  page.once("dialog", (d) => d.accept("E2E список"));
  await page.getByRole("button", { name: "+ список" }).click();
  const idsInput = page.getByPlaceholder("№ поверхностей через пробел/запятую");
  await expect(idsInput).toBeVisible();

  // 5. Add surfaces by number (seed generates 776000..776199)
  await idsInput.fill("776000 776002 776004");
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect
    .poll(async () => page.locator("table").last().locator("tbody tr").count())
    .toBeGreaterThan(0);

  // 6. Export downloads a .xlsx
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Excel" }).click(),
  ]);
  expect(download.suggestedFilename()).toContain(".xlsx");
});
