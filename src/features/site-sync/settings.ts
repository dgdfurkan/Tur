import { SITE_SETTINGS_KEY } from '@/infrastructure/storage/keys';
import type { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import {
  instagramHref,
  instagramName,
  mailHref,
  telHref,
  whatsappHref,
} from '@/shared/contactLinks';

const TEXT_FIELDS = [
  'brandName',
  'tursabNumber',
  'heroTitle',
  'heroLead',
  'announcementText',
  'phone',
  'whatsapp',
  'email',
  'address',
  'hours',
  'instagram',
] as const;
type TextField = (typeof TEXT_FIELDS)[number];

export const CONTACT_CHANNELS = [
  'phone',
  'whatsapp',
  'email',
  'address',
  'hours',
  'instagram',
] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

/** What the panel decided about the site on this device, as far as public pages show it. */
export interface LocalSettings {
  readonly text: Readonly<Partial<Record<TextField, string>>>;
  readonly announcementOn: boolean;
  readonly hiddenTourIds: ReadonlySet<string>;
  readonly hiddenJourneyIds: ReadonlySet<string>;
}

const MAX_LENGTH = 400;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const idSet = (value: unknown): Set<string> =>
  new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);

/**
 * Reads the panel's site settings on this device without the panel's checks;
 * a value of the wrong shape is ignored. Null when the panel has never saved
 * any, which is the case for every visitor but the office.
 */
export function readLocalSettings(storage: SafeStorage): LocalSettings | null {
  const raw = storage.read(SITE_SETTINGS_KEY);
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const text: Partial<Record<TextField, string>> = {};
  for (const field of TEXT_FIELDS) {
    const value = data[field];
    if (typeof value === 'string' && value.length <= MAX_LENGTH) text[field] = value.trim();
  }
  return {
    text,
    announcementOn: data['announcementOn'] === true,
    hiddenTourIds: idSet(data['hiddenTourIds']),
    hiddenJourneyIds: idSet(data['hiddenJourneyIds']),
  };
}

function linkFor(channel: ContactChannel, value: string, extra: string | undefined): string | null {
  switch (channel) {
    case 'phone':
      return telHref(value);
    case 'whatsapp':
      return whatsappHref(value, extra);
    case 'email':
      return mailHref(value, extra);
    case 'instagram':
      return instagramHref(value);
    default:
      return null;
  }
}

const each = <T extends Element>(root: ParentNode, selector: string, run: (element: T) => void) => {
  for (const element of root.querySelectorAll<T>(selector)) run(element);
};

/**
 * Shows the panel's settings on the pages of this device: the agency's name,
 * the home page text, the announcement band, the contact details and which
 * tours are listed. The pages carry the markers below; everything reaches them
 * as text or as a link built from a checked value.
 *
 * - `data-site-text="brandName|heroTitle|heroLead"`: replaced by the setting.
 * - `data-tursab` with `data-label` and `data-pending`: the licence line.
 * - `data-announcement` and `data-announcement-text`: the band above the header.
 * - `data-contact-value="<channel>"` with `data-pending`: a contact detail in words.
 * - `data-contact-link="<channel>"`, optionally with `data-message`: a link to
 *   the office. Without a usable detail it loses its address, and with
 *   `data-hide-empty` it leaves the page altogether.
 */
export function applySiteSettings(root: Document, settings: LocalSettings): void {
  const { text } = settings;
  const builtBrand = root.documentElement.dataset['brand'];

  for (const field of ['brandName', 'heroTitle', 'heroLead'] as const) {
    const value = text[field];
    if (value)
      each<HTMLElement>(root, `[data-site-text="${field}"]`, (el) => (el.textContent = value));
  }
  if (text.brandName && builtBrand && root.title.endsWith(builtBrand)) {
    root.title = `${root.title.slice(0, -builtBrand.length)}${text.brandName}`;
  }

  if (text.tursabNumber !== undefined) {
    const number = text.tursabNumber;
    each<HTMLElement>(root, '[data-tursab]', (el) => {
      el.textContent = number
        ? `${el.dataset['label'] ?? ''} ${number}`.trim()
        : (el.dataset['pending'] ?? el.textContent);
    });
  }

  const announcement = text.announcementText ?? '';
  each<HTMLElement>(root, '[data-announcement]', (band) => {
    band.hidden = !(settings.announcementOn && announcement !== '');
    const line = band.querySelector('[data-announcement-text]');
    if (line && announcement) line.textContent = announcement;
  });

  for (const channel of CONTACT_CHANNELS) {
    const value = text[channel];
    if (value === undefined) continue;
    each<HTMLElement>(root, `[data-contact-value="${channel}"]`, (el) => {
      const shown = channel === 'instagram' && value ? instagramName(value) : value;
      el.textContent = shown || (el.dataset['pending'] ?? '');
      el.toggleAttribute('data-empty', shown === '');
    });
    each<HTMLAnchorElement>(root, `[data-contact-link="${channel}"]`, (link) => {
      const href = value ? linkFor(channel, value, link.dataset['message']) : null;
      if (href) link.href = href;
      else link.removeAttribute('href');
      if (link.hasAttribute('data-hide-empty')) link.hidden = href === null;
    });
  }

  each<HTMLElement>(root, '[data-tour-card]', (card) => {
    if (settings.hiddenTourIds.has(card.dataset['tourCard'] ?? '')) card.hidden = true;
  });
}
