import { expect, type Page } from '@playwright/test';

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
