import { panelLock } from '@/config/panel';
import { tr } from '@/i18n/tr';
import { SafeStorage } from '@/infrastructure/storage/SafeStorage';
import { isFramed } from '@/shared/framing';
import { required } from '../dom';
import { PanelLock } from './PanelLock';

const MAX_TRIES = 5;
const PAUSE_SECONDS = 30;

/**
 * Resolves once the panel may be shown: straight away on a device that has
 * opened it before, otherwise when the right access code is typed. It never
 * resolves inside another page's frame, where a visitor could be tricked into
 * pressing the panel's buttons.
 */
export function whenPanelOpens(root: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    if (isFramed()) {
      root.dataset['framed'] = 'true';
      return;
    }

    const form = required<HTMLFormElement>(root, '[data-gate]');
    const error = required<HTMLElement>(form, '[data-gate-error]');
    const submit = required<HTMLButtonElement>(form, 'button[type="submit"]');
    const lockButton = required<HTMLButtonElement>(root, '[data-action="lock"]');
    const { gate } = tr.admin;

    // Web Crypto only exists on HTTPS and localhost; without it no code can be checked.
    if (!globalThis.crypto?.subtle) {
      root.dataset['access'] = 'locked';
      error.textContent = gate.insecure;
      submit.disabled = true;
      return;
    }

    const lock = new PanelLock(panelLock, SafeStorage.session(), new SafeStorage());
    const open = (): void => {
      root.dataset['access'] = 'open';
      lockButton.hidden = false;
      resolve();
    };
    lockButton.addEventListener('click', () => {
      lock.close();
      location.reload();
    });

    let tries = 0;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const code = data.get('code');
      if (typeof code !== 'string' || submit.disabled) return;
      submit.disabled = true;
      void lock.open(code, data.get('remember') !== null).then((accepted) => {
        if (accepted) {
          form.reset();
          open();
          return;
        }
        tries += 1;
        if (tries < MAX_TRIES) {
          error.textContent = gate.wrong;
          submit.disabled = false;
          return;
        }
        // Guessing at the form is slowed down; the pause is a courtesy, not a defence.
        tries = 0;
        error.textContent = gate.paused;
        setTimeout(() => {
          error.textContent = '';
          submit.disabled = false;
        }, PAUSE_SECONDS * 1000);
      });
    });

    void lock.isOpen().then((isOpen) => {
      if (isOpen) open();
      else root.dataset['access'] = 'locked';
    });
  });
}
