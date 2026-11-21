import { expect, test, type Page } from "@playwright/test";

const analyst = { email: process.env.E2E_ANALYST_EMAIL, password: process.env.E2E_ANALYST_PASSWORD };
const citizen = { email: process.env.E2E_CITIZEN_EMAIL, password: process.env.E2E_CITIZEN_PASSWORD };

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/en/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/login"));
}

test.describe("Geographic threat map", () => {
  test("analyst filters by F019, sees Pogradec, opens the drawer, table and hex views", async ({ page }) => {
    test.skip(!analyst.email || !analyst.password, "set E2E_ANALYST_EMAIL / E2E_ANALYST_PASSWORD");
    await signIn(page, analyst.email!, analyst.password!);

    await page.goto("/en/soc/geo?campaign=F019");
    await expect(page.getByRole("heading", { name: "Geographic threat map" })).toBeVisible();
    // Pogradec is highlighted: it has reports (not the "no data" hatch) and appears in the hot zones.
    const pogradec = page.locator('svg [data-code="AL0705"]').first();
    await expect(pogradec).toBeVisible();
    await expect(pogradec).not.toHaveAttribute("fill", /nodata/);
    await expect(page.getByRole("region", { name: "Hot zones" }).or(page.locator("section[aria-labelledby=hz-title]"))).toContainText("Pogradec");

    // Drawer: aggregates and masked rows only.
    await pogradec.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("Pogradec");
    await expect(drawer).toContainText("Analyst notes");
    await page.keyboard.press("Escape");

    // Table view.
    await page.getByRole("radio", { name: "View as table" }).click();
    await expect(page).toHaveURL(/view=table/);
    await expect(page.getByRole("table")).toContainText("Pogradec");

    // Hex view.
    await page.getByRole("radio", { name: "Map" }).click();
    await page.getByRole("button", { name: "Hex tiles" }).click();
    await expect(page).toHaveURL(/layers=[^&]*hex/);
    await expect(page.locator('svg [data-code="AL0705"]').first()).toBeVisible();
  });

  test("a citizen is redirected away from /soc/geo", async ({ page }) => {
    test.skip(!citizen.email || !citizen.password, "set E2E_CITIZEN_EMAIL / E2E_CITIZEN_PASSWORD");
    await signIn(page, citizen.email!, citizen.password!);
    await page.goto("/en/soc/geo");
    await expect(page).not.toHaveURL(/\/soc\/geo/);
  });

  test("an anonymous visitor is redirected away from /soc/geo", async ({ page }) => {
    await page.goto("/en/soc/geo");
    await expect(page).toHaveURL(/\/login/);
  });
});
