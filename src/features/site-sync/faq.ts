import { FAQ_TOPICS, type FaqTopic } from '@/application/dto/faqSchema';
import { FAQ_DRAFT_KEY } from '@/infrastructure/storage/keys';
import type { SafeStorage } from '@/infrastructure/storage/SafeStorage';

/** A question as the public pages need it. */
export interface LocalQuestion {
  readonly id: string;
  readonly topic: FaqTopic;
  readonly featured: boolean;
  readonly question: string;
  readonly answer: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readQuestion(value: unknown): LocalQuestion | null {
  if (!isRecord(value)) return null;
  const { id, topic, featured, question, answer } = value;
  if (
    typeof id !== 'string' ||
    !/^[a-z0-9-]{1,80}$/.test(id) ||
    typeof topic !== 'string' ||
    !(FAQ_TOPICS as readonly string[]).includes(topic) ||
    typeof featured !== 'boolean' ||
    typeof question !== 'string' ||
    question.length > 120 ||
    typeof answer !== 'string' ||
    answer.length > 600
  ) {
    return null;
  }
  return { id, topic: topic as FaqTopic, featured, question, answer };
}

/**
 * The questions as the panel changed them on this device, in their order; null
 * when the panel has not changed them. Read without the panel's checks: a
 * question of the wrong shape is left out.
 */
export function readLocalFaq(storage: SafeStorage): readonly LocalQuestion[] | null {
  const raw = storage.read(FAQ_DRAFT_KEY);
  if (raw === null) return null;
  try {
    const draft: unknown = JSON.parse(raw);
    if (!isRecord(draft) || !Array.isArray(draft['items'])) return null;
    return draft['items'].slice(0, 60).flatMap((item) => readQuestion(item) ?? []);
  } catch {
    return null;
  }
}

/**
 * Draws every list of questions on the page again from the panel's copy, the
 * way the page drew it: a list says which questions it shows with
 * `data-faq-topic` or `data-faq-featured`, and carries the template of one.
 */
export function syncFaq(root: ParentNode, questions: readonly LocalQuestion[]): void {
  for (const list of root.querySelectorAll<HTMLElement>('[data-faq-list]')) {
    const template = list.querySelector<HTMLTemplateElement>('template[data-faq-template]');
    if (!template) continue;
    const topic = list.dataset['faqTopic'];
    const featuredOnly = list.hasAttribute('data-faq-featured');
    const items = questions.flatMap((question) => {
      if ((topic && question.topic !== topic) || (featuredOnly && !question.featured)) return [];
      const item = template.content.firstElementChild?.cloneNode(true);
      if (!(item instanceof HTMLDetailsElement)) return [];
      item.id = `soru-${question.id}`;
      item.name = list.dataset['faqName'] ?? '';
      const text = item.querySelector('[data-faq-question]');
      const answer = item.querySelector('[data-faq-answer]');
      if (text) text.textContent = question.question;
      if (answer) answer.textContent = question.answer;
      return [item];
    });
    list.replaceChildren(...items, template);
  }
}
