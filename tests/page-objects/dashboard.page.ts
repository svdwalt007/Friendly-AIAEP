import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model: Dashboard Page
 *
 * Encapsulates all interactions with the dashboard page
 */
export class DashboardPage {
  readonly page: Page;

  // Locators
  readonly pageTitle: Locator;
  readonly createProjectButton: Locator;
  readonly projectCards: Locator;
  readonly searchInput: Locator;
  readonly filterButton: Locator;
  readonly sortDropdown: Locator;
  readonly viewModeGrid: Locator;
  readonly viewModeList: Locator;
  readonly userMenu: Locator;
  readonly userEmail: Locator;
  readonly logoutButton: Locator;
  readonly adminMenu: Locator;
  readonly sidebar: Locator;
  readonly sidebarToggle: Locator;
  readonly notificationPanel: Locator;
  readonly templatesTab: Locator;
  readonly settingsButton: Locator;
  readonly helpMenu: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.pageTitle = page.locator('[data-testid="dashboard-title"]');
    this.createProjectButton = page.locator('[data-testid="create-project-button"]');
    this.projectCards = page.locator('[data-testid^="project-card-"]');
    this.searchInput = page.locator('[data-testid="search-projects"]');
    this.filterButton = page.locator('[data-testid="filter-button"]');
    this.sortDropdown = page.locator('[data-testid="sort-dropdown"]');
    this.viewModeGrid = page.locator('[data-testid="view-mode-grid"]');
    this.viewModeList = page.locator('[data-testid="view-mode-list"]');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.userEmail = page.locator('[data-testid="user-email"]');
    this.logoutButton = page.locator('[data-testid="logout-button"]');
    this.adminMenu = page.locator('[data-testid="admin-menu"]');
    this.sidebar = page.locator('[data-testid="sidebar"]');
    this.sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
    this.notificationPanel = page.locator('[data-testid="notification-panel"]');
    this.templatesTab = page.locator('[data-testid="templates-tab"]');
    this.settingsButton = page.locator('[data-testid="settings-button"]');
    this.helpMenu = page.locator('[data-testid="help-menu"]');
    this.emptyState = page.locator('[data-testid="empty-state"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
  }

  async clickCreateProject() {
    await this.createProjectButton.click();
  }

  async searchProjects(query: string) {
    await this.searchInput.fill(query);
  }

  async clickFilterButton() {
    await this.filterButton.click();
  }

  async clickSortDropdown() {
    await this.sortDropdown.click();
  }

  async setViewMode(mode: 'grid' | 'list') {
    if (mode === 'grid') {
      await this.viewModeGrid.click();
    } else {
      await this.viewModeList.click();
    }
  }

  async clickUserMenu() {
    await this.userMenu.click();
  }

  async clickLogout() {
    await this.clickUserMenu();
    await this.logoutButton.click();
  }

  async toggleSidebar() {
    await this.sidebarToggle.click();
  }

  async clickTemplatesTab() {
    await this.templatesTab.click();
  }

  async clickSettings() {
    await this.settingsButton.click();
  }

  async clickHelpMenu() {
    await this.helpMenu.click();
  }

  async clickProjectMenu(index: number) {
    await this.projectCards.nth(index).locator('[data-testid="project-menu-button"]').click();
  }

  async getProjectNames(): Promise<string[]> {
    const names: string[] = [];
    const count = await this.projectCards.count();

    for (let i = 0; i < count; i++) {
      const name = await this.projectCards.nth(i).locator('[data-testid="project-name"]').textContent();
      if (name) names.push(name);
    }

    return names;
  }

  async setTheme(theme: 'light' | 'dark' | 'high-contrast') {
    await this.clickUserMenu();
    await this.page.locator(`[data-testid="theme-${theme}"]`).click();
  }
}
