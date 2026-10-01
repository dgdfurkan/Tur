import { InvalidFaqError } from '@/application/FaqEditor';
import { InvalidJourneyError } from '@/application/JourneyArchiveEditor';
import { InvalidTourError } from '@/application/TourCatalogEditor';
import { SCENE_KEYS, type SceneKey } from '@/domain/tour/Tour';
import { tr } from '@/i18n/tr';
import { formatLira, formatNumber } from '@/shared/format';
import type { AppContext } from '../context';
import { el } from '../ui/dom';
import { button, scene } from '../ui/kit';
import { tap } from '../ui/motion';
import { parseLira } from './passengerForm';

/**
 * Sheets that change one value. Each runs `save`, which either succeeds or
 * throws; a refused change keeps the sheet open with the reason under the field.
 */

type Save<T> = (value: T) => void;

/** Runs a change made in a sheet; a refused change keeps the sheet open with the reason. */
export function attempt(
  context: AppContext,
  error: HTMLElement,
  run: () => void,
  done: string,
): void {
  try {
    run();
  } catch (problem) {
    if (!(
      problem instanceof InvalidTourError ||
      problem instanceof InvalidJourneyError ||
      problem instanceof InvalidFaqError ||
      problem instanceof RangeError
    )) {
      throw problem;
    }
    error.textContent = tr.admin.ui.invalid;
    return;
  }
  tap();
  void context.sheet.close();
  context.refresh();
  context.toast.show(done);
}

function saveButton(label = tr.admin.ui.save): HTMLButtonElement {
  return el('button', {
    class: 'btn btn--primary btn--block btn--lg',
    text: label,
    attrs: { type: 'submit' },
  });
}

/** A sheet with one text field, for a name or a paragraph. */
export function editText(
  context: AppContext,
  options: {
    readonly title: string;
    readonly label: string;
    readonly value: string;
    readonly multiline?: boolean;
    readonly maxLength?: number;
    readonly required?: boolean;
    readonly hint?: string;
    readonly inputMode?: 'text' | 'tel' | 'email';
    readonly done?: string;
    readonly save: Save<string>;
  },
): void {
  const control = options.multiline
    ? el('textarea', {
        attrs: { rows: '5', maxlength: String(options.maxLength ?? 2000), autofocus: '' },
      })
    : el('input', {
        attrs: {
          type:
            options.inputMode === 'email' ? 'email' : options.inputMode === 'tel' ? 'tel' : 'text',
          maxlength: String(options.maxLength ?? 200),
          autocomplete: 'off',
          autofocus: '',
          enterkeyhint: 'done',
        },
      });
  control.value = options.value;
  const error = el('p', { class: 'field__error', attrs: { id: 'sheet-error', role: 'alert' } });
  control.setAttribute('aria-describedby', 'sheet-error');
  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '' } }, [
    el('div', { class: 'field' }, [
      el('label', { text: options.label, attrs: { for: 'sheet-field' } }),
      control,
      options.hint ? el('p', { class: 'field__hint', text: options.hint }) : null,
      error,
    ]),
  ]);
  control.id = 'sheet-field';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = control.value.trim();
    if (options.required !== false && value === '') {
      error.textContent = tr.admin.ui.required;
      control.focus();
      return;
    }
    attempt(context, error, () => options.save(value), options.done ?? tr.admin.ui.saved);
  });
  context.sheet.open({
    title: options.title,
    body: [form],
    footer: [saveButton()],
  });
  // The footer sits outside the form in the sheet; its button still submits it.
  context.sheet.footerButton()?.setAttribute('form', setFormId(form));
}

let formCount = 0;
function setFormId(form: HTMLFormElement): string {
  formCount += 1;
  form.id = `sheet-form-${formCount}`;
  return form.id;
}

/** A sheet for an amount in lira, with steps for the usual adjustments. */
export function editAmount(
  context: AppContext,
  options: {
    readonly title: string;
    readonly label: string;
    readonly value: number | null;
    /** When set, the amount may be removed altogether with this label. */
    readonly clearLabel?: string;
    readonly done?: string;
    readonly save: Save<number | null>;
  },
): void {
  const input = el('input', {
    class: 'amount__input tabular',
    attrs: {
      type: 'text',
      inputmode: 'numeric',
      autocomplete: 'off',
      autofocus: '',
      id: 'sheet-field',
    },
  });
  input.value = options.value === null ? '' : formatNumber(options.value);
  const change = el('p', { class: 'amount__change', attrs: { 'aria-live': 'polite' } });
  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  const read = (): number | null => parseLira(input.value);
  const describe = (): void => {
    const next = read();
    change.textContent =
      options.value !== null && next !== null && Number.isFinite(next) && next !== options.value
        ? `${formatLira(options.value)} → ${formatLira(next)}`
        : '';
  };
  input.addEventListener('input', describe);
  const step = (delta: number): HTMLButtonElement =>
    el('button', {
      class: 'quick__chip tabular',
      text: `${delta > 0 ? '+' : '−'}${formatNumber(Math.abs(delta))}`,
      attrs: {
        type: 'button',
        'aria-label':
          delta > 0
            ? tr.admin.ui.raiseBy(formatLira(delta))
            : tr.admin.ui.lowerBy(formatLira(-delta)),
      },
      on: {
        click: () => {
          const current = read();
          const base =
            current !== null && Number.isFinite(current) ? current : (options.value ?? 0);
          input.value = formatNumber(Math.max(0, base + delta));
          describe();
          tap();
        },
      },
    });

  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '' } }, [
    el('label', { class: 'amount', attrs: { for: 'sheet-field' } }, [
      el('span', { class: 'amount__label', text: options.label }),
      el('span', { class: 'amount__row' }, [
        el('span', { class: 'amount__currency', text: '₺' }),
        input,
      ]),
    ]),
    change,
    el('div', { class: 'quick quick--center' }, [step(-500), step(-100), step(100), step(500)]),
    error,
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = read();
    if (value === null || !Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
      error.textContent = tr.admin.ui.wholeAmount;
      input.focus();
      return;
    }
    attempt(context, error, () => options.save(value), options.done ?? tr.admin.ui.saved);
  });
  context.sheet.open({
    title: options.title,
    body: [form],
    footer: [
      saveButton(),
      options.clearLabel
        ? button({
            label: options.clearLabel,
            variant: 'quiet',
            block: true,
            onClick: () =>
              attempt(context, error, () => options.save(null), options.done ?? tr.admin.ui.saved),
          })
        : null,
    ],
  });
  context.sheet.footerButton()?.setAttribute('form', setFormId(form));
}

/** A sheet for a whole number with its unit, such as a distance. */
export function editNumber(
  context: AppContext,
  options: {
    readonly title: string;
    readonly label: string;
    readonly value: number | null;
    readonly min: number;
    readonly max: number;
    readonly optional?: boolean;
    readonly hint?: string;
    readonly save: Save<number | null>;
  },
): void {
  const input = el('input', {
    attrs: {
      type: 'number',
      inputmode: 'numeric',
      min: String(options.min),
      max: String(options.max),
      step: '1',
      autofocus: '',
      id: 'sheet-field',
    },
  });
  input.value = options.value === null ? '' : String(options.value);
  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  const form = el('form', { class: 'sheet__form', attrs: { novalidate: '' } }, [
    el('div', { class: 'field' }, [
      el('label', { text: options.label, attrs: { for: 'sheet-field' } }),
      input,
      options.hint ? el('p', { class: 'field__hint', text: options.hint }) : null,
      error,
    ]),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (input.value.trim() === '' && options.optional) {
      attempt(context, error, () => options.save(null), tr.admin.ui.saved);
      return;
    }
    const value = Number(input.value);
    if (!Number.isInteger(value) || value < options.min || value > options.max) {
      error.textContent = tr.admin.ui.between(formatNumber(options.min), formatNumber(options.max));
      input.focus();
      return;
    }
    attempt(context, error, () => options.save(value), tr.admin.ui.saved);
  });
  context.sheet.open({ title: options.title, body: [form], footer: [saveButton()] });
  context.sheet.footerButton()?.setAttribute('form', setFormId(form));
}

/** A sheet with a short list of choices; picking one saves it. */
export function editChoice<T extends string>(
  context: AppContext,
  options: {
    readonly title: string;
    readonly value: T;
    readonly choices: readonly {
      readonly value: T;
      readonly label: string;
      readonly hint?: string;
    }[];
    readonly save: Save<T>;
  },
): void {
  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  context.sheet.open({
    title: options.title,
    body: [
      el(
        'div',
        { class: 'choice-list', attrs: { role: 'radiogroup', 'aria-label': options.title } },
        options.choices.map((choice) =>
          el(
            'button',
            {
              class: 'choice-item',
              attrs: {
                type: 'button',
                role: 'radio',
                'aria-checked': String(choice.value === options.value),
              },
              on: {
                click: () =>
                  attempt(context, error, () => options.save(choice.value), tr.admin.ui.saved),
              },
            },
            [
              el('span', { class: 'choice-item__text' }, [
                el('span', { class: 'choice-item__label', text: choice.label }),
                choice.hint ? el('span', { class: 'choice-item__hint', text: choice.hint }) : null,
              ]),
              el('span', { class: 'choice-item__mark', attrs: { 'aria-hidden': 'true' } }),
            ],
          ),
        ),
      ),
      error,
    ],
  });
}

/** A sheet with every place illustration; pressing one saves it. */
export function pickScene(
  context: AppContext,
  options: { readonly title: string; readonly value: SceneKey; readonly save: Save<SceneKey> },
): void {
  const error = el('p', { class: 'field__error', attrs: { role: 'alert' } });
  context.sheet.open({
    title: options.title,
    body: [
      el(
        'div',
        { class: 'scene-grid', attrs: { role: 'radiogroup', 'aria-label': options.title } },
        SCENE_KEYS.map((key) =>
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
                click: () => attempt(context, error, () => options.save(key), tr.admin.ui.saved),
              },
            },
            [scene(key)],
          ),
        ),
      ),
      error,
    ],
  });
}
