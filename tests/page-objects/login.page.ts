import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model: Login Page
 *
 * Encapsulates all interactions with the login page
 */
export class LoginPage {
  readonly page: Page;

  // Locators
  readonly usernameField: Locator;
  readonly passwordField: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly togglePasswordButton: Locator;
  readonly errorMessage: Locator;
  readonly usernameFieldError: Locator;
  readonly passwordFieldError: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;

    // Initialize locators
    this.usernameField = page.locator('[data-testid="username-field"]');
    this.passwordField = page.locator('[data-testid="password-field"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
    this.rememberMeCheckbox = page.locator('[data-testid="remember-me-checkbox"]');
    this.togglePasswordButton = page.locator('[data-testid="toggle-password-button"]');
    this.errorMessage = page.locator('[data-testid="login-error"]');
    this.usernameFieldError = page.locator('[data-testid="username-field-error"]');
    this.passwordFieldError = page.locator('[data-testid="password-field-error"]');
    this.loadingIndicator = page.locator('[data-testid="loading-indicator"]');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async fillUsername(username: string) {
    await this.usernameField.fill(username);
  }

  async fillPassword(password: string) {
    await this.passwordField.fill(password);
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async clickForgotPassword() {
    await this.forgotPasswordLink.click();
  }

  async checkRememberMe() {
    await this.rememberMeCheckbox.check();
  }

  async clickTogglePassword() {
    await this.togglePasswordButton.click();
  }

  async login(username: string, password: string) {
    await this.fillUsername(username);
    await this.fillPassword(password);
    await this.clickLogin();
  }
}
