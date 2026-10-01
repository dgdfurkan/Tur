import { getCollection } from 'astro:content';
import type { FaqEntry } from '@/application/dto/faqSchema';

/** The frequently asked questions, in the order the office set for them. */
export async function loadFaq(): Promise<readonly FaqEntry[]> {
  const entries = await getCollection('faq');
  return entries
    .map((entry) => ({ id: entry.id, ...entry.data }))
    .sort((a, b) => a.order - b.order);
}
