import { expect, test, type Page } from '@playwright/test';
import { goToScreen, openPanelPage } from './support';

async function openPanel(page: Page, path: string): Promise<void> {
  await openPanelPage(page, './yonetim/');
  await expect(page.locator('[data-admin]')).toHaveAttribute('data-ready', 'true');
  await goToScreen(page, path);
}

test('the calendar lists every departure by month and filters them', async ({ page }) => {
  await page.goto('./takvim/');
  await expect(page.getByRole('heading', { level: 2, name: 'Ekim 2026' })).toBeVisible();
  const slots = page.locator('.slot:visible');
  await expect(slots).toHaveCount(13);
  await page.getByText('Günübirlik', { exact: true }).first().click();
  await expect(slots).toHaveCount(3);
  for (const slot of await slots.all()) await expect(slot).toContainText('Beypazarı');
  // A month without a day trip leaves the list.
  await expect(page.getByRole('heading', { level: 2, name: 'Aralık 2026' })).toBeHidden();
});

test('a question opens to its answer', async ({ page }) => {
  await page.goto('./sss/');
  const question = page.locator('details', { hasText: 'Koltuğum Ne Zaman Kesinleşir?' });
  await expect(question.getByText(/ön ödemenin alınmasıyla/)).toBeHidden();
  await question.locator('summary').click();
  await expect(question.getByText(/ön ödemenin alınmasıyla/)).toBeVisible();
});

test('settings made in the panel show on the site of the same device', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('[data-announcement]')).toBeHidden();
  await page.evaluate(() => {
    localStorage.setItem(
      'tur-demo:v1:site-settings',
      JSON.stringify({
        brandName: 'Yol Turizm',
        tursabNumber: '12345',
        heroTitle: 'Ankara Çıkışlı Turlar',
        heroLead: 'Kısa açıklama.',
        announcementOn: true,
        announcementText: 'Kasım turlarında son koltuklar.',
        phone: '0312 000 00 00',
        whatsapp: '0532 000 00 00',
        email: 'ofis@ornek.com',
        address: 'Kızılay, Ankara',
        hours: 'Hafta içi 09.00-18.00',
        instagram: '@yolturizm',
        hiddenTourIds: [],
        hiddenJourneyIds: [],
      }),
    );
  });
  await page.reload();
  await expect(page.locator('[data-announcement]')).toHaveText('Kasım turlarında son koltuklar.');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ankara Çıkışlı Turlar');
  await expect(page.locator('.site-header__inner .brand__name')).toHaveText('Yol Turizm');
  await expect(page.locator('.site-footer__license')).toHaveText('TÜRSAB Belge No: 12345');

  await page.goto('./turlar/kapadokya/');
  const whatsapp = page.locator('.reserve').getByRole('link', { name: "WhatsApp'tan Yazın" });
  await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/905320000000\?text=Merhaba/);
  await expect(
    page.locator('.reserve').getByRole('link', { name: 'Telefonla Arayın' }),
  ).toHaveAttribute('href', 'tel:03120000000');

  await page.goto('./iletisim/');
  await expect(page.locator('.channel', { hasText: 'E-posta' })).toContainText('ofis@ornek.com');
  await expect(page.getByRole('link', { name: '@yolturizm' })).toHaveAttribute(
    'href',
    'https://www.instagram.com/yolturizm/',
  );
});

test('a question changed in the panel reads as changed on the site of the same device', async ({
  page,
}) => {
  await openPanel(page, '/site/sorular');
  await page.getByRole('button', { name: /^Koltuğum Ne Zaman Kesinleşir\?/ }).click();
  await page.getByLabel('Soru', { exact: true }).fill('Ön Ödeme Ne Zaman Yapılır?');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.locator('.toast')).toContainText('Soru kaydedildi.');

  await page.getByRole('button', { name: 'Soru Ekle' }).click();
  await page.getByLabel('Soru', { exact: true }).fill('Bagaj Sınırı Var mı?');
  await page.getByLabel('Yanıt').fill('Her misafir bir valiz ve bir el çantası getirebilir.');
  await page.getByLabel('Konu').selectOption({ label: 'Yolculuk' });
  await page.getByRole('switch', { name: /Öne Çıkar/ }).check();
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.locator('.toast')).toContainText('Soru eklendi.');

  await page.goto('./sss/');
  await expect(page.locator('#soru-on-odeme summary')).toHaveText('Ön Ödeme Ne Zaman Yapılır?');
  const added = page.locator('#soru-bagaj-siniri-var-mi');
  await expect(added).toBeVisible();
  await added.locator('summary').click();
  await expect(added).toContainText('bir valiz');

  // Marked to stand out, it also joins the questions on the home page.
  await page.goto('./');
  await expect(page.locator('#soru-bagaj-siniri-var-mi')).toBeVisible();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('no page is wider than the screen, so the phone never zooms out', async ({ page }) => {
    for (const path of [
      './',
      './takvim/',
      './gecmis-turlar/',
      './gecmis-turlar/2026-09-18-kapadokya/',
      './sss/',
      './iletisim/',
      './turlar/kapadokya/',
    ]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
  });

  test('the price and a way to book follow the reader down a tour page', async ({ page }) => {
    await page.goto('./turlar/kapadokya/');
    const bar = page.locator('[data-booking-bar]');
    await expect(bar).toBeHidden();
    await page.locator('#gunluk-program').scrollIntoViewIfNeeded();
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('₺9.850');
    await bar.getByRole('link', { name: 'Yer Ayırt' }).click();
    await expect(page.locator('#rezervasyon')).toBeInViewport();
    await expect(bar).toBeHidden();
  });
});
