import { z } from 'astro/zod';

// Zod otherwise probes for code generation with Function() as soon as a schema
// is built, which the site's Trusted Types policy blocks and reports, although
// Zod copes without it. Every schema imports Zod from here, so this runs first.
z.config({ jitless: true });

export { z };
