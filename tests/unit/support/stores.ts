import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JourneyData, JourneySnapshot } from '@/application/dto/JourneyData';
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

/** The records of a content folder, each with its file name as its id. */
function readContent<T>(folder: string): (T & { id: string })[] {
  const dir = join(process.cwd(), 'src/content', folder);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => ({
      id: file.replace(/\.json$/, ''),
      ...(JSON.parse(readFileSync(join(dir, file), 'utf8')) as T),
    }));
}

/** The site's tours as the panel receives them. */
export function publishedTours(): TourSnapshot[] {
  return readContent<TourData>('tours');
}

/** The site's past journeys as the panel receives them. */
export function publishedJourneys(): JourneySnapshot[] {
  return readContent<JourneyData>('journeys');
}
