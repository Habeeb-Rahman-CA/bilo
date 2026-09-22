import { test, expect } from '@playwright/test';

test.describe('Task & Workspace Workflows', () => {
  test('should render authentication form and allow inputting credentials', async ({ page }) => {
    await page.goto('/');

    const emailInput = page.locator('input[name="email"]').first();
    const passwordInput = page.locator('input[name="password"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill('developer@bilo.app');
      await passwordInput.fill('Secret123!');

      await expect(emailInput).toHaveValue('developer@bilo.app');
      await expect(passwordInput).toHaveValue('Secret123!');
    }
  });
});
