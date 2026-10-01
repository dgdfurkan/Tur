import { checkFaq, type FaqDraft, type FaqDraftRepository } from '@/application/FaqEditor';
import { FAQ_DRAFT_KEY } from './keys';
import type { SafeStorage } from './SafeStorage';

/** The panel's changed list of questions in localStorage, checked whole whenever it is read. */
export class LocalFaqDraft implements FaqDraftRepository {
  constructor(private readonly storage: SafeStorage) {}

  load(): FaqDraft | null {
    const raw = this.storage.read(FAQ_DRAFT_KEY);
    if (raw === null) return null;
    try {
      return LocalFaqDraft.revive(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  save(draft: FaqDraft): void {
    this.storage.write(FAQ_DRAFT_KEY, JSON.stringify(draft));
  }

  clear(): void {
    this.storage.remove(FAQ_DRAFT_KEY);
  }

  /** The draft, if it is whole and every question in it is valid. */
  static revive(value: unknown): FaqDraft | null {
    if (typeof value !== 'object' || value === null) return null;
    const { base, items, updatedAt } = value as Record<string, unknown>;
    if (typeof base !== 'string' || typeof updatedAt !== 'string') return null;
    try {
      return { base, items: checkFaq(items), updatedAt };
    } catch {
      return null;
    }
  }
}
