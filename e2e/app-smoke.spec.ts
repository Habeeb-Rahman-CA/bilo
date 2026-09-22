import { test, expect } from '@playwright/test';

test.describe('Application Smoke Test', () => {
  test('should load application page with correct title and header', async ({ page }) => {
    await page.goto('/');

    // Check document title
    await expect(page).toHaveTitle(/bilo/i);

    // Verify main navigation header is visible
    const logo = page.locator('app-bilo-logo').first();
    await expect(logo).toBeVisible();
  });
});
