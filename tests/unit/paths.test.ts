import { describe, expect, it } from 'vitest';
import { assetUrl, pageUrl } from '@/config/paths';

describe('pageUrl', () => {
  it('returns the base path for the home page', () => {
    expect(pageUrl()).toBe('/');
  });

  it('adds a trailing slash and strips redundant slashes', () => {
    expect(pageUrl('turlar')).toBe('/turlar/');
    expect(pageUrl('/turlar/kapadokya/')).toBe('/turlar/kapadokya/');
  });
});

describe('assetUrl', () => {
  it('joins the base path without a trailing slash', () => {
    expect(assetUrl('/favicon.svg')).toBe('/favicon.svg');
  });
});
