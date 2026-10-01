import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { tourDataSchema } from '@/application/dto/tourSchema';

export const collections = {
  tours: defineCollection({
    loader: glob({ pattern: '*.json', base: './src/content/tours' }),
    schema: tourDataSchema,
  }),
};
