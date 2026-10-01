import { expect, type Page } from '@playwright/test';
import { TEST_PANEL_CODE } from '../panelCode';

/**
 * Chromium reports a cross-document view transition it could not start in
 * time, as happens while many tests run at once, as a console error. The
 * navigation goes ahead unchanged, so it is not a fault of the page.
 */
const SKIPPED_TRANSITION =
  /^Transition was aborted because of invalid state\. ViewTransition opt-in disabled$/;

/**
 * Collects console errors and uncaught exceptions. A Content Security Policy
 * violation is reported as a console error, so this also guards the CSP.
 */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !SKIPPED_TRANSITION.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (!SKIPPED_TRANSITION.test(error.message)) errors.push(error.message);
  });
  return errors;
}

export function expectNoErrors(errors: string[]): void {
  expect(errors, `Unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
}

/**
 * Opens a page of the operations panel with the access code of test builds.
 * The site under test is built by `npm run build:e2e`, whose lock accepts it.
 */
export async function openPanelPage(page: Page, path: string): Promise<void> {
  await page.goto(path);
  const panel = page.locator('[data-admin]');
  await expect(panel).toHaveAttribute('data-access', 'locked');
  await page.getByLabel('Erişim Kodu').fill(TEST_PANEL_CODE);
  await page.getByRole('button', { name: 'Paneli Aç' }).click();
  await expect(panel).toHaveAttribute('data-access', 'open');
}

/**
 * Waits until nothing on the page is fading or moving over time. Loops that
 * never end, motion tied to scrolling and animations still waiting out their
 * delay do not count. Axe judges contrast on what is painted at that instant,
 * so a label caught halfway through fading in would fail it.
 */
export async function waitForStillness(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getAnimations().filter((animation) => {
            const timing = animation.effect?.getComputedTiming();
            return (
              animation.playState === 'running' &&
              animation.timeline === document.timeline &&
              timing?.iterations !== Infinity &&
              timing?.progress !== null
            );
          }).length,
      ),
    )
    .toBe(0);
}

/**
 * Opens a screen of the panel by its address, the way the panel's own links
 * do, and waits until the new screen has replaced the old one.
 */
export async function goToScreen(page: Page, path: string): Promise<void> {
  await page.evaluate((hash) => {
    document.querySelector('[data-screen]')?.setAttribute('data-leaving', '');
    location.hash = hash;
  }, path);
  await expect(page.locator('[data-screen]:not([data-leaving]) h1')).toBeVisible();
}
