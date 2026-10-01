import { describe, expect, it } from 'vitest';
import {
  deriveKey,
  PanelLock,
  verifierOf,
  type KeyStore,
  type LockSettings,
} from '@/features/admin/access/PanelLock';
import { TEST_PANEL_CODE } from '../../panelCode';

class MemoryStore implements KeyStore {
  private readonly values = new Map<string, string>();
  read(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  write(key: string, value: string): void {
    this.values.set(key, value);
  }
  remove(key: string): void {
    this.values.delete(key);
  }
}

/** The lock that test builds use; kept in step with src/config/panel.ts by the first test. */
const settings: LockSettings = {
  salt: '00112233445566778899aabbccddeeff',
  verifier: 'f947cd1ae1b2432d679840b02f3556f38cbf92747e49ce1c2eaa295e8e49d037',
  iterations: 1000,
};

function lock(): { lock: PanelLock; session: MemoryStore; device: MemoryStore } {
  const session = new MemoryStore();
  const device = new MemoryStore();
  return { lock: new PanelLock(settings, session, device), session, device };
}

describe('PanelLock', () => {
  it('matches the test code to the lock that test builds use', async () => {
    expect(await verifierOf(await deriveKey(TEST_PANEL_CODE, settings))).toBe(settings.verifier);
  });

  it('stays closed until the right code is given', async () => {
    const { lock: panel } = lock();
    expect(await panel.isOpen()).toBe(false);
    expect(await panel.open('yanlis-kod', false)).toBe(false);
    expect(await panel.open('', false)).toBe(false);
    expect(await panel.isOpen()).toBe(false);
    expect(await panel.open(TEST_PANEL_CODE, false)).toBe(true);
    expect(await panel.isOpen()).toBe(true);
  });

  it('forgives spaces around the code, but not a different code', async () => {
    const { lock: panel } = lock();
    expect(await panel.open(`  ${TEST_PANEL_CODE} `, false)).toBe(true);
    expect(await lock().lock.open(TEST_PANEL_CODE.toUpperCase(), false)).toBe(false);
  });

  it('remembers the key for the tab, or for the device when asked', async () => {
    const tab = lock();
    await tab.lock.open(TEST_PANEL_CODE, false);
    expect(tab.session.read('panel-key')).not.toBeNull();
    expect(tab.device.read('panel-key')).toBeNull();

    const kept = lock();
    await kept.lock.open(TEST_PANEL_CODE, true);
    expect(kept.device.read('panel-key')).not.toBeNull();
    // Another tab on the same device opens without the code.
    expect(await new PanelLock(settings, new MemoryStore(), kept.device).isOpen()).toBe(true);
  });

  it('is not opened by copying the public fingerprint into storage', async () => {
    const { lock: panel, device } = lock();
    device.write('panel-key', settings.verifier);
    expect(await panel.isOpen()).toBe(false);
    device.write('panel-key', 'not-a-key');
    expect(await panel.isOpen()).toBe(false);
  });

  it('closes again', async () => {
    const { lock: panel } = lock();
    await panel.open(TEST_PANEL_CODE, true);
    panel.close();
    expect(await panel.isOpen()).toBe(false);
  });
});
