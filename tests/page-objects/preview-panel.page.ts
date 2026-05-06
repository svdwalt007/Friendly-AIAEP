import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model: Preview Panel
 *
 * Encapsulates all interactions with the preview panel
 */
export class PreviewPanel {
  readonly page: Page;

  // Locators
  readonly panel: Locator;
  readonly iframe: Locator;
  readonly closeButton: Locator;
  readonly refreshButton: Locator;
  readonly openInNewTabButton: Locator;
  readonly deviceModeSelector: Locator;
  readonly rotateButton: Locator;
  readonly previewUrl: Locator;
  readonly copyUrlButton: Locator;
  readonly copyConfirmation: Locator;
  readonly loadingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;
  readonly sessionStatus: Locator;
  readonly consolePanel: Locator;
  readonly consoleToggle: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.panel = page.locator('[data-testid="preview-panel"]');
    this.iframe = page.locator('[data-testid="preview-iframe"]');
    this.closeButton = page.locator('[data-testid="preview-close"]');
    this.refreshButton = page.locator('[data-testid="preview-refresh"]');
    this.openInNewTabButton = page.locator('[data-testid="preview-open-new-tab"]');
    this.deviceModeSelector = page.locator('[data-testid="device-mode-selector"]');
    this.rotateButton = page.locator('[data-testid="preview-rotate"]');
    this.previewUrl = page.locator('[data-testid="preview-url"]');
    this.copyUrlButton = page.locator('[data-testid="copy-url-button"]');
    this.copyConfirmation = page.locator('[data-testid="copy-confirmation"]');
    this.loadingIndicator = page.locator('[data-testid="preview-loading"]');
    this.errorMessage = page.locator('[data-testid="preview-error"]');
    this.retryButton = page.locator('[data-testid="preview-retry"]');
    this.sessionStatus = page.locator('[data-testid="preview-session-status"]');
    this.consolePanel = page.locator('[data-testid="preview-console"]');
    this.consoleToggle = page.locator('[data-testid="preview-console-toggle"]');
  }

  async closePanel() {
    await this.closeButton.click();
  }

  async clickRefresh() {
    await this.refreshButton.click();
  }

  async clickOpenInNewTab() {
    await this.openInNewTabButton.click();
  }

  async selectDeviceMode(mode: 'desktop' | 'tablet' | 'mobile') {
    await this.deviceModeSelector.click();
    await this.page.locator(`[data-testid="device-mode-${mode}"]`).click();
  }

  async clickRotate() {
    await this.rotateButton.click();
  }

  async clickCopyUrl() {
    await this.copyUrlButton.click();
  }

  async clickRetry() {
    await this.retryButton.click();
  }

  async toggleConsole() {
    await this.consoleToggle.click();
  }

  async getSelectedDeviceMode(): Promise<string> {
    const selectedButton = this.page.locator('[data-testid^="device-mode-"][aria-pressed="true"]');
    const testId = await selectedButton.getAttribute('data-testid');
    return testId?.replace('device-mode-', '') || 'desktop';
  }
}
