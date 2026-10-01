import { el } from './dom';

const VISIBLE_MS = 4500;
/** Longer than the toast's fade. */
const CLEAR_MS = 400;

/**
 * A short message above the tab bar, optionally with an action such as undo.
 * A new message replaces the one on screen.
 */
export class Toast {
  private readonly root: HTMLElement;
  private readonly text: HTMLElement;
  private readonly action: HTMLButtonElement;
  private timer = 0;
  private onAction: (() => void) | undefined;

  constructor(host: HTMLElement) {
    this.text = el('span', { class: 'toast__text' });
    this.action = el('button', {
      class: 'toast__action',
      attrs: { type: 'button' },
      on: {
        click: () => {
          const run = this.onAction;
          this.hide();
          run?.();
        },
      },
    });
    this.root = el('div', { class: 'toast', attrs: { role: 'status', 'aria-live': 'polite' } }, [
      this.text,
      this.action,
    ]);
    // A finger resting on the toast keeps it up; reading takes as long as it takes.
    this.root.addEventListener('pointerenter', () => clearTimeout(this.timer));
    this.root.addEventListener('pointerleave', () => this.schedule());
    host.append(this.root);
  }

  show(message: string, action?: { readonly label: string; readonly run: () => void }): void {
    this.text.textContent = message;
    this.onAction = action?.run;
    this.action.hidden = action === undefined;
    this.action.textContent = action?.label ?? '';
    this.root.dataset['visible'] = 'true';
    this.schedule();
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.hide(), VISIBLE_MS);
  }

  private hide(): void {
    clearTimeout(this.timer);
    this.onAction = undefined;
    this.root.dataset['visible'] = 'false';
    // Once it has faded, the message leaves the page too, so nothing reads a toast no one sees.
    this.timer = window.setTimeout(() => {
      this.text.textContent = '';
      this.action.hidden = true;
    }, CLEAR_MS);
  }
}
