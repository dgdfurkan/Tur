import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { TEST_PANEL_CODE } from '../panelCode';
import { expectNoErrors, goToScreen, openPanelPage, trackErrors } from './support';

const PANEL = './yonetim/';
/** A departure with free seats 15, 16 and 24 in the sample content. */
const KAPADOKYA = 'kapadokya-2026-11-06';

async function openPanel(page: Page, path = '/'): Promise<void> {
  await openPanelPage(page, PANEL);
  await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');
  if (path !== '/') await go(page, path);
}

const go = goToScreen;

const toast = (page: Page) => page.locator('.toast');

async function addPassenger(page: Page, name: string, seat: number): Promise<void> {
  await go(page, `/yolcular/yeni?kalkis=${KAPADOKYA}`);
  await page.getByLabel('Ad Soyad').fill(name);
  await page.getByLabel('Telefon', { exact: true }).fill('0500 000 00 09');
  await page.locator(`label.seat:has(input[value="${seat}"])`).click();
  await page.getByRole('button', { name: '1.000', exact: true }).click();
  await page.locator('.seg__option', { hasText: 'Havale' }).click();
  await page.getByRole('button', { name: 'Yolcuyu Kaydet' }).click();
  await expect(toast(page)).toContainText('Yolcu kaydedildi.');
  // Saving goes back to the screen before the form; wait until it is there.
  await expect(page).not.toHaveURL(/yolcular\/yeni/);
}

test('a passenger recorded in the panel appears in the list and the figures', async ({ page }) => {
  const errors = trackErrors(page);
  await openPanel(page);
  const recorded = page.locator('.stat', { hasText: 'Kayıtlı Yolcu' }).locator('.stat__value');
  await expect(recorded).toHaveText('0');

  await page.getByRole('link', { name: 'Yolcu Ekle' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Yolcu Ekle' })).toBeVisible();
  await page.getByLabel('Kalkış').selectOption(KAPADOKYA);
  await page.getByLabel('Ad Soyad').fill('Deneme Yolcu');
  await page.getByLabel('Telefon', { exact: true }).fill('0500 000 00 09');
  await page.locator('label.seat:has(input[value="15"])').click();
  await page.getByRole('button', { name: '1.000', exact: true }).click();
  await page.locator('.seg__option', { hasText: 'Havale' }).click();
  await page.getByRole('button', { name: 'Yolcuyu Kaydet' }).click();

  // Saving returns to where the form was opened from.
  await expect(toast(page)).toContainText('Yolcu kaydedildi.');
  await expect(page.getByRole('heading', { level: 1, name: 'Özet' })).toBeVisible();
  await expect(recorded).toHaveText('1');

  await page
    .getByRole('navigation', { name: 'Panel Bölümleri' })
    .getByRole('link', { name: 'Yolcular' })
    .click();
  const row = page.locator('.passenger-row');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Deneme Yolcu');
  await expect(row).toContainText('0 (500) 000 00 09');
  await expect(row).toContainText('₺1.000');
  expectNoErrors(errors);
});

test('the passenger form explains what is missing', async ({ page }) => {
  await openPanel(page, '/yolcular/yeni');
  await page.getByRole('button', { name: 'Yolcuyu Kaydet' }).click();

  await expect(page.locator('[data-error-for="fullName"]')).toHaveText('Ad ve soyad yazınız.');
  await expect(page.locator('[data-error-for="phone"]')).toHaveText('Telefon numarası yazınız.');
  await expect(page.locator('[data-error-for="seatNumber"]')).toHaveText('Bir koltuk seçiniz.');
  await expect(page.getByLabel('Ad Soyad')).toBeFocused();
  await expect(page.getByLabel('Ad Soyad')).toHaveAttribute('aria-invalid', 'true');
});

test('a passenger can be changed, removed and brought back', async ({ page }) => {
  await openPanel(page);
  await addPassenger(page, 'Deneme Yolcu', 15);
  await go(page, '/yolcular');

  await page.locator('.passenger-row', { hasText: 'Deneme Yolcu' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('heading', { name: 'Deneme Yolcu' })).toBeVisible();
  await expect(sheet).toContainText('Kalan Ödeme');
  await sheet.getByRole('link', { name: 'Düzenle' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Yolcuyu Düzenle' })).toBeVisible();
  await expect(page.getByLabel('Ad Soyad')).toHaveValue('Deneme Yolcu');
  await expect(page.locator('input[name="seatNumber"][value="15"]')).toBeChecked();
  await page.getByLabel('Ad Soyad').fill('Deneme Yolcu Kaya');
  await page.locator('label.seat:has(input[value="16"])').click();
  await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();
  await expect(toast(page)).toContainText('Yolcu bilgileri güncellendi.');
  await expect(page).toHaveURL(/#\/yolcular$/);

  const row = page.locator('.passenger-row');
  await expect(row).toContainText('Deneme Yolcu Kaya');
  await expect(row.locator('.seat-badge')).toHaveText('16');

  await row.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Kaydı Sil' }).click();
  await expect(toast(page)).toContainText('Kayıt silindi.');
  await expect(page.getByRole('heading', { name: 'Henüz Yolcu Kaydı Yok' })).toBeVisible();
  await toast(page).getByRole('button', { name: 'Geri Al' }).click();
  await expect(toast(page)).toContainText('Kayıt geri alındı.');
  await expect(page.locator('.passenger-row')).toContainText('Deneme Yolcu Kaya');
});

test('the public tour page counts a seat recorded on the same device', async ({ page }) => {
  await page.goto('./turlar/kapadokya/');
  const meter = page.locator(`[data-occupancy][data-departure-id="${KAPADOKYA}"]`).first();
  const before = await meter.locator('[data-occupancy-status]').textContent();

  await openPanel(page);
  await addPassenger(page, 'Deneme Yolcu', 15);

  await page.goto('./turlar/kapadokya/');
  await expect(meter.locator('[data-occupancy-status]')).not.toHaveText(before ?? '');
  await expect(
    page.locator(`[data-seat-map][data-departure-id="${KAPADOKYA}"] [data-seat="15"]`),
  ).toHaveClass(/seat--taken/);
});

test('a price changed in the panel shows on the pages of this device', async ({ page }) => {
  await openPanel(page, '/turlar/kapadokya');
  await page.getByRole('button', { name: /Kişi Başı/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('textbox', { name: 'Tutar' }).fill('10.500');
  await expect(sheet).toContainText('₺9.850 → ₺10.500');
  await sheet.getByRole('button', { name: 'Kaydet' }).click();
  await expect(toast(page)).toContainText('Fiyat güncellendi.');
  await expect(page.getByRole('button', { name: /Kişi Başı/ })).toContainText('₺10.500');

  await page.goto('./turlar/kapadokya/');
  await expect(page.locator('.fare__price')).toHaveText('₺10.500');
  await page.goto('./turlar/');
  await expect(page.locator('[data-price-for="kapadokya"]')).toHaveText('₺10.500');
});

test('a hidden tour leaves the lists of the site on this device', async ({ page }) => {
  await openPanel(page, '/turlar/kapadokya');
  await page.getByRole('switch', { name: /Sitede Göster/ }).uncheck();
  await expect(toast(page)).toContainText('Tur listelerden kaldırıldı.');
  await go(page, '/turlar');
  await expect(page.locator('.tour-row', { hasText: 'Kapadokya' })).toContainText('Gizli');

  await page.goto('./turlar/');
  await expect(page.locator('main [data-tour-card="kapadokya"]')).toBeHidden();
  await expect(page.locator('main [data-tour-card="ege-klasikleri"]')).toBeVisible();
  // The footer lists it no more either.
  await expect(page.locator('footer [data-tour-card="kapadokya"]')).toBeHidden();
});

test('a departure can be added, sold in part and removed', async ({ page }) => {
  await openPanel(page, '/turlar/beypazari-gunubirlik');
  await page.getByRole('link', { name: 'Kalkış Ekle' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Yeni Kalkış' })).toBeVisible();
  await page.getByLabel('Gidiş Tarihi').fill('2027-01-09');
  await page.getByLabel('Dönüş Tarihi').fill('2027-01-09');
  await page.getByRole('button', { name: 'Koltuk 24, Boş' }).click();
  await expect(page.getByRole('button', { name: 'Koltuk 24, Satıldı' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(toast(page)).toContainText('Kalkış eklendi.');

  const added = page.locator('.departure-row', { hasText: '9 Ocak 2027' });
  await expect(added).toBeVisible();
  await added.click();
  await page.getByRole('button', { name: 'Kalkışı Sil' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Kalkışı Sil' }).click();
  await expect(toast(page)).toContainText('Kalkış silindi.');
  await expect(page.locator('.departure-row', { hasText: '9 Ocak 2027' })).toHaveCount(0);
});

test('the insurance list of a departure downloads as a CSV file', async ({ page }) => {
  await openPanel(page);
  await addPassenger(page, 'Deneme Yolcu', 15);
  await go(page, `/kalkis/${KAPADOKYA}`);

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Sigorta Listesini İndir' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe(`sigorta-listesi-${KAPADOKYA}.csv`);
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain('Deneme Yolcu');
});

test('records move to another device through a backup', async ({ page }) => {
  await openPanel(page);
  await addPassenger(page, 'Yedek Yolcu', 15);
  await go(page, '/site');

  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Yedek Al/ }).click();
  const backup = await (await downloading).path();

  await page.getByRole('button', { name: /Tüm Kayıtları Sil/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tüm Kayıtları Sil' }).click();
  await expect(toast(page)).toContainText('Tüm kayıtlar silindi.');

  await page.locator('input[type="file"]').setInputFiles(backup);
  await page.getByRole('dialog').getByRole('button', { name: 'Yedekten Geri Yükle' }).click();
  await expect(toast(page)).toContainText('Yedek yüklendi.');
  await go(page, '/yolcular');
  await expect(page.locator('.passenger-row')).toContainText('Yedek Yolcu');
});

test('sample passengers load and every record can be cleared', async ({ page }) => {
  await openPanel(page, '/site');
  await page.getByRole('button', { name: /Örnek Yolcuları Yükle/ }).click();
  await expect(toast(page)).toContainText('Örnek yolcu eklendi: 6.');

  await page.getByRole('button', { name: /Tüm Kayıtları Sil/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tüm Kayıtları Sil' }).click();
  await go(page, '/');
  await expect(
    page.locator('.stat', { hasText: 'Kayıtlı Yolcu' }).locator('.stat__value'),
  ).toHaveText('0');
});

test('the back arrow returns to the screen it came from', async ({ page }) => {
  await openPanel(page, '/turlar');
  await page.locator('.tour-row', { hasText: 'Ege Klasikleri' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ege Klasikleri Turu' })).toBeVisible();
  await page.locator('.topbar__back').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Turlar' })).toBeVisible();
  await expect(page).toHaveURL(/#\/turlar$/);
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
  await expect(panel.getByLabel('Erişim Kodu')).toBeHidden();
});

test.describe('the lock', () => {
  test('keeps the panel out of sight until the right code is given', async ({ page }) => {
    await page.goto(PANEL);
    const panel = page.locator('[data-admin]');
    await expect(panel).toHaveAttribute('data-access', 'locked');
    await expect(page.getByRole('heading', { name: 'Operasyon Paneli' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Panel Bölümleri' })).toBeHidden();

    await page.getByLabel('Erişim Kodu').fill('yanlis-kod');
    await page.getByRole('button', { name: 'Paneli Aç' }).click();
    await expect(page.getByRole('alert')).toHaveText('Erişim kodu hatalı.');
    await expect(panel).toHaveAttribute('data-access', 'locked');
    await expect(panel).not.toHaveAttribute('data-ready', 'true');

    await page.getByLabel('Erişim Kodu').fill(TEST_PANEL_CODE);
    await page.getByRole('button', { name: 'Paneli Aç' }).click();
    await expect(panel).toHaveAttribute('data-ready', 'true');
    await expect(page.getByRole('navigation', { name: 'Panel Bölümleri' })).toBeVisible();
  });

  test('stays open for the tab and can be locked again', async ({ page }) => {
    await openPanel(page, '/site');
    await page.reload();
    await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');

    await page.getByRole('button', { name: 'Paneli Kilitle' }).last().click();
    await expect(page.locator('[data-admin]')).toHaveAttribute('data-access', 'locked');
    await expect(page.getByRole('navigation', { name: 'Panel Bölümleri' })).toBeHidden();
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
  for (const path of [
    './',
    './turlar/',
    './turlar/kapadokya/',
    './takvim/',
    './gecmis-turlar/',
    './gecmis-turlar/2026-09-18-kapadokya/',
    './sss/',
    './kurumsal/',
    './iletisim/',
  ]) {
    await page.goto(path);
    await expect(page.locator('a[href*="yonetim"]')).toHaveCount(0);
  }
});
