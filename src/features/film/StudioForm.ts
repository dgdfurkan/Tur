import type { Tour } from '@/domain/tour/Tour';
import type { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import {
  FILM_FORMATS,
  FILM_QUALITIES,
  FRAME_RATES,
  type FilmFormat,
  type FilmQuality,
  type FrameRate,
} from './formats';
import type { FilmTemplate } from './Storyboard';

const TEMPLATES: readonly FilmTemplate[] = ['journey', 'day', 'highlights', 'outline'];
const PREFS_KEY = 'studio';
/** The choices worth remembering between visits; the tour and the logo are chosen afresh. */
const REMEMBERED = [
  'template',
  'format',
  'quality',
  'frameRate',
  'sound',
  'brandName',
  'contactLine',
  'showDate',
  'showPrice',
] as const;

export interface StudioChoice {
  readonly tour: Tour;
  readonly template: FilmTemplate;
  /** Only meaningful for a film of a single day. */
  readonly day: number;
  readonly format: FilmFormat;
  readonly quality: FilmQuality;
  readonly frameRate: FrameRate;
  readonly sound: boolean;
  readonly brandName: string;
  readonly contactLine: string;
  readonly showDate: boolean;
  readonly showPrice: boolean;
}

function byId<T extends { id: string }>(items: readonly T[], id: FormDataEntryValue | null): T {
  const found = items.find((item) => item.id === id) ?? items[0];
  if (!found) throw new Error('A list of choices is empty');
  return found;
}

/**
 * The studio's settings form. It turns what is ticked and typed into a typed
 * choice, keeps the day picker in step with the tour, and remembers the
 * settings that stay the same from one film to the next.
 */
export class StudioForm {
  private readonly daySelect: HTMLSelectElement;
  private readonly dayField: HTMLElement;

  constructor(
    private readonly form: HTMLFormElement,
    private readonly tours: readonly Tour[],
    private readonly storage: SafeStorage,
  ) {
    const daySelect = form.querySelector<HTMLSelectElement>('select[name="day"]');
    const dayField = form.querySelector<HTMLElement>('[data-day-field]');
    if (!daySelect || !dayField) throw new Error('The studio form is missing its day picker');
    this.daySelect = daySelect;
    this.dayField = dayField;
    this.restore();
    this.syncDays();
  }

  /** Calls back whenever a setting changes; typing is reported once it pauses. */
  onChange(callback: () => void): void {
    let typing = 0;
    this.form.addEventListener('change', () => {
      clearTimeout(typing);
      this.syncDays();
      this.remember();
      callback();
    });
    this.form.addEventListener('input', (event) => {
      if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'text') return;
      clearTimeout(typing);
      typing = window.setTimeout(callback, 350);
    });
    this.form.addEventListener('submit', (event) => event.preventDefault());
  }

  read(): StudioChoice {
    const data = new FormData(this.form);
    const tour = this.tours.find((item) => item.id === data.get('tour')) ?? this.tours[0];
    if (!tour) throw new Error('There are no tours to film');
    const template = TEMPLATES.find((item) => item === data.get('template')) ?? 'journey';
    const day = Math.min(tour.dayCount, Math.max(1, Number(data.get('day')) || 1));
    const frameRate = FRAME_RATES.find((rate) => String(rate) === data.get('frameRate')) ?? 30;
    return {
      tour,
      template,
      day,
      format: byId(FILM_FORMATS, data.get('format')),
      quality: byId(FILM_QUALITIES, data.get('quality')),
      frameRate,
      sound: data.get('sound') !== null,
      brandName: String(data.get('brandName') ?? ''),
      contactLine: String(data.get('contactLine') ?? ''),
      showDate: data.get('showDate') !== null,
      showPrice: data.get('showPrice') !== null,
    };
  }

  /** Locks or unlocks every control, while a film is being written. */
  setDisabled(disabled: boolean): void {
    for (const control of this.form.elements) {
      if ('disabled' in control) (control as HTMLInputElement).disabled = disabled;
    }
  }

  /** Offers the days of the chosen tour, and shows the picker only for a film of one day. */
  private syncDays(): void {
    const { tour, template, day } = this.read();
    this.dayField.hidden = template !== 'day';
    if (this.daySelect.dataset['tour'] === tour.id) return;
    this.daySelect.dataset['tour'] = tour.id;
    this.daySelect.replaceChildren(
      ...tour.days.map((item) => {
        const option = document.createElement('option');
        option.value = String(item.number);
        option.textContent = `${item.number}. Gün: ${item.title}`;
        return option;
      }),
    );
    this.daySelect.value = String(day);
  }

  private remember(): void {
    const data = new FormData(this.form);
    const kept: Record<string, string | boolean> = {};
    for (const name of REMEMBERED) {
      const control = this.form.elements.namedItem(name);
      const isCheckbox = control instanceof HTMLInputElement && control.type === 'checkbox';
      kept[name] = isCheckbox ? data.get(name) !== null : String(data.get(name) ?? '');
    }
    this.storage.write(PREFS_KEY, JSON.stringify(kept));
  }

  /** Puts remembered settings back. Anything unexpected in storage is ignored. */
  private restore(): void {
    let kept: unknown;
    try {
      kept = JSON.parse(this.storage.read(PREFS_KEY) ?? 'null');
    } catch {
      return;
    }
    if (typeof kept !== 'object' || kept === null) return;
    for (const name of REMEMBERED) {
      const value = (kept as Record<string, unknown>)[name];
      const control = this.form.elements.namedItem(name);
      if (control instanceof HTMLInputElement && control.type === 'checkbox') {
        if (typeof value === 'boolean') control.checked = value;
      } else if (control instanceof HTMLInputElement && control.type === 'text') {
        if (typeof value === 'string') control.value = value.slice(0, control.maxLength);
      } else if (control instanceof RadioNodeList && typeof value === 'string') {
        // Only a value the form actually offers is taken.
        const offered = [...control].some(
          (item) => item instanceof HTMLInputElement && item.value === value,
        );
        if (offered) control.value = value;
      }
    }
  }
}
