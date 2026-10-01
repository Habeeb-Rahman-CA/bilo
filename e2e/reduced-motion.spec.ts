import { test, expect } from '@playwright/test';

test.describe('Prefers Reduced Motion E2E', () => {
  test('should disable animations and transitions when prefers-reduced-motion is reduce', async ({ page }) => {
    // Emulate OS prefers-reduced-motion: reduce
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    // Check computed styles on interactive elements
    const transitionDuration = await page.evaluate(() => {
      const btn = document.querySelector('.btn') || document.body;
      return window.getComputedStyle(btn).transitionDuration;
    });

    // Duration should be 0s or 0.00001s (0.01ms)
    expect(parseFloat(transitionDuration)).toBeLessThanOrEqual(0.001);

    // Verify spinner animations are stopped
    const spinnerAnimation = await page.evaluate(() => {
      const spinner = document.querySelector('.spinner-icon, .spin, [class*="spin"]');
      if (!spinner) return 'none';
      return window.getComputedStyle(spinner).animationName;
    });

    expect(spinnerAnimation).toBe('none');
  });
});
