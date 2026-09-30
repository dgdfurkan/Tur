import { expect, type Page } from '@playwright/test';
import { TEST_PANEL_CODE } from '../panelCode';

/**
 * Collects console errors and uncaught exceptions. A Content Security Policy
 * violation is reported as a console error, so this also guards the CSP.
 */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
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
