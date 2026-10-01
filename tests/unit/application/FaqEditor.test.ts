import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FaqEntry } from '@/application/dto/faqSchema';
import { checkFaq, FaqEditor, InvalidFaqError, questionId } from '@/application/FaqEditor';
import { readLocalFaq } from '@/features/site-sync/faq';
import { FAQ_DRAFT_KEY } from '@/infrastructure/storage/keys';
import { LocalFaqDraft } from '@/infrastructure/storage/LocalFaqDraft';
import { memoryStorage } from '../support/stores';

const published = (
  JSON.parse(readFileSync(join(process.cwd(), 'src/content/faq.json'), 'utf8')) as FaqEntry[]
).sort((a, b) => a.order - b.order);

function editor(storage = memoryStorage()) {
  return {
    storage,
    faq: new FaqEditor(published, new LocalFaqDraft(storage), () => new Date('2026-10-01')),
  };
}

describe('questions', () => {
  it('passes the rules for the published list', () => {
    expect(() => checkFaq(published)).not.toThrow();
  });

  it('makes an address from a question in plain letters', () => {
    expect(questionId('Çocuklar İçin İndirim Var mı?', () => false)).toBe(
      'cocuklar-icin-indirim-var-mi',
    );
    expect(questionId('Ödeme?', (id) => id === 'odeme')).toBe('odeme-2');
  });
});

describe('FaqEditor', () => {
  it('shows the published questions until one is changed', () => {
    const { faq } = editor();
    expect(faq.items()).toEqual(published);
    expect(faq.isChanged()).toBe(false);
  });

  it('adds, changes and removes a question, numbering the list each time', () => {
    const { faq } = editor();
    const added = faq.add({
      topic: 'yolculuk',
      featured: true,
      question: 'Bagaj Sınırı Var mı?',
      answer: 'Her misafir bir valiz ve bir el çantası getirebilir.',
    });
    expect(added.id).toBe('bagaj-siniri-var-mi');
    expect(faq.items().at(-1)?.order).toBe(published.length + 1);
    faq.update(added.id, { featured: false });
    expect(faq.items().find((item) => item.id === added.id)?.featured).toBe(false);
    expect(faq.isChanged()).toBe(true);
    faq.remove(added.id);
    // Back to the published list: nothing is left to publish.
    expect(faq.isChanged()).toBe(false);
  });

  it('moves a question past its neighbour of the same topic', () => {
    const { faq } = editor();
    const travel = published.filter((item) => item.topic === 'yolculuk');
    const [first, second] = travel;
    if (!first || !second) throw new Error('too few questions');
    faq.move(second.id, -1);
    const moved = faq.items().filter((item) => item.topic === 'yolculuk');
    expect(moved.slice(0, 2).map((item) => item.id)).toEqual([second.id, first.id]);
    // The first of a topic cannot move up.
    faq.move(second.id, -1);
    expect(faq.items().filter((item) => item.topic === 'yolculuk')[0]?.id).toBe(second.id);
  });

  it('refuses a question without words and keeps nothing', () => {
    const { faq, storage } = editor();
    const [first] = published;
    if (!first) throw new Error('no questions');
    expect(() => faq.update(first.id, { answer: '  ' })).toThrow(InvalidFaqError);
    expect(storage.read(FAQ_DRAFT_KEY)).toBeNull();
  });

  it('is read on a public page as the panel left it', () => {
    const { faq, storage } = editor();
    const [first] = published;
    if (!first) throw new Error('no questions');
    faq.update(first.id, { question: 'Yerimi Nasıl Ayırtabilirim?' });
    expect(readLocalFaq(storage)?.[0]?.question).toBe('Yerimi Nasıl Ayırtabilirim?');
    expect(readLocalFaq(memoryStorage())).toBeNull();
  });
});
