import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Motion tied to scrolling is written in CSS alone, and a build step can break
 * it without reporting anything: the minifier once folded `animation-timeline`
 * into the `animation` shorthand, which browsers then discarded. These tests
 * drive the built site, so they notice.
 */

async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
}

async function left(locator: Locator): Promise<number> {
  return (await locator.boundingBox())?.x ?? Number.NaN;
}

/** Scroll positions at which the footer has wholly arrived, and has only begun to. */
async function footerStops(page: Page): Promise<{ end: number; entering: number }> {
  return page.evaluate(() => {
    const footer = document.querySelector('footer');
    const end = document.documentElement.scrollHeight - window.innerHeight;
    return { end, entering: end - (footer?.offsetHeight ?? 0) * 0.7 };
  });
}

test('the coach drives into the footer as the page reaches its end', async ({ page }) => {
  await page.goto('./');
  const coach = page.locator('footer .coach');
  const { end, entering } = await footerStops(page);

  await scrollTo(page, end);
  const parked = await left(coach);
  expect(parked).toBeGreaterThan(0);

  await scrollTo(page, entering);
  await expect.poll(() => left(coach)).toBeLessThan(parked - 40);
});

test('the far hills of the hero fall behind the near ones while scrolling', async ({ page }) => {
  await page.goto('./');
  const far = page.locator('.scene__layer--far');
  const near = page.locator('.scene__layer--near');
  const gap = async () =>
    ((await far.boundingBox())?.y ?? 0) - ((await near.boundingBox())?.y ?? 0);

  expect(Math.abs(await gap())).toBeLessThan(1);
  await scrollTo(page, 300);
  await expect.poll(gap).toBeGreaterThan(3);
});

test('what arrives on scroll is fully shown once it has been reached', async ({ page }) => {
  await page.goto('./');
  const ticket = page.locator('.ticket-list li').first();
  await ticket.scrollIntoViewIfNeeded();
  await expect(ticket).toHaveCSS('opacity', '1');
  // The occupancy bar fills once its ticket has arrived.
  await expect(ticket.locator('[data-occupancy-fill]')).toHaveCSS('transform', 'none');
});

test.describe('with reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('the coach is parked and nothing waits to be revealed', async ({ page }) => {
    await page.goto('./');
    const coach = page.locator('footer .coach');
    const { end, entering } = await footerStops(page);

    await scrollTo(page, entering);
    const entered = await left(coach);
    await scrollTo(page, end);
    expect(await left(coach)).toBeCloseTo(entered, 0);

    for (const item of await page.locator('[data-reveal]').all()) {
      await expect(item).toHaveCSS('opacity', '1');
    }
  });
});
