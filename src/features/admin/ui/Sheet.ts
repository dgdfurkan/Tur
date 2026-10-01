import { tr } from '@/i18n/tr';
import { el, type Child } from './dom';
import { icon } from './kit';

export interface SheetOptions {
  readonly title: string;
  readonly body: readonly Child[];
  /** Pinned to the bottom of the sheet, usually its main action. */
  readonly footer?: readonly Child[];
  /** Runs once the sheet has closed, however it was closed. */
  readonly onClose?: () => void;
}

/** A downward flick faster than this closes the sheet whatever the distance, in px/ms. */
const FLICK_SPEED = 0.11;
/** Dragged further than this share of its height, the sheet closes when let go. */
const CLOSE_SHARE = 0.25;
/** Dragging upwards past the top moves the sheet this much of the distance, as on iOS. */
const OVERDRAG = 0.15;
const CLOSE_TIMEOUT_MS = 450;

/**
 * A sheet that slides up from the bottom of the screen, or a dialog in the
 * middle on a wide one. It is a modal <dialog>, so focus stays inside and the
 * page behind is out of reach, and it can be pulled down to close.
 */
export class Sheet {
  private readonly dialog: HTMLDialogElement;
  private readonly panel: HTMLElement;
  private readonly title: HTMLElement;
  private readonly body: HTMLElement;
  private readonly foot: HTMLElement;
  private onClose: (() => void) | undefined;
  private closing: Promise<void> | null = null;

  constructor(host: HTMLElement) {
    this.title = el('h2', { class: 'sheet__title', attrs: { id: 'sheet-title' } });
    this.body = el('div', { class: 'sheet__body' });
    this.foot = el('footer', { class: 'sheet__foot' });
    const grab = el('div', { class: 'sheet__grab', attrs: { 'aria-hidden': 'true' } }, [
      el('span'),
    ]);
    const head = el('header', { class: 'sheet__head' }, [
      this.title,
      el(
        'button',
        {
          class: 'icon-btn icon-btn--plain sheet__close',
          attrs: { type: 'button', 'aria-label': tr.admin.ui.close },
          on: { click: () => void this.close() },
        },
        [icon('close', 22)],
      ),
    ]);
    this.panel = el('div', { class: 'sheet__panel' }, [grab, head, this.body, this.foot]);
    this.dialog = el('dialog', { class: 'sheet', attrs: { 'aria-labelledby': 'sheet-title' } }, [
      el('div', { class: 'sheet__scrim', on: { click: () => void this.close() } }),
      this.panel,
    ]);
    // Escape closes the sheet the same way as everything else does, with its motion.
    this.dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      void this.close();
    });
    this.enableDrag(grab, head);
    host.append(this.dialog);
  }

  get isOpen(): boolean {
    return this.dialog.open;
  }

  /** The submit button pinned to the footer, so a form in the body can be tied to it. */
  footerButton(): HTMLButtonElement | null {
    return this.foot.querySelector<HTMLButtonElement>('button[type="submit"]');
  }

  open(options: SheetOptions): void {
    if (this.dialog.open) {
      // Replacing what an open sheet shows needs no new entrance.
      this.onClose?.();
    }
    this.title.textContent = options.title;
    this.body.replaceChildren(...options.body.filter((child): child is Node | string => !!child));
    this.foot.replaceChildren(
      ...(options.footer ?? []).filter((child): child is Node | string => !!child),
    );
    this.foot.hidden = (options.footer ?? []).length === 0;
    this.onClose = options.onClose;
    this.closing = null;
    this.panel.style.removeProperty('transform');
    if (!this.dialog.open) {
      this.dialog.showModal();
      this.dialog.dataset['state'] = 'opening';
      // The next frame starts the slide from the closed position.
      requestAnimationFrame(() => {
        this.dialog.dataset['state'] = 'open';
      });
    }
  }

  /**
   * Closes the sheet. `instant` skips the slide, for when the screen behind is
   * changing anyway: while a modal sheet is open the page behind it is inert.
   */
  close(options: { readonly instant?: boolean } = {}): Promise<void> {
    if (!this.dialog.open) return Promise.resolve();
    if (this.closing && !options.instant) return this.closing;
    this.dialog.dataset['state'] = 'closing';
    this.panel.style.removeProperty('transform');
    this.closing = new Promise((resolve) => {
      const finish = (): void => {
        clearTimeout(timer);
        this.panel.removeEventListener('transitionend', onEnd);
        this.dialog.close();
        delete this.dialog.dataset['state'];
        const callback = this.onClose;
        this.onClose = undefined;
        this.body.replaceChildren();
        callback?.();
        resolve();
      };
      const onEnd = (event: TransitionEvent): void => {
        if (event.target === this.panel) finish();
      };
      // Without motion there is no transition to wait for.
      const quick = options.instant || matchMedia('(prefers-reduced-motion: reduce)').matches;
      const timer = setTimeout(finish, quick ? 0 : CLOSE_TIMEOUT_MS);
      this.panel.addEventListener('transitionend', onEnd);
    });
    return this.closing;
  }

  /** Follows a finger on the handle; a long or quick pull down closes the sheet. */
  private enableDrag(...handles: HTMLElement[]): void {
    let start: { y: number; time: number; pointer: number } | null = null;
    let offset = 0;

    const onDown = (event: PointerEvent): void => {
      if (start || (event.target instanceof Element && event.target.closest('button'))) return;
      start = { y: event.clientY, time: performance.now(), pointer: event.pointerId };
      offset = 0;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      this.dialog.dataset['dragging'] = 'true';
    };
    const onMove = (event: PointerEvent): void => {
      if (!start || event.pointerId !== start.pointer) return;
      const distance = event.clientY - start.y;
      offset = distance > 0 ? distance : distance * OVERDRAG;
      this.panel.style.transform = `translateY(${offset}px)`;
    };
    const onUp = (event: PointerEvent): void => {
      if (!start || event.pointerId !== start.pointer) return;
      const speed = offset / Math.max(1, performance.now() - start.time);
      start = null;
      delete this.dialog.dataset['dragging'];
      if (offset > this.panel.offsetHeight * CLOSE_SHARE || (offset > 24 && speed > FLICK_SPEED)) {
        void this.close();
      } else {
        this.panel.style.removeProperty('transform');
      }
    };
    for (const handle of handles) {
      handle.addEventListener('pointerdown', onDown);
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    }
  }
}

/** Asks before something that cannot be undone, in a sheet; resolves to the answer. */
export function confirmInSheet(
  sheet: Sheet,
  options: {
    readonly title: string;
    readonly text: string;
    readonly confirm: string;
    readonly danger?: boolean;
  },
): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    const confirmButton = el('button', {
      class: `btn btn--${options.danger ? 'danger-solid' : 'primary'} btn--block btn--lg`,
      text: options.confirm,
      attrs: { type: 'button' },
      on: {
        click: () => {
          answer = true;
          void sheet.close();
        },
      },
    });
    sheet.open({
      title: options.title,
      body: [el('p', { class: 'sheet__text', text: options.text })],
      footer: [
        confirmButton,
        el('button', {
          class: 'btn btn--secondary btn--block btn--lg',
          text: tr.admin.ui.cancel,
          attrs: { type: 'button' },
          on: { click: () => void sheet.close() },
        }),
      ],
      onClose: () => resolve(answer),
    });
  });
}
