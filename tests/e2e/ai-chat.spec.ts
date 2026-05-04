import { test, expect } from '@playwright/test';
import { BuilderPage } from '../page-objects/builder.page';
import { AIChatPanel } from '../page-objects/ai-chat-panel.page';
import { testData } from '../fixtures/test-data';
import { loginAsUser, createTestProject } from '../helpers/test-utils';

/**
 * E2E Test Suite: AI Chat Interaction
 *
 * This suite tests the AI chat functionality:
 * - Opening and closing chat panel
 * - Sending messages and receiving responses
 * - Code generation requests
 * - Widget creation through chat
 * - Error handling and retries
 * - Message history and context
 * - Real-time streaming responses
 */

test.describe('AI Chat Interaction', () => {
  let builderPage: BuilderPage;
  let aiChatPanel: AIChatPanel;

  test.beforeEach(async ({ page }) => {
    // Authenticate and create test project
    await loginAsUser(page, testData.users.standard);
    const projectId = await createTestProject(page, {
      name: `chat-test-${Date.now()}`,
      template: 'blank',
    });

    // Initialize page objects
    builderPage = new BuilderPage(page);
    aiChatPanel = new AIChatPanel(page);

    // Navigate to builder
    await builderPage.goto(projectId);
  });

  test('should display AI chat toggle button', async () => {
    // Verify chat toggle button is visible
    await expect(builderPage.aiChatToggle).toBeVisible();
    await expect(builderPage.aiChatToggle).toBeEnabled();
  });

  test('should open and close AI chat panel', async () => {
    // Chat panel should be closed initially
    await expect(aiChatPanel.panel).not.toBeVisible();

    // Open chat panel
    await builderPage.toggleAIChat();
    await expect(aiChatPanel.panel).toBeVisible();
    await expect(aiChatPanel.messageInput).toBeVisible();

    // Close chat panel
    await aiChatPanel.closePanel();
    await expect(aiChatPanel.panel).not.toBeVisible();
  });

  test('should send message and receive response', async ({ page }) => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Send a simple message
    const message = 'Hello, can you help me build an IoT dashboard?';
    await aiChatPanel.sendMessage(message);

    // Verify message appears in chat
    await expect(aiChatPanel.getMessageByText(message)).toBeVisible();

    // Wait for AI response
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Verify response is not empty
    const responseText = await aiChatPanel.lastAIMessage.textContent();
    expect(responseText).toBeTruthy();
    expect(responseText!.length).toBeGreaterThan(0);
  });

  test('should show typing indicator while waiting for response', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Send message
    await aiChatPanel.sendMessage('Create a temperature gauge widget');

    // Verify typing indicator appears
    await expect(aiChatPanel.typingIndicator).toBeVisible({ timeout: 2000 });

    // Wait for response
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Verify typing indicator disappears
    await expect(aiChatPanel.typingIndicator).not.toBeVisible();
  });

  test('should stream response in real-time', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Send message that expects a longer response
    await aiChatPanel.sendMessage('Explain how to create a multi-page IoT dashboard');

    // Wait for response to start
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Get initial response length
    const initialText = await aiChatPanel.lastAIMessage.textContent();
    const initialLength = initialText?.length || 0;

    // Wait a bit and check if text is growing (streaming)
    await aiChatPanel.page.waitForTimeout(500);
    const laterText = await aiChatPanel.lastAIMessage.textContent();
    const laterLength = laterText?.length || 0;

    // Text should grow as it streams (or at least not be empty)
    expect(laterLength).toBeGreaterThanOrEqual(initialLength);
  });

  test('should request widget creation through chat', async ({ page }) => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Request widget creation
    await aiChatPanel.sendMessage('Create a temperature sensor gauge widget');

    // Wait for AI to process request
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Check if widget was added to canvas
    await page.waitForTimeout(2000); // Allow time for widget to be created
    const widgetCount = await builderPage.canvasWidgets.count();
    expect(widgetCount).toBeGreaterThan(0);
  });

  test('should maintain conversation context', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // First message
    await aiChatPanel.sendMessage('Create a dashboard for monitoring temperature');
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Follow-up message that references previous context
    await aiChatPanel.sendMessage('Add a humidity sensor too');
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Verify both messages are in history
    const messageCount = await aiChatPanel.allMessages.count();
    expect(messageCount).toBeGreaterThanOrEqual(4); // 2 user + 2 AI messages
  });

  test('should display error message on API failure', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Intercept API call and make it fail
    await aiChatPanel.page.route('**/api/ai/chat', (route) => {
      route.abort('failed');
    });

    // Send message
    await aiChatPanel.sendMessage('This should fail');

    // Verify error message is shown
    await expect(aiChatPanel.errorMessage).toBeVisible({ timeout: 10000 });
    await expect(aiChatPanel.errorMessage).toContainText('error');
  });

  test('should retry failed message', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Make first call fail, second succeed
    let callCount = 0;
    await aiChatPanel.page.route('**/api/ai/chat', (route) => {
      callCount++;
      if (callCount === 1) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    // Send message
    await aiChatPanel.sendMessage('Test retry');

    // Wait for error
    await expect(aiChatPanel.errorMessage).toBeVisible({ timeout: 10000 });

    // Click retry button
    await aiChatPanel.clickRetry();

    // Verify response appears
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });
    await expect(aiChatPanel.errorMessage).not.toBeVisible();
  });

  test('should clear chat history', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Send some messages
    await aiChatPanel.sendMessage('First message');
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    await aiChatPanel.sendMessage('Second message');
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Verify messages exist
    let messageCount = await aiChatPanel.allMessages.count();
    expect(messageCount).toBeGreaterThan(0);

    // Clear history
    await aiChatPanel.clickClearHistory();

    // Verify messages are cleared
    messageCount = await aiChatPanel.allMessages.count();
    expect(messageCount).toBe(0);
  });

  test('should scroll to bottom on new message', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Send multiple messages to create scroll
    for (let i = 0; i < 5; i++) {
      await aiChatPanel.sendMessage(`Message ${i + 1}`);
      await aiChatPanel.page.waitForTimeout(1000);
    }

    // Get last message
    const lastMessage = aiChatPanel.lastUserMessage;

    // Verify it's in viewport (scrolled to bottom)
    await expect(lastMessage).toBeInViewport();
  });

  test('should support code block in AI response', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Request code generation
    await aiChatPanel.sendMessage('Show me TypeScript code for a temperature sensor class');

    // Wait for response
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Verify code block is rendered
    await expect(aiChatPanel.lastAIMessage.locator('pre code')).toBeVisible();
  });

  test('should copy code from response', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Request code
    await aiChatPanel.sendMessage('Generate a simple sensor interface in TypeScript');

    // Wait for response with code
    await expect(aiChatPanel.lastAIMessage).toBeVisible({ timeout: 30000 });

    // Click copy button
    await aiChatPanel.clickCopyCode();

    // Verify copy confirmation
    await expect(aiChatPanel.copyConfirmation).toBeVisible();
  });

  test('should handle multiline message input', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Type multiline message
    const multilineMessage = 'Line 1\nLine 2\nLine 3';
    await aiChatPanel.messageInput.fill(multilineMessage);

    // Verify text is entered
    await expect(aiChatPanel.messageInput).toHaveValue(multilineMessage);

    // Send message
    await aiChatPanel.clickSend();

    // Verify message is sent
    await expect(aiChatPanel.getMessageByText('Line 1')).toBeVisible();
  });

  test('should disable send button when input is empty', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Verify send button is disabled when input is empty
    await expect(aiChatPanel.sendButton).toBeDisabled();

    // Type message
    await aiChatPanel.messageInput.fill('Test message');

    // Verify send button is enabled
    await expect(aiChatPanel.sendButton).toBeEnabled();
  });

  test('should send message with Enter key', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Type message
    await aiChatPanel.messageInput.fill('Send with Enter');

    // Press Enter
    await aiChatPanel.messageInput.press('Enter');

    // Verify message is sent
    await expect(aiChatPanel.getMessageByText('Send with Enter')).toBeVisible();
  });

  test('should add newline with Shift+Enter', async () => {
    // Open chat panel
    await builderPage.toggleAIChat();

    // Type first line
    await aiChatPanel.messageInput.fill('First line');

    // Press Shift+Enter
    await aiChatPanel.messageInput.press('Shift+Enter');

    // Type second line
    await aiChatPanel.messageInput.type('Second line');

    // Verify multiline content
    const value = await aiChatPanel.messageInput.inputValue();
    expect(value).toContain('\n');
  });
});
