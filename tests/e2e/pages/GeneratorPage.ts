import { expect, type Locator, type Page } from "@playwright/test";

export class GeneratorPage {
  readonly page: Page;
  readonly view: Locator;
  readonly form: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly previewButton: Locator;
  readonly previewSection: Locator;
  readonly assignmentsTable: Locator;
  readonly memberCounters: Locator;
  readonly fairnessMetrics: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.view = page.getByTestId("generator-view");
    this.form = page.getByTestId("generator-form");
    this.startDateInput = page.getByTestId("generator-start-date");
    this.endDateInput = page.getByTestId("generator-end-date");
    this.previewButton = page.getByTestId("generator-preview-button");
    this.previewSection = page.getByTestId("generator-preview");
    this.assignmentsTable = page.getByTestId("generator-preview-assignments");
    this.memberCounters = page.getByTestId("generator-member-counters");
    this.fairnessMetrics = page.getByTestId("generator-fairness-metrics");
    this.saveButton = page.getByTestId("generator-save-button");
  }

  async waitForLoaded() {
    await expect(this.view).toBeVisible();
  }

  async setDateRange(startDate: string, endDate: string) {
    await this.startDateInput.fill(startDate);
    await this.endDateInput.fill(endDate);
  }

  async generatePreview() {
    await this.previewButton.click();
    await expect(this.previewSection).toBeVisible();
  }

  memberCounterRowByMemberId(memberId: string) {
    return this.page.getByTestId(`member-counter-${memberId}`);
  }

  memberCounterRowByName(name: string) {
    return this.memberCounters.locator('[data-test-id^="member-counter-"]', { hasText: name });
  }
}
