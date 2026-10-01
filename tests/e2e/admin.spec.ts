import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { TEST_PANEL_CODE } from '../panelCode';
import { expectNoErrors, openPanelPage, trackErrors } from './support';

const PANEL = './yonetim/';
const KAPADOKYA = 'Kapadokya Kültür Turu, 6-8 Kasım 2026';

async function openPanel(page: Page): Promise<void> {
  await openPanelPage(page, PANEL);
  await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');
}

async function addPassenger(page: Page, name: string, seat: number): Promise<void> {
  await page.getByRole('button', { name: 'Yolcu Ekle' }).click();
  const form = page.locator('[data-form]');
  await form.getByLabel('Kalkış').selectOption({ label: KAPADOKYA });
  await form.getByLabel('Ad Soyad').fill(name);
  await form.getByLabel('Telefon').fill('0500 000 00 09');
  await page.locator(`.seat-option:has(input[value="${seat}"])`).click();
  await page.getByRole('button', { name: '1.000', exact: true }).click();
  await page.getByText('Havale', { exact: true }).click();
  await page.getByRole('button', { name: 'Yolcuyu Kaydet' }).click();
  await expect(page.locator('[data-toast-text]')).toHaveText('Yolcu kaydedildi.');
}

test('a passenger recorded in the panel appears in the list and the summary', async ({ page }) => {
  const errors = trackErrors(page);
  await openPanel(page);
  await expect(page.locator('[data-stat="passengers"]')).toHaveText('0');

  // Seat 15 is free on this departure in the sample content.
  await addPassenger(page, 'Deneme Yolcu', 15);

  await page.getByRole('button', { name: 'Yolcu Listesi' }).click();
  const row = page.locator('.list__row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Deneme Yolcu');
  await expect(row).toContainText('0 (500) 000 00 09');
  await expect(row).toContainText('₺1.000 Havale');

  await page.getByRole('button', { name: 'Özet' }).click();
  await expect(page.locator('[data-stat="passengers"]')).toHaveText('1');
  await expect(page.locator('[data-stat="deposits"]')).toHaveText('₺1.000');
  expectNoErrors(errors);
});

test('a recorded passenger can be changed from the list', async ({ page }) => {
  const errors = trackErrors(page);
  await openPanel(page);
  await addPassenger(page, 'Deneme Yolcu', 15);
  await page.getByRole('button', { name: 'Yolcu Listesi' }).click();
  await page.getByRole('button', { name: 'Düzenle: Deneme Yolcu' }).click();

  // The record fills the form, its own seat chosen and free to keep.
  await expect(page.getByRole('heading', { name: 'Yolcu Bilgilerini Düzenle' })).toBeFocused();
  const form = page.locator('[data-form]');
  await expect(form.getByLabel('Ad Soyad')).toHaveValue('Deneme Yolcu');
  await expect(form.getByLabel('Kapora (TL)')).toHaveValue('1.000');
  await expect(form.locator('input[name="seatNumber"][value="15"]')).toBeChecked();

  await form.getByLabel('Ad Soyad').fill('Deneme Yolcu Kaya');
  await page.locator('.seat-option:has(input[value="16"])').click();
  await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();

  await expect(page.locator('[data-toast-text]')).toHaveText('Yolcu bilgileri güncellendi.');
  await expect(page.getByRole('heading', { name: 'Yolcu Listesi' })).toBeFocused();
  const row = page.locator('.list__row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Deneme Yolcu Kaya');
  await expect(row.locator('.list__seat')).toContainText('16');

  // The form is for new passengers again.
  await page.getByRole('button', { name: 'Yolcu Ekle' }).click();
  await expect(page.getByRole('heading', { name: 'Yolcu Ekle' })).toBeVisible();
  await expect(form.getByLabel('Ad Soyad')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Vazgeç' })).toBeHidden();
  expectNoErrors(errors);
});

test('a change can be abandoned without touching the record', async ({ page }) => {
  await openPanel(page);
  await addPassenger(page, 'Deneme Yolcu', 15);
  await page.getByRole('button', { name: 'Yolcu Listesi' }).click();
  await page.getByRole('button', { name: 'Düzenle: Deneme Yolcu' }).click();

  await page.locator('[data-form]').getByLabel('Ad Soyad').fill('Başka Biri');
  await page.getByRole('button', { name: 'Vazgeç' }).click();

  await expect(page.getByRole('heading', { name: 'Yolcu Listesi' })).toBeFocused();
  await expect(page.locator('.list__row')).toContainText('Deneme Yolcu');
  await expect(page.locator('.list__row')).not.toContainText('Başka Biri');
});

test('an empty form explains what is missing', async ({ page }) => {
  await openPanel(page);
  await page.getByRole('button', { name: 'Yolcu Ekle' }).click();
  await page.getByRole('button', { name: 'Yolcuyu Kaydet' }).click();

  await expect(page.locator('[data-error-for="fullName"]')).toHaveText('Ad ve soyad yazınız.');
  await expect(page.locator('[data-error-for="phone"]')).toHaveText('Telefon numarası yazınız.');
  await expect(page.locator('[data-error-for="seatNumber"]')).toHaveText('Bir koltuk seçiniz.');
  await expect(page.getByLabel('Ad Soyad')).toBeFocused();
  await expect(page.getByLabel('Ad Soyad')).toHaveAttribute('aria-invalid', 'true');
});

test('the public tour page counts a seat recorded on the same device', async ({ page }) => {
  await page.goto('./turlar/kapadokya/');
  const meter = page.locator('.fare [data-occupancy]');
  await expect(meter.locator('[data-occupancy-status]')).toHaveText('Kalan Koltuk: 12');

  await openPanel(page);
  await addPassenger(page, 'Deneme Yolcu', 15);

  await page.goto('./turlar/kapadokya/');
  await expect(meter.locator('[data-occupancy-status]')).toHaveText('Kalan Koltuk: 11');
  await expect(page.locator('.seat-map__svg:visible [data-seat="15"]')).toHaveClass(/seat--taken/);
});

test('a removed passenger can be restored', async ({ page }) => {
  await openPanel(page);
  await addPassenger(page, 'Deneme Yolcu', 15);
  await page.getByRole('button', { name: 'Yolcu Listesi' }).click();

  await page.getByRole('button', { name: 'Kaydı Sil: Deneme Yolcu' }).click();
  await expect(page.locator('.list__row')).toHaveCount(0);
  await page.getByRole('button', { name: 'Geri Al' }).click();
  await expect(page.locator('.list__row')).toHaveCount(1);
});

test('the insurance list downloads as a CSV file', async ({ page }) => {
  await openPanel(page);
  await addPassenger(page, 'Deneme Yolcu', 15);
  await page.getByRole('button', { name: 'Yolcu Listesi' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Sigorta Listesini İndir' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('sigorta-listesi-kapadokya-2026-11-06.csv');
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('Sıra;Ad Soyad;Telefon;Koltuk;Tur;Kalkış Tarihi');
  expect(csv).toContain(
    '1;Deneme Yolcu;0 (500) 000 00 09;15;Kapadokya Kültür Turu;6 Kasım 2026 Cuma',
  );
});

test('sample data loads and the demo can be reset', async ({ page }) => {
  await openPanel(page);
  await page.getByRole('button', { name: 'Örnek Verileri Yükle' }).click();
  await expect(page.locator('[data-stat="passengers"]')).toHaveText('6');

  await page.getByRole('button', { name: 'Demo Verilerini Sıfırla' }).click();
  await expect(page.locator('[data-stat="passengers"]')).toHaveText('0');
});

test('the panel refuses to run inside another page', async ({ page, baseURL }) => {
  const panelUrl = new URL(PANEL, baseURL).href;
  // A page that does not belong to the site and puts the panel in a frame.
  const hostUrl = new URL('/cerceveleyen-sayfa', baseURL).href;
  await page.route(hostUrl, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><iframe src="${panelUrl}" width="400" height="700"></iframe>`,
    }),
  );
  await page.goto(hostUrl);

  const panel = page.frameLocator('iframe').locator('[data-admin]');
  await expect(panel).toHaveAttribute('data-framed', 'true');
  await expect(panel).not.toHaveAttribute('data-ready', 'true');
  await expect(panel.getByText('başka bir sayfanın içinde')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Demo Verilerini Sıfırla' })).toBeHidden();
});

test.describe('the lock', () => {
  test('keeps the panel out of sight until the right code is given', async ({ page }) => {
    await page.goto(PANEL);
    const panel = page.locator('[data-admin]');
    await expect(panel).toHaveAttribute('data-access', 'locked');
    await expect(page.getByRole('heading', { name: 'Panel Kilitli' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Örnek Verileri Yükle' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Panel Bölümleri' })).toBeHidden();

    await page.getByLabel('Erişim Kodu').fill('yanlis-kod');
    await page.getByRole('button', { name: 'Paneli Aç' }).click();
    await expect(page.getByRole('alert')).toHaveText('Erişim kodu hatalı.');
    await expect(panel).toHaveAttribute('data-access', 'locked');
    await expect(panel).not.toHaveAttribute('data-ready', 'true');

    await page.getByLabel('Erişim Kodu').fill(TEST_PANEL_CODE);
    await page.getByRole('button', { name: 'Paneli Aç' }).click();
    await expect(panel).toHaveAttribute('data-ready', 'true');
    await expect(page.getByRole('button', { name: 'Örnek Verileri Yükle' })).toBeVisible();
  });

  test('stays open for the tab and can be locked again', async ({ page }) => {
    await openPanel(page);
    await page.reload();
    await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');

    await page.getByRole('button', { name: 'Kilitle' }).click();
    await expect(page.locator('[data-admin]')).toHaveAttribute('data-access', 'locked');
    await expect(page.getByRole('button', { name: 'Örnek Verileri Yükle' })).toBeHidden();
  });

  test('is forgotten by a new visit unless the device is remembered', async ({ page, context }) => {
    await page.goto(PANEL);
    await page.getByLabel('Erişim Kodu').fill(TEST_PANEL_CODE);
    await page.getByLabel('Bu Cihazda Hatırla').check();
    await page.getByRole('button', { name: 'Paneli Aç' }).click();
    await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');

    // A new tab shares the device's storage but not the first tab's session.
    const second = await context.newPage();
    await second.goto(PANEL);
    await expect(second.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');
  });
});

test('no public page links to the panel', async ({ page }) => {
  for (const path of ['./', './turlar/', './turlar/kapadokya/', './kurumsal/', './iletisim/']) {
    await page.goto(path);
    await expect(page.locator('a[href*="yonetim"]')).toHaveCount(0);
  }
});
