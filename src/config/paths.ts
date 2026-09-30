const base: string = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

/** Absolute URL of an internal page, honouring the deploy base path and trailing slash. */
export function pageUrl(path = ''): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return clean === '' ? base : `${base}${clean}/`;
}

/** Absolute URL of a file in `public/`, honouring the deploy base path. */
export function assetUrl(path: string): string {
  return `${base}${path.replace(/^\/+/, '')}`;
}
