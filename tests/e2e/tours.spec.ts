import { expect, test } from '@playwright/test';
import { expectNoErrors, trackErrors } from './support';

test('the tour list filters by category without a page load', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./turlar/');
  const tickets = page.locator('.ticket:visible');
  await expect(tickets).toHaveCount(5);

  await page.getByText('Günübirlik', { exact: true }).first().click();
  await expect(tickets).toHaveCount(1);
  await expect(tickets).toContainText('Beypazarı Günübirlik Turu');

  await page.getByText('Tümü', { exact: true }).click();
  await expect(tickets).toHaveCount(5);
  expectNoErrors(errors);
});

test('a tour page shows programme, fare scope and departures', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./turlar/kapadokya/');
  for (const heading of [
    'Günlük Program',
    'Konaklama',
    'Fiyata Dâhil Olanlar',
    'Fiyata Dâhil Olmayanlar',
    'Kalkış Tarihleri ve Koltuk Durumu',
  ]) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await expect(page.locator('.fare__price')).toHaveText('₺9.850');
  expectNoErrors(errors);
});

test('choosing another departure swaps the seat plan', async ({ page }) => {
  await page.goto('./turlar/kapadokya/');
  const plans = page.locator('.seat-map__svg:visible');
  await expect(plans).toHaveCount(1);
  const first = await plans.getAttribute('data-departure-id');

  await page.locator('.option').nth(1).click();
  await expect(plans).toHaveCount(1);
  await expect(plans).not.toHaveAttribute('data-departure-id', first ?? '');
});

test('the route teaser opens the route preview', async ({ page }) => {
  await page.goto('./turlar/kapadokya/');
  await page.getByRole('link', { name: 'Rotayı Ön İzle' }).click();
  await expect(page).toHaveURL(/\/turlar\/kapadokya\/rota\/$/);
});
