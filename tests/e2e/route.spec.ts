import { expect, test } from '@playwright/test';
import { expectNoErrors, trackErrors } from './support';

const ROUTE = './turlar/kapadokya/rota/';

/**
 * The journey is tested on both maps. Which one a visitor gets depends on the
 * device's graphics, so here the address asks for each of them in turn.
 */
const MAPS = [
  { name: '3D map', kind: '3d', address: `${ROUTE}?harita=3b` },
  { name: 'flat map', kind: 'flat', address: `${ROUTE}?harita=duz` },
] as const;

for (const map of MAPS) {
  test.describe(`on the ${map.name}`, () => {
    test('the simulation starts after the boarding pass and reaches the first stop', async ({
      page,
    }) => {
      const errors = trackErrors(page);
      await page.goto(map.address);
      const app = page.locator('[data-route-app]');
      await expect(app).toHaveAttribute('data-ready', 'true');
      await expect(app).toHaveAttribute('data-map', map.kind);
      await expect(app).toHaveAttribute('data-state', 'intro');

      await page.getByRole('button', { name: 'Simülasyonu Başlat' }).click();
      await expect(page.locator('[data-boarding-pass]')).toBeVisible();
      await expect(app).toHaveAttribute('data-state', 'running', { timeout: 10_000 });
      await expect(page.locator('[data-card-title]')).toHaveText('Tuz Gölü');
      await expect(page.locator('[data-stop-index="1"]')).toHaveAttribute('aria-current', 'step', {
        timeout: 10_000,
      });
      expectNoErrors(errors);
    });

    test('a stop chosen from the list is shown on the card', async ({ page }) => {
      await page.goto(map.address);
      const app = page.locator('[data-route-app]');
      await expect(app).toHaveAttribute('data-ready', 'true');

      // On a phone the list lives in a sheet that has to be opened first.
      const sheetToggle = page.getByRole('button', { name: 'Durakları Göster' });
      if (await sheetToggle.isVisible()) await sheetToggle.click();

      await page.getByRole('button', { name: 'Göreme Açık Hava Müzesi' }).click();
      await expect(page.locator('[data-card-title]')).toHaveText('Göreme Açık Hava Müzesi');
      await expect(page.locator('[data-card-kind]')).toHaveText('Gezi Noktası');
      await expect(page.locator('[data-panel-day]')).toHaveText('2. Gün');
      await expect(app).toHaveAttribute('data-state', 'running');
    });

    test.describe('with reduced motion', () => {
      test.use({ reducedMotion: 'reduce' });

      test('the coach moves one stop per press instead of driving', async ({ page }) => {
        await page.goto(map.address);
        const app = page.locator('[data-route-app]');
        await expect(app).toHaveAttribute('data-step', 'true');

        await page.getByRole('button', { name: 'Simülasyonu Başlat' }).click();
        await expect(app).toHaveAttribute('data-state', 'running', { timeout: 10_000 });
        await expect(page.locator('[data-card-title]')).toHaveText('Ankara, Kızılay');

        await page.locator('[data-action="toggle"]').click();
        await expect(page.locator('[data-card-title]')).toHaveText('Tuz Gölü');
      });
    });
  });
}

test.describe('on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'The stop list is a sheet only on narrow screens');

  test('the list button stays on screen however much the card has to say', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('[data-route-app]')).toHaveAttribute('data-ready', 'true');
    const toggle = page.locator('[data-action="sheet"]');

    // Ihlara Vadisi fills the card: a kind, a duration and two lines of text.
    await toggle.click();
    await page.getByRole('button', { name: 'Ihlara Vadisi' }).click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeInViewport({ ratio: 1 });
  });

  test('the closed list is out of reach until the sheet is opened', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.locator('[data-route-app]')).toHaveAttribute('data-ready', 'true');
    const stop = page.getByRole('button', { name: 'Ihlara Vadisi' });

    await expect(stop).toBeHidden();
    await page.locator('[data-action="sheet"]').click();
    await expect(stop).toBeVisible();
  });
});

test('the back link returns to the tour page', async ({ page }) => {
  await page.goto(ROUTE);
  await page.getByRole('link', { name: /Kapadokya Kültür Turu/ }).click();
  await expect(page).toHaveURL(/\/turlar\/kapadokya\/$/);
});
