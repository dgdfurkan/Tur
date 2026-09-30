import { required } from './dom';

const VISIBLE_MS = 5000;

/** A short confirmation at the bottom of the panel, optionally with an undo action. */
export class Toast {
  private readonly text: HTMLElement;
  private readonly action: HTMLButtonElement;
  private timer = 0;
  private onAction: (() => void) | undefined;

  constructor(private readonly root: HTMLElement) {
    this.text = required(root, '[data-toast-text]');
    this.action = required(root, '[data-toast-action]');
    this.action.addEventListener('click', () => {
      const run = this.onAction;
      this.hide();
      run?.();
    });
  }

  show(message: string, action?: { label: string; run: () => void }): void {
    clearTimeout(this.timer);
    this.text.textContent = message;
    this.onAction = action?.run;
    this.action.hidden = action === undefined;
    this.action.textContent = action?.label ?? '';
    this.root.dataset['visible'] = 'true';
    this.timer = window.setTimeout(() => this.hide(), VISIBLE_MS);
  }

  private hide(): void {
    clearTimeout(this.timer);
    this.onAction = undefined;
    this.root.dataset['visible'] = 'false';
  }
}
