import { test, expect } from "@playwright/test";

async function loginDemo(page: import("@playwright/test").Page, button: string) {
  for (let a = 0; a < 4; a++) {
    await page.goto("/login");
    await page.getByRole("button", { name: button }).click();
    try { await page.waitForURL("**/workspace", { timeout: 30000 }); return; } catch {}
  }
  throw new Error(`login (${button}) did not reach /workspace`);
}

test("admin sees dashboard and creates an owner", async ({ page }) => {
  await loginDemo(page, "Войти как Админ");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Дашборд" })).toBeVisible();
  await expect(page.getByText("Занятость, %")).toBeVisible();

  await page.goto("/admin/owners");
  const name = "E2E Владелец";
  await page.getByPlaceholder("Название*").fill(name);
  await page.getByRole("button", { name: "Добавить", exact: true }).click();
  await expect(page.getByRole("cell", { name })).toBeVisible();
});

test("client is denied admin access", async ({ page }) => {
  await loginDemo(page, "Войти как Клиент");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/workspace/);
});
