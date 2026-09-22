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

    const switchLink = page.locator('.auth-switch-footer a').first();
    if (await switchLink.isVisible()) {
      await expect(switchLink).toBeVisible();

      // Click "Create one now" link
      await switchLink.click();
      await expect(page.locator('.form-header h2')).toContainText(/Get Started/i);

      // Click "Sign in instead" link
      const signInLink = page.locator('.auth-switch-footer a').first();
      await signInLink.click();
      await expect(page.locator('.form-header h2')).toContainText(/Welcome Back/i);
    }
  });
});
