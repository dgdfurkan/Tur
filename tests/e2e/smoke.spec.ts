import { expect, test } from '@playwright/test';
import { expectNoErrors, trackErrors } from './support';

test('home page renders under the deploy base path', async ({ page }) => {
  const errors = trackErrors(page);
  const response = await page.goto('./');
  expect(response?.ok()).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ankara Çıkışlı Kültür Turları');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expectNoErrors(errors);
});

test('the distance sign lists every tour and links to it', async ({ page }) => {
  await page.goto('./');
  const rows = page.locator('.distance-sign a');
  await expect(rows).toHaveCount(5);
  await rows.filter({ hasText: 'Kapadokya' }).click();
  await expect(page).toHaveURL(/\/turlar\/kapadokya\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kapadokya Kültür Turu');
});

test('unknown addresses show the not-found page', async ({ page }) => {
  const response = await page.goto('./boyle-bir-sayfa-yok/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aradığınız Sayfa Bulunamadı');
});
