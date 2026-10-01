import type { FaqData, FaqEntry } from './dto/faqSchema';
import { faqEntrySchema } from './dto/faqSchema';
import { fingerprint } from './fingerprint';
import { z } from './zod';

/** The questions as changed in the panel, and the published list the change started from. */
export interface FaqDraft {
  readonly base: string;
  readonly items: readonly FaqEntry[];
  /** ISO 8601 time of the last change. */
  readonly updatedAt: string;
}

export interface FaqDraftRepository {
  /** The stored draft, already checked; null when there is none. */
  load(): FaqDraft | null;
  save(draft: FaqDraft): void;
  clear(): void;
}

/** A change that would leave a question without its words, or two questions with one address. */
export class InvalidFaqError extends Error {
  override readonly name = 'InvalidFaqError';
}

const MAX_QUESTIONS = 60;

export const faqListSchema = z
  .array(faqEntrySchema)
  .max(MAX_QUESTIONS)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
    message: 'Every question needs its own id',
  });

/** Checks a list of questions and numbers them in the order given. */
export function checkFaq(candidate: unknown): FaqEntry[] {
  const parsed = faqListSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new InvalidFaqError(parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data.map((item, index) => ({ ...item, order: index + 1 }));
}

const LETTERS: Readonly<Record<string, string>> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/** An address made from a question: Turkish letters plainly written, words joined by hyphens. */
export function questionId(question: string, taken: (id: string) => boolean): string {
  const base =
    question
      .toLocaleLowerCase('tr-TR')
      .replace(/[çğıöşüâîû]/g, (letter) => LETTERS[letter] ?? letter)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || 'soru';
  let id = base;
  for (let n = 2; taken(id); n += 1) id = `${base}-${n}`;
  return id;
}

/**
 * The questions as the office sees them: the published list, or the panel's
 * changed copy of it. The list is kept and checked whole, so its order is one
 * of the things that can change.
 */
export class FaqEditor {
  constructor(
    private readonly published: readonly FaqEntry[],
    private readonly drafts: FaqDraftRepository,
    private readonly now: () => Date,
  ) {}

  items(): readonly FaqEntry[] {
    return this.drafts.load()?.items ?? this.published;
  }

  isChanged(): boolean {
    return this.drafts.load() !== null;
  }

  /** Whether the site has published other questions since the change began. */
  isStale(): boolean {
    const draft = this.drafts.load();
    return draft !== null && draft.base !== fingerprint(this.published);
  }

  add(data: Omit<FaqData, 'order'>): FaqEntry {
    const items = this.items();
    const id = questionId(data.question, (candidate) =>
      items.some((item) => item.id === candidate),
    );
    const entry: FaqEntry = { ...data, id, order: items.length + 1 };
    this.replace([...items, entry]);
    return entry;
  }

  update(id: string, patch: Partial<Omit<FaqData, 'order'>>): void {
    this.replace(this.items().map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  remove(id: string): void {
    this.replace(this.items().filter((item) => item.id !== id));
  }

  /** Moves a question past its neighbour of the same topic, up for -1 and down for 1. */
  move(id: string, by: -1 | 1): void {
    const items = [...this.items()];
    const index = items.findIndex((item) => item.id === id);
    const current = items[index];
    if (!current) return;
    const step = (from: number): number => {
      for (let at = from + by; at >= 0 && at < items.length; at += by) {
        if (items[at]?.topic === current.topic) return at;
      }
      return -1;
    };
    const target = step(index);
    const neighbour = items[target];
    if (target === -1 || !neighbour) return;
    items[target] = current;
    items[index] = neighbour;
    this.replace(items);
  }

  discard(): void {
    this.drafts.clear();
  }

  private replace(next: readonly FaqEntry[]): void {
    const items = checkFaq(next);
    // Changed back to what the site shows: there is nothing left to publish.
    if (fingerprint(items) === fingerprint(checkFaq(this.published))) {
      this.drafts.clear();
      return;
    }
    this.drafts.save({
      base: fingerprint(this.published),
      items,
      updatedAt: this.now().toISOString(),
    });
  }
}
