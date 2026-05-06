import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model: Project Creation Page
 *
 * Encapsulates all interactions with the project creation page
 */
export class ProjectCreationPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly nameField: Locator;
  readonly descriptionField: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;
  readonly nameFieldError: Locator;
  readonly descriptionFieldError: Locator;
  readonly errorMessage: Locator;
  readonly loadingIndicator: Locator;
  readonly templatePreview: Locator;
  readonly templateDescription: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.pageTitle = page.locator('[data-testid="page-title"]');
    this.nameField = page.locator('[data-testid="project-name-field"]');
    this.descriptionField = page.locator('[data-testid="project-description-field"]');
    this.submitButton = page.locator('[data-testid="create-project-submit"]');
    this.cancelButton = page.locator('[data-testid="create-project-cancel"]');
    this.nameFieldError = page.locator('[data-testid="project-name-error"]');
    this.descriptionFieldError = page.locator('[data-testid="project-description-error"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.loadingIndicator = page.locator('[data-testid="loading-indicator"]');
    this.templatePreview = page.locator('[data-testid="template-preview"]');
    this.templateDescription = page.locator('[data-testid="template-description"]');
  }

  async fillProjectName(name: string) {
    await this.nameField.fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionField.fill(description);
  }

  async selectTemplate(templateId: string) {
    await this.page.locator(`[data-testid="template-${templateId}"]`).click();
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async clickCancel() {
    await this.cancelButton.click();
  }

  async clearProjectName() {
    await this.nameField.clear();
  }
}
