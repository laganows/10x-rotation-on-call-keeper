import { expect, type Locator, type Page } from "@playwright/test";

export class PlansListPage {
  readonly page: Page;
  readonly view: Locator;
  readonly table: Locator;
  readonly planRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.view = page.getByTestId("plans-list-view");
    this.table = page.getByTestId("plans-table");
    this.planRows = page.locator('[data-test-id^="plan-row-"]');
  }

  async waitForLoaded() {
    await expect(this.view).toBeVisible();
  }

  planRowById(planId: string) {
    return this.page.getByTestId(`plan-row-${planId}`);
  }

  openButtonByPlanId(planId: string) {
    return this.page.getByTestId(`plan-open-${planId}`);
  }

  planRowByRange(startDate: string, endDate: string) {
    return this.table.locator('[data-test-id^="plan-row-"]', { hasText: startDate }).filter({ hasText: endDate });
  }

  async openPlanByRange(startDate: string, endDate: string) {
    const row = this.planRowByRange(startDate, endDate);
    await row.first().waitFor();
    await row.first().locator("a").click();
  }

  async openFirstPlan() {
    await this.planRows.first().waitFor();
    await this.planRows.first().locator("a").click();
  }
}
