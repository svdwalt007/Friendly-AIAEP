import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model: AI Chat Panel
 *
 * Encapsulates all interactions with the AI chat panel
 */
export class AIChatPanel {
  readonly page: Page;

  // Locators
  readonly panel: Locator;
  readonly messageInput: Locator;
  readonly sendButton: Locator;
  readonly closeButton: Locator;
  readonly clearHistoryButton: Locator;
  readonly typingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly retryButton: Locator;
  readonly allMessages: Locator;
  readonly lastUserMessage: Locator;
  readonly lastAIMessage: Locator;
  readonly copyCodeButton: Locator;
  readonly copyConfirmation: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.panel = page.locator('[data-testid="ai-chat-panel"]');
    this.messageInput = page.locator('[data-testid="ai-chat-input"]');
    this.sendButton = page.locator('[data-testid="ai-chat-send"]');
    this.closeButton = page.locator('[data-testid="ai-chat-close"]');
    this.clearHistoryButton = page.locator('[data-testid="ai-chat-clear"]');
    this.typingIndicator = page.locator('[data-testid="ai-typing-indicator"]');
    this.errorMessage = page.locator('[data-testid="ai-chat-error"]');
    this.retryButton = page.locator('[data-testid="ai-chat-retry"]');
    this.allMessages = page.locator('[data-testid^="chat-message-"]');
    this.lastUserMessage = page.locator('[data-testid^="chat-message-user-"]').last();
    this.lastAIMessage = page.locator('[data-testid^="chat-message-ai-"]').last();
    this.copyCodeButton = page.locator('[data-testid="copy-code-button"]');
    this.copyConfirmation = page.locator('[data-testid="copy-confirmation"]');
  }

  async sendMessage(message: string) {
    await this.messageInput.fill(message);
    await this.clickSend();
  }

  async clickSend() {
    await this.sendButton.click();
  }

  async closePanel() {
    await this.closeButton.click();
  }

  async clickClearHistory() {
    await this.clearHistoryButton.click();
  }

  async clickRetry() {
    await this.retryButton.click();
  }

  async clickCopyCode() {
    await this.copyCodeButton.click();
  }

  getMessageByText(text: string): Locator {
    return this.page.locator(`[data-testid^="chat-message-"]:has-text("${text}")`);
  }
}
