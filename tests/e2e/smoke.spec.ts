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

/**
 * The Content Security Policy forbids inline script, and Trusted Types forbid
 * turning text into markup. A breach of either shows up as a console error.
 */
const EVERY_PAGE = [
  './',
  './turlar/',
  './turlar/kapadokya/',
  './turlar/beypazari-gunubirlik/',
  './turlar/kapadokya/rota/?harita=3b',
  './turlar/kapadokya/rota/?harita=duz',
  './takvim/',
  './gecmis-turlar/',
  './gecmis-turlar/2026-09-18-kapadokya/',
  './sss/',
  './kurumsal/',
  './iletisim/',
  './yonetim/',
];

for (const path of EVERY_PAGE) {
  test(`${path} loads without console errors or policy violations`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Lazy parts announce themselves; where there is one, wait for it to finish starting.
    const route = page.locator('[data-route-app]');
    if ((await route.count()) > 0) await expect(route).toHaveAttribute('data-ready', 'true');
    // A visitor who finds the panel gets no further than its lock.
    const panel = page.locator('[data-admin]');
    if ((await panel.count()) > 0) await expect(panel).toHaveAttribute('data-access', 'locked');
    expectNoErrors(errors);
  });
}
