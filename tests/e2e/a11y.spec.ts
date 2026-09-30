import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PAGES: Record<string, string> = {
  'home page': './',
  'tour list': './turlar/',
  'tour page': './turlar/kapadokya/',
  'day-trip page': './turlar/beypazari-gunubirlik/',
  'corporate page': './kurumsal/',
  'contact page': './iletisim/',
  'not-found page': './boyle-bir-sayfa-yok/',
};

for (const [name, path] of Object.entries(PAGES)) {
  test(`${name} has no accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('route preview has no accessibility violations', async ({ page }) => {
  await page.goto('./turlar/kapadokya/rota/');
  await expect(page.locator('[data-route-app]')).toHaveAttribute('data-ready', 'true');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('operations panel has no accessibility violations on any tab', async ({ page }) => {
  await page.goto('./yonetim/');
  await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Örnek Verileri Yükle' }).click();
  for (const tab of ['Özet', 'Yolcu Ekle', 'Yolcu Listesi']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `${tab} tab`).toEqual([]);
  }
});
