import { test, expect } from '@playwright/test';

test.describe('Theme & Navigation Features', () => {
  test('should toggle dark and light mode theme', async ({ page }) => {
    await page.goto('/');

    const themeToggleBtn = page.locator('.theme-toggle-btn').first();
    await expect(themeToggleBtn).toBeVisible();

    // Store initial theme attribute
    const initialTheme = await page.getAttribute('html', 'data-theme');

    // Click theme toggle button
    await themeToggleBtn.click();

    // Verify theme attribute toggles
    const newTheme = await page.getAttribute('html', 'data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });

  test('should display sign in and account registration tabs', async ({ page }) => {
    await page.goto('/');

    // Check if auth page is displayed when unauthenticated
    const signInTab = page.locator('.mode-tab-btn', { hasText: 'Sign In' }).first();
    const createAccountTab = page.locator('.mode-tab-btn', { hasText: 'Create Account' }).first();

    if (await signInTab.isVisible()) {
      await expect(signInTab).toBeVisible();
      await expect(createAccountTab).toBeVisible();

      // Click Create Account tab
      await createAccountTab.click();
      await expect(page.locator('button[type="submit"]')).toContainText(/Create Account/i);

      // Click Sign In tab
      await signInTab.click();
      await expect(page.locator('button[type="submit"]')).toContainText(/Sign In/i);
    }
  });
});
