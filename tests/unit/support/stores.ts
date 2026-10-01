import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TourData, TourSnapshot } from '@/application/dto/TourData';
import { SafeStorage, type KeyValueStore } from '@/infrastructure/storage/SafeStorage';

/** In-memory Web Storage, so stores can be tested without a browser. */
export class MemoryStore implements KeyValueStore {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

export function memoryStorage(): SafeStorage {
  return new SafeStorage(new MemoryStore());
}

const CONTENT_DIR = join(process.cwd(), 'src/content/tours');

/** The site's tours as the panel receives them. */
export function publishedTours(): TourSnapshot[] {
  return readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      id: file.replace(/\.json$/, ''),
      ...(JSON.parse(readFileSync(join(CONTENT_DIR, file), 'utf8')) as TourData),
    }));
}
