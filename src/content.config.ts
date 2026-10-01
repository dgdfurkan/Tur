import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { faqSchema } from '@/application/dto/faqSchema';
import { journeyDataSchema } from '@/application/dto/journeySchema';
import { tourDataSchema } from '@/application/dto/tourSchema';

export const collections = {
  tours: defineCollection({
    loader: glob({ pattern: '*.json', base: './src/content/tours' }),
    schema: tourDataSchema,
  }),
  journeys: defineCollection({
    loader: glob({ pattern: '*.json', base: './src/content/journeys' }),
    schema: journeyDataSchema,
  }),
  faq: defineCollection({
    loader: file('src/content/faq.json'),
    schema: faqSchema,
  }),
};
