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
  readonly contact: {
    readonly phone: string | null;
    readonly whatsapp: string | null;
    readonly email: string | null;
    readonly address: string | null;
    readonly hours: string | null;
  };
  readonly license: {
    readonly tursabNumber: string | null;
  };
  readonly isPrototype: boolean;
}

export const siteConfig: SiteConfig = {
  brand: {
    name: 'Ajans Adı',
    city: 'Ankara',
    description:
      'Ankara çıkışlı kültür turları: günlük program, konaklama, doluluk durumu ve 3D rota ön izlemesi.',
  },
  contact: {
    phone: null,
    whatsapp: null,
    email: null,
    address: null,
    hours: null,
  },
  license: {
    tursabNumber: null,
  },
  isPrototype: true,
};
