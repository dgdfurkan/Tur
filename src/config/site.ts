/**
 * Single source of truth for brand and contact details. The agency name is a
 * placeholder until the company is registered; `null` fields render as
 * "to be announced" instead of inventing data.
 */
export interface SiteConfig {
  readonly brand: {
    readonly name: string;
    readonly city: string;
    readonly description: string;
  };
  /** The home page's headline and the paragraph under it. */
  readonly home: {
    readonly title: string;
    readonly lead: string;
  };
  readonly contact: {
    readonly phone: string | null;
    readonly whatsapp: string | null;
    readonly email: string | null;
    readonly address: string | null;
    readonly hours: string | null;
    readonly instagram: string | null;
  };
  readonly license: {
    readonly tursabNumber: string | null;
  };
  /** A notice shown above the header on every page; null shows none. */
  readonly announcement: string | null;
  readonly isPrototype: boolean;
}

export const siteConfig: SiteConfig = {
  brand: {
    name: 'Ajans Adı',
    city: 'Ankara',
    description:
      'Ankara çıkışlı kültür turları: günlük program, konaklama, doluluk durumu ve üç boyutlu rota ön izlemesi.',
  },
  home: {
    title: 'Ankara Çıkışlı Kültür Turları',
    lead: "Kapadokya'dan Karadeniz yaylalarına uzanan programlarda ulaşım, konaklama ve rehberlik tek elden planlanır. Her turun rotası, yola çıkmadan önce harita üzerinde izlenebilir.",
  },
  contact: {
    phone: null,
    whatsapp: null,
    email: null,
    address: null,
    hours: null,
    instagram: null,
  },
  license: {
    tursabNumber: null,
  },
  announcement: null,
  isPrototype: true,
};
