import { expect, test } from '@playwright/test';

test('home page renders under the deploy base path', async ({ page }) => {
  const response = await page.goto('./');
  expect(response?.ok()).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
