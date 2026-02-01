import { expect, test } from "@playwright/test";

import { GeneratorPage, LoginPage, PlanDetailPage, PlansListPage } from "./pages";
import { cleanupSupabase } from "./global-teardown";

const formatUtcDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getNextMonthRangeUtc = () => {
  const now = new Date();
  const currentMonth = now.getUTCMonth();
  const currentYear = now.getUTCFullYear();
  const nextMonth = (currentMonth + 1) % 12;
  const year = currentMonth === 11 ? currentYear + 1 : currentYear;

  const startDate = new Date(Date.UTC(year, nextMonth, 1));
  const endDate = new Date(Date.UTC(year, nextMonth, 7));

  return {
    startDate: formatUtcDate(startDate),
    endDate: formatUtcDate(endDate),
  };
};

test("generate, save, and verify plan assignments", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const generatorPage = new GeneratorPage(page);
  const plansListPage = new PlansListPage(page);
  const planDetailPage = new PlanDetailPage(page);

  const { startDate, endDate } = getNextMonthRangeUtc();
  const email = process.env.E2E_USERNAME;
  const password = process.env.E2E_PASSWORD;

  if (email && password) {
    await loginPage.goto();
    await loginPage.login(email, password);
    await page.waitForURL("**/");
  } else {
    await page.goto("/");
  }

  await generatorPage.waitForLoaded();
  await generatorPage.setDateRange(startDate, endDate);
  await generatorPage.generatePreview();

  await expect(generatorPage.memberCounterRowByName("Alice")).toContainText("saved 0 · preview 3 · total 3");
  await expect(generatorPage.memberCounterRowByName("Bob")).toContainText("saved 0 · preview 4 · total 4");
  await expect(generatorPage.fairnessMetrics).toContainText("Historical inequality: 0");
  await expect(generatorPage.fairnessMetrics).toContainText("Preview inequality: 1");

  await generatorPage.saveButton.click();
  await page.waitForURL("**/plans");

  await plansListPage.waitForLoaded();
  await expect(plansListPage.planRowByRange(startDate, endDate).first()).toBeVisible();
  await plansListPage.openPlanByRange(startDate, endDate);

  await planDetailPage.waitForLoaded();
  await expect(planDetailPage.assignmentRowsForMember("Alice")).toHaveCount(3);
  await expect(planDetailPage.assignmentRowsForMember("Bob")).toHaveCount(4);
});

test.afterAll(async () => {
  await cleanupSupabase();
});
