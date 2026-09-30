import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, openPanelPage, trackErrors } from './support';

// The test browser draws on the processor; the address asks for the 3D map anyway.
const STUDIO = './yonetim/video/?harita=3b';

async function openStudio(page: Page): Promise<void> {
  await openPanelPage(page, STUDIO);
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'ready', {
    timeout: 30_000,
  });
}

/** Ticks a setting and waits for the film to be rebuilt with it. */
async function choose(page: Page, label: string): Promise<void> {
  await page.getByText(label, { exact: true }).click();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'ready');
}

test('the studio is behind the panel lock', async ({ page }) => {
  await page.goto(STUDIO);
  await expect(page.locator('[data-admin]')).toHaveAttribute('data-access', 'locked');
  await expect(page.getByRole('button', { name: 'Videoyu Oluştur' })).toBeHidden();
  await expect(page.locator('[data-studio]')).toHaveAttribute('data-state', 'loading');
});

test('settings reshape the film and the frame', async ({ page }) => {
  const errors = trackErrors(page);
  await openStudio(page);
  const studio = page.locator('[data-studio]');
  const summary = page.locator('[data-summary]');
  await expect(summary).toContainText('2160 × 3840 piksel');

  await choose(page, 'Yatay (16:9)');
  await expect(studio).toHaveAttribute('data-format', 'wide');
  await expect(summary).toContainText('3840 × 2160 piksel');
  const canvas = page.locator('[data-film-canvas]');
  expect(await canvas.evaluate((node: HTMLCanvasElement) => node.width / node.height)).toBeCloseTo(
    16 / 9,
    2,
  );

  await choose(page, 'Full HD');
  await expect(summary).toContainText('1920 × 1080 piksel');

  // A film of one day asks which day, and is shorter than the whole journey.
  const whole = await summary.textContent();
  await expect(page.getByLabel('Gün', { exact: true })).toBeHidden();
  await choose(page, 'Gün Videosu');
  await expect(page.getByLabel('Gün', { exact: true })).toBeVisible();
  await expect(summary).not.toHaveText(whole ?? '');
  expectNoErrors(errors);
});

test('the studio has no accessibility violations', async ({ page }) => {
  await openStudio(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('a film is written to an MP4 file that can be downloaded', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop',
    'Encoding is exercised once, on the desktop project',
  );
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await openStudio(page);

  const encodes = await page.evaluate(async () => {
    const support = await VideoEncoder.isConfigSupported({
      codec: 'avc1.640028',
      width: 720,
      height: 720,
      bitrate: 3_000_000,
      framerate: 30,
    });
    return support.supported === true;
  });
  test.skip(!encodes, 'This browser build has no H.264 encoder');

  // The shortest film there is: the road of the day trip drawing itself, as a small square.
  await page
    .getByLabel('Tur', { exact: true })
    .selectOption({ label: 'Beypazarı Günübirlik Turu' });
  await choose(page, 'Rota Çizimi');
  await choose(page, 'Kare (1:1)');
  await choose(page, 'Taslak');
  await expect(page.locator('[data-summary]')).toContainText('720 × 720 piksel');

  await page.getByRole('button', { name: 'Videoyu Oluştur' }).click();
  const studio = page.locator('[data-studio]');
  await expect(studio).toHaveAttribute('data-state', 'done', { timeout: 100_000 });
  await expect(page.locator('[data-studio-message]')).toContainText('Video hazır.');

  const downloading = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Videoyu İndir' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('beypazari-gunubirlik-outline-square-draft.mp4');
  const file = await readFile(await download.path());
  // An MP4 file opens with a box of type "ftyp".
  expect(file.subarray(4, 8).toString('latin1')).toBe('ftyp');
  expect(file.byteLength).toBeGreaterThan(100_000);

  await page.getByRole('button', { name: 'Yeni Video' }).click();
  await expect(studio).toHaveAttribute('data-state', 'ready');
  expectNoErrors(errors);
});
