import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { goToScreen, openPanelPage, waitForStillness } from './support';

const PAGES: Record<string, string> = {
  'home page': './',
  'tour list': './turlar/',
  'tour page': './turlar/kapadokya/',
  'day-trip page': './turlar/beypazari-gunubirlik/',
  'departure calendar': './takvim/',
  'past tours': './gecmis-turlar/',
  'past tour page': './gecmis-turlar/2026-09-18-kapadokya/',
  'questions page': './sss/',
  'corporate page': './kurumsal/',
  'contact page': './iletisim/',
  'not-found page': './boyle-bir-sayfa-yok/',
};

/**
 * Axe judges what is painted at the instant it runs. With motion, content that
 * arrives on scroll is still hidden or half-transparent then, so it would be
 * skipped or misjudged. Reduced motion shows each page whole and at rest.
 */
test.describe('pages at rest', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  for (const [name, path] of Object.entries(PAGES)) {
    test(`${name} has no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

// The route preview draws either map depending on the device; both have to pass.
for (const map of ['3b', 'duz']) {
  test(`route preview has no accessibility violations (harita=${map})`, async ({ page }) => {
    await page.goto(`./turlar/kapadokya/rota/?harita=${map}`);
    await expect(page.locator('[data-route-app]')).toHaveAttribute('data-ready', 'true');
    await waitForStillness(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('the home page map has no accessibility violations once it is interactive', async ({
  page,
}) => {
  await page.goto('./?harita=3b');
  const map = page.locator('[data-tour-map]');
  await map.scrollIntoViewIfNeeded();
  await expect(map).toHaveAttribute('data-ready', 'true', { timeout: 15_000 });
  await waitForStillness(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the locked panel has no accessibility violations', async ({ page }) => {
  await page.goto('./yonetim/');
  await expect(page.locator('[data-admin]')).toHaveAttribute('data-access', 'locked');
  await waitForStillness(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('every screen of the operations panel is free of accessibility violations', async ({
  page,
}) => {
  await openPanelPage(page, './yonetim/');
  await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');
  const screens = [
    '/site',
    '/',
    '/turlar',
    '/turlar/kapadokya',
    '/turlar/kapadokya/kalkis/kapadokya-2026-11-06',
    '/turlar/kapadokya/program',
    '/turlar/kapadokya/liste/dahil',
    '/turlar/kapadokya/konaklama',
    '/kalkis/kapadokya-2026-11-06',
    '/yolcular',
    '/yolcular/yeni',
    '/gecmis',
    '/gecmis/yeni',
    '/gecmis/2026-09-18-kapadokya',
  ];
  for (const screen of screens) {
    await goToScreen(page, screen);
    if (screen === '/site') {
      await page.getByRole('button', { name: /Örnek Yolcuları Yükle/ }).click();
      // The toast fades out on its own timer, unless the pointer rests on it; a later check
      // must not catch it halfway.
      await page.mouse.move(0, 0);
      await expect(page.locator('.toast__text')).toHaveText('', { timeout: 10_000 });
    }
    await waitForStillness(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, screen).toEqual([]);
  }

  // An open sheet, with the page behind it out of reach.
  await goToScreen(page, '/yolcular');
  await page.locator('.passenger-row').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await waitForStillness(page);
  const sheet = await new AxeBuilder({ page }).analyze();
  expect(sheet.violations, 'passenger sheet').toEqual([]);

  // The sheet that changes a moment of a past journey, with its picture strip.
  await goToScreen(page, '/gecmis/2026-09-18-kapadokya');
  await page.getByRole('button', { name: /^Ihlara Vadisi/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await waitForStillness(page);
  const moment = await new AxeBuilder({ page }).analyze();
  expect(moment.violations, 'moment sheet').toEqual([]);
});
