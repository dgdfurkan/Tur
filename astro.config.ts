import { defineConfig, fontProviders } from 'astro/config';

// GitHub Pages serves this project under /Tur. A custom domain (Cloudflare) only
// needs SITE_URL and BASE_PATH to change; no source file depends on the literal path.
const site = process.env.SITE_URL ?? 'https://dgdfurkan.github.io';
const base = process.env.BASE_PATH ?? '/Tur';

const FONT_FILES = '@fontsource-variable/encode-sans/files';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // Shiki emits inline styles, which the CSP below forbids. The site renders no code blocks.
  markdown: { syntaxHighlight: false },
  fonts: [
    {
      // Files come from node_modules, so builds never depend on a font CDN.
      // One variable file per subset carries both the weight and the width axis.
      provider: fontProviders.local(),
      name: 'Encode Sans',
      cssVariable: '--font-sans',
      // Astro derives fallback metrics from the file's default (condensed)
      // instance, which is far too narrow for body text. The measured fallback
      // lives in src/styles/base.css instead.
      optimizedFallbacks: false,
      fallbacks: ['Encode Sans Fallback', 'Arial', 'sans-serif'],
      options: {
        variants: [
          {
            src: [`${FONT_FILES}/encode-sans-latin-wdth-normal.woff2`],
            weight: '100 900',
            style: 'normal',
            stretch: '75% 125%',
            unicodeRange: [
              'U+0000-00FF',
              'U+0131',
              'U+0152-0153',
              'U+02BB-02BC',
              'U+02C6',
              'U+02DA',
              'U+02DC',
              'U+2000-206F',
              'U+20AC',
              'U+2122',
              'U+2191',
              'U+2193',
              'U+2212',
              'U+2215',
              'U+FEFF',
              'U+FFFD',
            ],
          },
          {
            // Carries the Turkish letters (ğ, ş, İ) and the lira sign.
            src: [`${FONT_FILES}/encode-sans-latin-ext-wdth-normal.woff2`],
            weight: '100 900',
            style: 'normal',
            stretch: '75% 125%',
            unicodeRange: [
              'U+0100-02BA',
              'U+02BD-02C5',
              'U+02C7-02CC',
              'U+02CE-02D7',
              'U+02DD-02FF',
              'U+1E00-1E9F',
              'U+20A0-20AB',
              'U+20AD-20C0',
              'U+2113',
            ],
          },
        ],
      },
    },
  ],
  vite: {
    // three.js is one large chunk by nature; it is loaded lazily on the map pages only.
    build: { chunkSizeWarningLimit: 700 },
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },
});
