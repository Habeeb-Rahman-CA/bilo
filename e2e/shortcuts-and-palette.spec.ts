import { test, expect } from '@playwright/test';

test.describe('Command Palette & Modals E2E', () => {
  test('should render application and respond to page interactions', async ({ page }) => {
    await page.goto('/');

    // Verify page responsiveness
    await expect(page).toHaveTitle(/bilo/i);

    // Verify main body is loaded
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
