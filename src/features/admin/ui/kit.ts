import { SCENE_KEYS, type SceneKey } from '@/domain/tour/Tour';
import type { Occupancy } from '@/domain/tour/Occupancy';
import { tr } from '@/i18n/tr';
import { ICON_PATHS, type IconName } from '@/shared/icons';
import { formatNumber } from '@/shared/format';
import { el, svg, type Child } from './dom';

/*
 * The panel's building blocks. Each returns plain DOM, styled by
 * src/styles/panel.css, so every screen is assembled from the same parts and
 * looks and behaves alike.
 */

export type Tone = 'blue' | 'brown' | 'green' | 'yellow' | 'red' | 'grey';

export function icon(name: IconName, size = 20): SVGSVGElement {
  return svg(
    'svg',
    {
      class: 'icon',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.7,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [svg('path', { d: ICON_PATHS[name] })],
  );
}

/**
 * A place illustration; the page includes the drawings themselves as symbols.
 * `bottom` keeps the ground in view when a wide strip crops the picture.
 */
export function scene(
  key: SceneKey,
  className = 'scene',
  anchor: 'middle' | 'bottom' = 'middle',
): SVGSVGElement {
  return svg(
    'svg',
    {
      class: className,
      viewBox: '0 0 320 200',
      preserveAspectRatio: anchor === 'bottom' ? 'xMidYMax slice' : 'xMidYMid slice',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [svg('use', { href: `#scene-${key}` })],
  );
}

/**
 * Every place illustration in a row that scrolls sideways, for choosing one
 * inside a form. `select` moves the choice from outside, as when a stop of
 * the programme is picked.
 */
export function sceneStrip(options: {
  readonly label: string;
  readonly value: SceneKey;
  readonly onChange: (key: SceneKey) => void;
}): { readonly element: HTMLElement; select(key: SceneKey): void } {
  const items = SCENE_KEYS.map((key) =>
    el(
      'button',
      {
        class: 'scene-grid__item',
        attrs: {
          type: 'button',
          role: 'radio',
          'aria-checked': String(key === options.value),
          'aria-label': tr.admin.scenes[key],
        },
        on: {
          click: () => {
            select(key);
            options.onChange(key);
          },
        },
      },
      [scene(key)],
    ),
  );
  const element = el(
    'div',
    { class: 'scene-strip', attrs: { role: 'radiogroup', 'aria-label': options.label } },
    items,
  );
  // Only the strip scrolls sideways; the sheet around it stays where it is.
  const reveal = (key: SceneKey, behavior: ScrollBehavior): void => {
    const item = items[SCENE_KEYS.indexOf(key)];
    if (!item) return;
    const strip = element.getBoundingClientRect();
    const box = item.getBoundingClientRect();
    element.scrollTo({
      left: element.scrollLeft + box.left - strip.left - (strip.width - box.width) / 2,
      behavior,
    });
  };
  const select = (key: SceneKey): void => {
    items.forEach((item, index) => {
      item.setAttribute('aria-checked', String(SCENE_KEYS[index] === key));
    });
    reveal(key, 'smooth');
  };
  requestAnimationFrame(() => reveal(options.value, 'instant'));
  return { element, select };
}

interface ButtonOptions {
  readonly label: string;
  readonly icon?: IconName;
  readonly variant?: 'primary' | 'secondary' | 'tonal' | 'quiet' | 'danger';
  readonly size?: 'md' | 'lg';
  readonly block?: boolean;
  readonly href?: string;
  readonly type?: 'button' | 'submit';
  readonly onClick?: (event: MouseEvent) => void;
  readonly attrs?: Readonly<Record<string, string | undefined>>;
}

/** A button, or a link that looks like one when it leads somewhere. */
export function button(options: ButtonOptions): HTMLElement {
  const className = [
    'btn',
    `btn--${options.variant ?? 'primary'}`,
    options.size === 'lg' && 'btn--lg',
    options.block && 'btn--block',
  ]
    .filter(Boolean)
    .join(' ');
  const content: Child[] = [
    options.icon && icon(options.icon),
    el('span', { text: options.label }),
  ];
  const on = options.onClick ? { click: options.onClick } : {};
  if (options.href) {
    return el(
      'a',
      { class: className, attrs: { href: options.href, ...options.attrs }, on },
      content,
    );
  }
  return el(
    'button',
    { class: className, attrs: { type: options.type ?? 'button', ...options.attrs }, on },
    content,
  );
}

/** A round button with only an icon; the label is read out instead of shown. */
export function iconButton(options: {
  readonly icon: IconName;
  readonly label: string;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly tone?: 'plain' | 'filled';
}): HTMLElement {
  const className = `icon-btn icon-btn--${options.tone ?? 'plain'}`;
  if (options.href) {
    return el(
      'a',
      { class: className, attrs: { href: options.href, 'aria-label': options.label } },
      [icon(options.icon, 22)],
    );
  }
  return el(
    'button',
    {
      class: className,
      attrs: { type: 'button', 'aria-label': options.label },
      on: { click: () => options.onClick?.() },
    },
    [icon(options.icon, 22)],
  );
}

export interface ScreenOptions {
  readonly title: string;
  readonly subtitle?: string | undefined;
  /** Where the back arrow leads; top-level screens have none. */
  readonly back?: { readonly href: string; readonly label: string } | undefined;
  readonly actions?: readonly Child[];
  /** Drawn behind the title, for screens about one tour. */
  readonly art?: SceneKey | undefined;
}

/**
 * A whole screen: a slim bar that shows the title once the large one has
 * scrolled away, the large title itself, and the content.
 */
export function screen(options: ScreenOptions, body: readonly Child[]): HTMLElement {
  const bar = el('header', { class: 'topbar' }, [
    options.back
      ? el('a', { class: 'topbar__back', attrs: { href: options.back.href } }, [
          icon('back', 22),
          el('span', { text: options.back.label }),
        ])
      : null,
    el('span', { class: 'topbar__title', text: options.title, attrs: { 'aria-hidden': 'true' } }),
    el('div', { class: 'topbar__actions' }, options.actions ?? []),
  ]);
  const head = el(
    'div',
    { class: options.art ? 'screen__head screen__head--art' : 'screen__head' },
    [
      options.art ? el('div', { class: 'screen__art' }, [scene(options.art)]) : null,
      el('h1', { text: options.title, attrs: { tabindex: '-1' } }),
      options.subtitle ? el('p', { class: 'screen__subtitle', text: options.subtitle }) : null,
    ],
  );
  return el('section', { class: 'screen', attrs: { 'data-screen': '' } }, [
    bar,
    head,
    el('div', { class: 'screen__body' }, body),
  ]);
}

/** A titled part of a screen. */
export function block(
  title: string | null,
  children: readonly Child[],
  options: { readonly action?: Child; readonly footnote?: string } = {},
): HTMLElement {
  return el('section', { class: 'block' }, [
    title !== null || options.action
      ? el('header', { class: 'block__head' }, [
          title !== null ? el('h2', { text: title }) : el('span'),
          options.action ?? null,
        ])
      : null,
    ...children,
    options.footnote ? el('p', { class: 'block__foot', text: options.footnote }) : null,
  ]);
}

/** Rows on one white card, separated by hairlines. */
export function group(rows: readonly Child[], className = ''): HTMLElement {
  return el('div', { class: `group ${className}`.trim() }, rows);
}

export interface RowOptions {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly value?: Child;
  readonly icon?: { readonly name: IconName; readonly tone: Tone } | undefined;
  readonly lead?: Child;
  readonly href?: string | undefined;
  readonly onClick?: (() => void) | undefined;
  /** What sits at the right edge; a chevron by default for rows that lead somewhere. */
  readonly accessory?: Child;
  readonly danger?: boolean;
  readonly attrs?: Readonly<Record<string, string | undefined>>;
}

/** One line of a group: what it is on the left, its value and where it leads on the right. */
export function row(options: RowOptions): HTMLElement {
  const leads = options.href !== undefined || options.onClick !== undefined;
  const content: Child[] = [
    options.lead ??
      (options.icon
        ? el('span', { class: `tile tile--${options.icon.tone}` }, [icon(options.icon.name, 18)])
        : null),
    el('span', { class: 'row__text' }, [
      el('span', { class: 'row__title', text: options.title }),
      options.subtitle ? el('span', { class: 'row__subtitle', text: options.subtitle }) : null,
    ]),
    options.value !== undefined && options.value !== null
      ? el('span', { class: 'row__value' }, [options.value])
      : null,
    options.accessory ??
      (leads ? el('span', { class: 'row__chevron' }, [icon('chevron', 18)]) : null),
  ];
  const className = `row${options.danger ? ' row--danger' : ''}`;
  if (options.href !== undefined) {
    return el('a', { class: className, attrs: { href: options.href, ...options.attrs } }, content);
  }
  if (options.onClick) {
    const handler = options.onClick;
    return el(
      'button',
      {
        class: className,
        attrs: { type: 'button', ...options.attrs },
        on: { click: () => handler() },
      },
      content,
    );
  }
  return el('div', { class: className, attrs: options.attrs }, content);
}

/** A row with a switch; the change is reported at once. */
export function toggleRow(options: {
  readonly title: string;
  readonly subtitle?: string;
  readonly checked: boolean;
  readonly icon?: { readonly name: IconName; readonly tone: Tone };
  readonly onChange: (checked: boolean) => void;
}): HTMLElement {
  const input = el('input', {
    class: 'switch__input',
    attrs: { type: 'checkbox', role: 'switch' },
    on: { change: () => options.onChange(input.checked) },
  });
  input.checked = options.checked;
  return el('label', { class: 'row row--toggle' }, [
    options.icon
      ? el('span', { class: `tile tile--${options.icon.tone}` }, [icon(options.icon.name, 18)])
      : null,
    el('span', { class: 'row__text' }, [
      el('span', { class: 'row__title', text: options.title }),
      options.subtitle ? el('span', { class: 'row__subtitle', text: options.subtitle }) : null,
    ]),
    el('span', { class: 'switch' }, [
      input,
      el('span', { class: 'switch__track', attrs: { 'aria-hidden': 'true' } }),
    ]),
  ]);
}

export function chip(text: string, tone: Tone = 'grey'): HTMLElement {
  return el('span', { class: `chip chip--${tone}`, text });
}

/** A figure with what it counts; the number can be animated in by the caller. */
export function stat(
  label: string,
  value: string,
  options: { readonly tone?: Tone } = {},
): HTMLElement {
  return el('div', { class: `stat${options.tone ? ` stat--${options.tone}` : ''}` }, [
    el('span', { class: 'stat__value tabular', text: value }),
    el('span', { class: 'stat__label', text: label }),
  ]);
}

/** A thin bar in the colour of how full the departure is. */
export function occupancyBar(occupancy: Occupancy): HTMLElement {
  const fill = el('span', { class: 'meter__fill' });
  fill.style.setProperty('--fill', occupancy.ratio.toFixed(4));
  return el(
    'span',
    { class: 'meter', attrs: { 'data-level': occupancy.level, 'aria-hidden': 'true' } },
    [fill],
  );
}

/** A ring that closes as seats are sold, with the seats still free in its middle. */
export function occupancyRing(occupancy: Occupancy, label: string): HTMLElement {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const arc = svg('circle', {
    class: 'ring__arc',
    cx: 50,
    cy: 50,
    r: radius,
    'stroke-dasharray': `${(circumference * occupancy.ratio).toFixed(2)} ${circumference.toFixed(2)}`,
  });
  return el('div', { class: 'ring', attrs: { 'data-level': occupancy.level } }, [
    svg('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true', focusable: 'false' }, [
      svg('circle', { class: 'ring__track', cx: 50, cy: 50, r: radius }),
      arc,
    ]),
    el('span', { class: 'ring__value' }, [
      el('strong', { class: 'tabular', text: formatNumber(occupancy.remaining) }),
      el('span', { text: label }),
    ]),
  ]);
}

const tileMonth = new Intl.DateTimeFormat('tr-TR', { month: 'short', timeZone: 'UTC' });
const tileWeekday = new Intl.DateTimeFormat('tr-TR', { weekday: 'short', timeZone: 'UTC' });

/** The day of a departure as a tear-off calendar leaf. */
export function dateTile(isoDate: string, level?: Occupancy['level']): HTMLElement {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return el('span', { class: 'date-tile', attrs: { 'data-level': level, 'aria-hidden': 'true' } }, [
    el('span', { class: 'date-tile__month', text: tileMonth.format(date) }),
    el('strong', { class: 'date-tile__day tabular', text: String(date.getUTCDate()) }),
    el('span', { class: 'date-tile__weekday', text: tileWeekday.format(date) }),
  ]);
}

export function emptyState(options: {
  readonly art: SceneKey;
  readonly title: string;
  readonly text: string;
  readonly action?: Child;
}): HTMLElement {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'empty__art' }, [scene(options.art)]),
    el('h2', { text: options.title }),
    el('p', { text: options.text }),
    options.action ?? null,
  ]);
}

let fieldCount = 0;

/** A labelled form control with an optional hint and a place for its error. */
export function field(options: {
  readonly label: string;
  readonly control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  readonly hint?: string;
  readonly name?: string;
}): HTMLElement {
  fieldCount += 1;
  const id = `f${fieldCount}`;
  const hintId = options.hint ? `${id}-hint` : undefined;
  const errorId = `${id}-error`;
  options.control.id = id;
  if (options.name) options.control.name = options.name;
  options.control.setAttribute('aria-describedby', [hintId, errorId].filter(Boolean).join(' '));
  return el('div', { class: 'field' }, [
    el('label', { text: options.label, attrs: { for: id } }),
    options.control,
    options.hint
      ? el('p', { class: 'field__hint', text: options.hint, attrs: { id: hintId } })
      : null,
    el('p', {
      class: 'field__error',
      attrs: { id: errorId, 'data-error-for': options.name ?? options.control.name },
    }),
  ]);
}

/** A row of mutually exclusive choices drawn as one control. */
export function segmented<T extends string>(options: {
  readonly name: string;
  readonly legend: string;
  readonly choices: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange?: (value: T) => void;
}): HTMLFieldSetElement {
  return el('fieldset', { class: 'seg' }, [
    el('legend', { class: 'seg__legend', text: options.legend }),
    el(
      'div',
      { class: 'seg__track' },
      options.choices.map((choice) => {
        const input = el('input', {
          class: 'visually-hidden',
          attrs: { type: 'radio', name: options.name, value: choice.value },
          on: { change: () => options.onChange?.(choice.value) },
        });
        input.checked = choice.value === options.value;
        return el('label', { class: 'seg__option' }, [input, el('span', { text: choice.label })]);
      }),
    ),
  ]);
}

/** The main action of a screen, floating above the tab bar. */
export function fab(label: string, href: string): HTMLElement {
  return el('a', { class: 'fab', attrs: { href } }, [
    icon('plus', 24),
    el('span', { text: label }),
  ]);
}

/** Lets the newest items arrive one after another when a screen first opens. */
export function stagger<T extends HTMLElement>(items: readonly T[]): T[] {
  items.forEach((item, index) => {
    item.classList.add('enter');
    item.style.setProperty('--i', String(Math.min(index, 8)));
  });
  return [...items];
}
