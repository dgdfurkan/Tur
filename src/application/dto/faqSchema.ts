import { z } from '../zod';
import { slug } from './fields';

export const FAQ_TOPICS = ['rezervasyon', 'yolculuk', 'kurumsal'] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

/** A question visitors ask, with the office's answer. */
export interface FaqData {
  /** Where the question stands in its list; the content collection does not keep file order. */
  order: number;
  topic: FaqTopic;
  /** Also shown on the home page, the tour pages and the contact page. */
  featured: boolean;
  question: string;
  answer: string;
}

export interface FaqEntry extends FaqData {
  id: string;
}

export const faqSchema = z.object({
  order: z.number().int().min(1),
  topic: z.enum(FAQ_TOPICS),
  featured: z.boolean(),
  question: z.string().trim().min(1).max(120),
  answer: z.string().trim().min(1).max(600),
}) satisfies z.ZodType<FaqData>;

export const faqEntrySchema = faqSchema.extend({ id: slug }) satisfies z.ZodType<FaqEntry>;
