import { defineConfig } from 'astro/config';

// GitHub Pages serves this project under /Tur. A custom domain (Cloudflare) only
// needs SITE_URL and BASE_PATH to change; no source file depends on the literal path.
const site = process.env.SITE_URL ?? 'https://dgdfurkan.github.io';
const base = process.env.BASE_PATH ?? '/Tur';

export default defineConfig({
  site,
  base,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  // Shiki emits inline styles, which the CSP below forbids. The site renders no code blocks.
  markdown: { syntaxHighlight: false },
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
