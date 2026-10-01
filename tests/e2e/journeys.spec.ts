import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, goToScreen, openPanelPage, trackErrors } from './support';

const ARCHIVE = './gecmis-turlar/';
const JOURNEY = '2026-09-18-kapadokya';

async function openPanel(page: Page, path: string): Promise<void> {
  await openPanelPage(page, './yonetim/');
  await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');
  await goToScreen(page, path);
}

test('the archive lists past journeys, adds them up and filters them', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(ARCHIVE);
  const journeys = page.locator('[data-journey-card]:visible');
  await expect(journeys).toHaveCount(7);
  await expect(page.locator('[data-journey-totals]')).toHaveText(
    '7 turda 264 misafirle yaklaşık 6.310 km yol yapıldı.',
  );

  await page.getByText('Okul Gezisi', { exact: true }).first().click();
  await expect(journeys).toHaveCount(1);
  await expect(journeys).toContainText('Beypazarı Günübirlik Turu');
  await page.getByText('Tümü', { exact: true }).click();
  await expect(journeys).toHaveCount(7);
  expectNoErrors(errors);
});

test('a journey page tells the journey and leads to its tour', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto(ARCHIVE);
  await page.getByRole('link', { name: 'Kapadokya Kültür Turu' }).first().click();
  await expect(page).toHaveURL(new RegExp(`/gecmis-turlar/${JOURNEY}/$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kapadokya Kültür Turu');
  await expect(page.locator('.moment')).toHaveCount(4);
  await expect(page.locator('.moment').first()).toContainText('1. Gün, 18 Eylül Cuma');

  await page.getByRole('link', { name: 'Programı İncele' }).click();
  await expect(page).toHaveURL(/\/turlar\/kapadokya\/$/);
  // The tour page offers its own past dates in return.
  await expect(page.getByRole('heading', { name: 'Bu Turun Geçmiş Tarihleri' })).toBeVisible();
  expectNoErrors(errors);
});

test('a journey hidden in the panel leaves the archive and the totals', async ({ page }) => {
  await openPanel(page, `/gecmis/${JOURNEY}`);
  await page.getByText('Sitede Göster').click();
  await expect(page.locator('.toast')).toContainText('Kayıt sitede gizlendi.');

  await page.goto(ARCHIVE);
  await expect(page.locator(`[data-journey-card="${JOURNEY}"]`)).toBeHidden();
  await expect(page.locator('[data-journey-card]:visible')).toHaveCount(6);
  await expect(page.locator('[data-journey-totals]')).toHaveText(
    '6 turda 223 misafirle yaklaşık 5.460 km yol yapıldı.',
  );
});

test('a journey recorded in the panel joins the archive of the same device', async ({ page }) => {
  const errors = trackErrors(page);
  await openPanel(page, '/gecmis');
  await page.getByRole('link', { name: 'Geçmiş Tur Ekle' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Geçmiş Tur Ekle' })).toBeVisible();
  await page.getByLabel('Tur', { exact: true }).selectOption('safranbolu-amasra');
  await page.getByLabel('Başlangıç Tarihi').fill('2026-09-12');
  await page.getByLabel('Başlangıç Tarihi').dispatchEvent('change');
  await expect(page.getByLabel('Bitiş Tarihi')).toHaveValue('2026-09-13');
  await page.locator('.seg__option', { hasText: 'Okul Gezisi' }).click();
  await page.getByLabel('Misafir Sayısı').fill('42');
  await page
    .getByLabel('Tur Notu')
    .fill('Bir lisenin öğrencileriyle Safranbolu ve Amasra gezildi.');
  await page.getByRole('button', { name: 'Kaydı Oluştur' }).click();
  await expect(page.locator('.toast')).toContainText('Geçmiş tur kaydı oluşturuldu.');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Safranbolu ve Amasra Turu' }),
  ).toBeVisible();

  // A moment, chosen from the tour's programme.
  await page.getByRole('button', { name: 'Not Ekle' }).click();
  await page.getByLabel('Programdan Seç').selectOption({ label: '2. Gün: Amasra Kalesi' });
  await expect(page.getByLabel('Yer', { exact: true })).toHaveValue('Amasra Kalesi');
  await page.getByLabel('Not', { exact: true }).fill('Surlarda sınıf fotoğrafı çekildi.');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.locator('.toast')).toContainText('Not kaydedildi.');
  await expect(page.locator('.row', { hasText: 'Amasra Kalesi' })).toContainText('2. Gün');

  await page.goto(ARCHIVE);
  const recorded = page.locator('[data-journey-card="2026-09-12-safranbolu-amasra"]');
  await expect(recorded).toBeVisible();
  await expect(recorded).toContainText('12-13 Eylül 2026');
  await expect(recorded).toContainText('Okul Gezisi');
  await expect(recorded.getByRole('link')).toHaveAttribute(
    'href',
    /\/turlar\/safranbolu-amasra\/$/,
  );
  await expect(page.locator('[data-journey-totals]')).toHaveText(
    '8 turda 306 misafirle yaklaşık 6.900 km yol yapıldı.',
  );
  expectNoErrors(errors);
});

test('a journey changed in the panel reads as changed on its page', async ({ page }) => {
  await openPanel(page, `/gecmis/${JOURNEY}`);
  await page.locator('.row', { hasText: 'Misafir Sayısı' }).click();
  await page.getByRole('spinbutton', { name: 'Misafir Sayısı' }).fill('43');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.locator('.toast')).toContainText('Kaydedildi.');

  await page.getByRole('button', { name: /^Mustafapaşa/ }).click();
  await page.getByRole('button', { name: 'Notu Sil' }).click();
  await expect(page.locator('.toast')).toContainText('Not silindi.');

  await page.goto(`./gecmis-turlar/${JOURNEY}/`);
  await expect(page.locator('.facts')).toContainText('43');
  await expect(page.locator('.moment')).toHaveCount(3);
  await expect(page.locator('.moment', { hasText: 'Mustafapaşa' })).toHaveCount(0);
});
