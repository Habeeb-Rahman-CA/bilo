import { test, expect } from '@playwright/test';

test.describe('Authentication Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start unauthenticated
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto('/');
  });

  test('should render sign-in form with email, password, and mode tabs', async ({ page }) => {
    // Check main auth title
    const headerTitle = page.locator('.form-header h2');
    await expect(headerTitle).toContainText(/Welcome Back/i);

    // Verify Email and Password inputs are visible
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Verify Sign In & Create Account mode tabs
    const signInTab = page.locator('.mode-tab-btn', { hasText: 'Sign In' });
    const createAccountTab = page.locator('.mode-tab-btn', { hasText: 'Create Account' });
    await expect(signInTab).toBeVisible();
    await expect(createAccountTab).toBeVisible();
  });

  test('should toggle mode between Sign In and Create Account', async ({ page }) => {
    const createAccountTab = page.locator('.mode-tab-btn', { hasText: 'Create Account' });
    await createAccountTab.click();

    // Header updates to Get Started
    const headerTitle = page.locator('.form-header h2');
    await expect(headerTitle).toContainText(/Get Started/i);

    // Confirm password input becomes visible in signup mode
    const confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    await expect(confirmPasswordInput).toBeVisible();

    // Password requirements notice appears
    const pwdReq = page.locator('.password-requirements');
    await expect(pwdReq).toBeVisible();

    // Switch back to Sign In mode
    const signInTab = page.locator('.mode-tab-btn', { hasText: 'Sign In' });
    await signInTab.click();
    await expect(headerTitle).toContainText(/Welcome Back/i);
    await expect(confirmPasswordInput).not.toBeVisible();
  });

  test('should toggle password visibility on eye button click', async ({ page }) => {
    const passwordInput = page.locator('input[name="password"]');
    const pwdToggleBtn = page.locator('.pwd-toggle-btn');

    await passwordInput.fill('SecretPass123!');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click toggle button to view password
    await pwdToggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click toggle button again to hide
    await pwdToggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should enforce minimum 6 characters password requirement on signup', async ({ page }) => {
    const createAccountTab = page.locator('.mode-tab-btn', { hasText: 'Create Account' });
    await createAccountTab.click();

    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const confirmPasswordInput = page.locator('input[name="confirmPassword"]');
    const submitBtn = page.locator('button[type="submit"]');

    await emailInput.fill('newuser@bilo.app');
    await passwordInput.fill('12345'); // Only 5 chars
    await confirmPasswordInput.fill('12345');

    // Submit button remains disabled because password is < 6 characters
    await expect(submitBtn).toBeDisabled();

    // Update password to 6 characters
    await passwordInput.fill('123456');
    await confirmPasswordInput.fill('123456');
    await expect(submitBtn).toBeEnabled();
  });

  test('should calculate password strength meter in signup mode', async ({ page }) => {
    const createAccountTab = page.locator('.mode-tab-btn', { hasText: 'Create Account' });
    await createAccountTab.click();

    const passwordInput = page.locator('input[name="password"]');
    const strengthText = page.locator('.strength-text');

    // Weak / Short
    await passwordInput.fill('123');
    await expect(strengthText).toContainText(/Too short/i);

    // Good (>=6 chars)
    await passwordInput.fill('simple123');
    await expect(strengthText).toContainText(/Good/i);

    // Strong (>=10 chars with uppercase and special character)
    await passwordInput.fill('ComplexP@ssw0rd2026!');
    await expect(strengthText).toContainText(/Strong/i);
  });
});
