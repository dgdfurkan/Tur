import { z } from '../zod';

export const FAQ_TOPICS = ['rezervasyon', 'yolculuk', 'kurumsal'] as const;
export type FaqTopic = (typeof FAQ_TOPICS)[number];

/** A question visitors ask, with the office's answer. */
export interface FaqData {
  topic: FaqTopic;
  /** Also shown on the home page and on tour pages. */
  featured: boolean;
  question: string;
  answer: string;
}

export interface FaqEntry extends FaqData {
  id: string;
}

export const faqSchema = z.object({
  topic: z.enum(FAQ_TOPICS),
  featured: z.boolean(),
  question: z.string().trim().min(1).max(120),
  answer: z.string().trim().min(1).max(600),
}) satisfies z.ZodType<FaqData>;
