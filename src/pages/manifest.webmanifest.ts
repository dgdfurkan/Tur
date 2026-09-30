import type { APIRoute } from 'astro';
import { siteConfig } from '@/config/site';
import { tr } from '@/i18n/tr';

/** Lets staff add the operations panel to a phone's home screen. */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify({
      name: `${siteConfig.brand.name} ${tr.admin.title}`,
      short_name: tr.admin.title,
      lang: 'tr',
      // Relative to this file, so the panel works under any deploy path.
      start_url: './yonetim/',
      scope: './',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#0b5a8f',
      icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }),
    { headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' } },
  );
