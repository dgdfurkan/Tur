import { getCollection } from 'astro:content';
import type { FaqEntry } from '@/application/dto/faqSchema';

/** The frequently asked questions, in the order the content file lists them. */
export async function loadFaq(): Promise<readonly FaqEntry[]> {
  const entries = await getCollection('faq');
  return entries.map((entry) => ({ id: entry.id, ...entry.data }));
}
