import { expect, type Locator, type Page } from "@playwright/test";

export class PlanDetailPage {
  readonly page: Page;
  readonly view: Locator;
  readonly assignmentsSection: Locator;
  readonly assignmentsTable: Locator;
  readonly assignmentRows: Locator;

  constructor(page: Page) {
    this.page = page;
    this.view = page.getByTestId("plan-detail-view");
    this.assignmentsSection = page.getByTestId("plan-assignments");
    this.assignmentsTable = page.getByTestId("plan-assignments-table");
    this.assignmentRows = page.locator('[data-test-id^="assignment-row-"]');
  }

  async waitForLoaded() {
    await expect(this.view).toBeVisible();
    await expect(this.assignmentsTable).toBeVisible();
  }

  assignmentRowsForMember(name: string) {
    return this.assignmentsTable.locator(`[data-test-member="${name}"]`);
  }
}
