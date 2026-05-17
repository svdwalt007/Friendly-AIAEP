import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model: Builder Page
 *
 * Encapsulates all interactions with the builder interface
 */
export class BuilderPage {
  readonly page: Page;

  // Locators
  readonly canvas: Locator;
  readonly canvasWidgets: Locator;
  readonly addWidgetButton: Locator;
  readonly widgetLibrary: Locator;
  readonly propertiesPanel: Locator;
  readonly layersPanel: Locator;
  readonly toolbar: Locator;
  readonly saveButton: Locator;
  readonly undoButton: Locator;
  readonly redoButton: Locator;
  readonly previewButton: Locator;
  readonly aiChatToggle: Locator;
  readonly gridToggle: Locator;
  readonly zoomControl: Locator;
  readonly canvasSizeSelector: Locator;
  readonly dataBindingTab: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.canvas = page.locator('[data-testid="canvas"]');
    this.canvasWidgets = page.locator('[data-testid^="widget-"]');
    this.addWidgetButton = page.locator('[data-testid="add-widget-button"]');
    this.widgetLibrary = page.locator('[data-testid="widget-library"]');
    this.propertiesPanel = page.locator('[data-testid="properties-panel"]');
    this.layersPanel = page.locator('[data-testid="layers-panel"]');
    this.toolbar = page.locator('[data-testid="toolbar"]');
    this.saveButton = page.locator('[data-testid="save-button"]');
    this.undoButton = page.locator('[data-testid="undo-button"]');
    this.redoButton = page.locator('[data-testid="redo-button"]');
    this.previewButton = page.locator('[data-testid="preview-button"]');
    this.aiChatToggle = page.locator('[data-testid="ai-chat-toggle"]');
    this.gridToggle = page.locator('[data-testid="grid-toggle"]');
    this.zoomControl = page.locator('[data-testid="zoom-control"]');
    this.canvasSizeSelector = page.locator('[data-testid="canvas-size-selector"]');
    this.dataBindingTab = page.locator('[data-testid="data-binding-tab"]');
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}`);
  }

  async clickAddWidget() {
    await this.addWidgetButton.click();
  }

  async clickSave() {
    await this.saveButton.click();
  }

  async clickUndo() {
    await this.undoButton.click();
  }

  async clickRedo() {
    await this.redoButton.click();
  }

  async clickPreview() {
    await this.previewButton.click();
  }

  async toggleAIChat() {
    await this.aiChatToggle.click();
  }

  async toggleGrid() {
    await this.gridToggle.click();
  }

  async setZoom(percentage: number) {
    await this.zoomControl.click();
    await this.page.locator(`[data-testid="zoom-${percentage}"]`).click();
  }

  async setCanvasSize(size: 'desktop' | 'tablet' | 'mobile') {
    await this.canvasSizeSelector.click();
    await this.page.locator(`[data-testid="canvas-size-${size}"]`).click();
  }

  async clickLayersPanel() {
    await this.page.locator('[data-testid="layers-panel-toggle"]').click();
  }

  async clickDataBindingTab() {
    await this.dataBindingTab.click();
  }

  async setTheme(theme: 'light' | 'dark' | 'high-contrast') {
    await this.page.locator('[data-testid="theme-toggle"]').click();
    await this.page.locator(`[data-testid="theme-${theme}"]`).click();
  }
}
