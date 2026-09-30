/** What the site knows about the access code: enough to check it, not enough to read it. */
export interface LockSettings {
  /** Random bytes mixed into the code before it is stretched, as hex. */
  readonly salt: string;
  /** SHA-256 of the key the right code stretches to, as hex. */
  readonly verifier: string;
  /** PBKDF2 rounds; more rounds make every guess slower. */
  readonly iterations: number;
}

/** Where the key of an opened panel is kept; both kinds of web storage fit. */
export interface KeyStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

const STORE_KEY = 'panel-key';
const KEY_BITS = 256;

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1)
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Stretches an access code into a key. Codes are compared in the form people type them, trimmed. */
export async function deriveKey(code: string, settings: LockSettings): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code.trim().normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromHex(settings.salt),
      iterations: settings.iterations,
    },
    material,
    KEY_BITS,
  );
  return toHex(bits);
}

/** The fingerprint of a key, which is what the site stores instead of the code. */
export async function verifierOf(keyHex: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', fromHex(keyHex)));
}

/**
 * Keeps the operations panel closed to visitors who do not have the access
 * code. The page holds only a fingerprint of the key, and an opened panel
 * remembers the key itself, so copying the fingerprint into storage opens
 * nothing.
 *
 * This is a lock on a door, not a vault: the site is static, so everything
 * behind it is still downloadable by someone who goes looking. Real access
 * control needs a server (see docs/yol-haritasi.md).
 */
export class PanelLock {
  constructor(
    private readonly settings: LockSettings,
    private readonly session: KeyStore,
    private readonly device: KeyStore,
  ) {}

  /** Whether this browser has opened the panel before and still holds the key. */
  async isOpen(): Promise<boolean> {
    const key = this.session.read(STORE_KEY) ?? this.device.read(STORE_KEY);
    if (!key || !/^[0-9a-f]{64}$/.test(key)) return false;
    return (await verifierOf(key)) === this.settings.verifier;
  }

  /**
   * Tries a code. On success the key is kept for this tab, or for this device
   * when `remember` is set.
   */
  async open(code: string, remember: boolean): Promise<boolean> {
    if (code.trim() === '') return false;
    const key = await deriveKey(code, this.settings);
    if ((await verifierOf(key)) !== this.settings.verifier) return false;
    (remember ? this.device : this.session).write(STORE_KEY, key);
    return true;
  }

  close(): void {
    this.session.remove(STORE_KEY);
    this.device.remove(STORE_KEY);
  }
}
