/** The part of the Web Storage API this project uses; lets tests inject a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * localStorage that never throws. Private browsing, a full quota or a blocked
 * site setting all make the real thing throw; callers then simply get nothing.
 * Keys share one prefix because the GitHub Pages origin is shared with other sites.
 */
export class SafeStorage {
  static readonly PREFIX = 'tur-demo:v1:';

  constructor(private readonly store: KeyValueStore | undefined = SafeStorage.browserStore()) {}

  read(key: string): string | null {
    try {
      return this.store?.getItem(SafeStorage.PREFIX + key) ?? null;
    } catch {
      return null;
    }
  }

  write(key: string, value: string): boolean {
    try {
      this.store?.setItem(SafeStorage.PREFIX + key, value);
      return this.store !== undefined;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      this.store?.removeItem(SafeStorage.PREFIX + key);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  private static browserStore(): KeyValueStore | undefined {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }
}
