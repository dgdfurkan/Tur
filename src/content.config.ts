import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import type { TourData } from '@/application/dto/TourData';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM');

const stop = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['departure', 'sight', 'rest', 'lodging', 'arrival']),
  // Turkey's bounding box; catches swapped or mistyped coordinates at build time.
  lat: z.number().min(35.5).max(42.5),
  lon: z.number().min(25.5).max(45),
  summary: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
});

const tour = z.object({
  title: z.string().min(1),
  category: z.enum(['kultur', 'doga', 'gunubirlik']),
  summary: z.string().min(1),
  emblem: z.enum(['peribacasi', 'yayla', 'antik-kent', 'konak', 'vadi']),
  destination: z.string().min(1),
  nights: z.number().int().min(0),
  distanceFromAnkaraKm: z.number().int().positive(),
  pricePerPersonTry: z.number().int().positive(),
  singleSupplementTry: z.number().int().positive().optional(),
  seatLayout: z.enum(['2+1', '2+2']),
  included: z.array(z.string().min(1)).min(1),
  excluded: z.array(z.string().min(1)).min(1),
  hotels: z.array(
    z.object({
      name: z.string().min(1),
      location: z.string().min(1),
      stars: z.number().int().min(1).max(5),
      nights: z.number().int().positive(),
      board: z.string().min(1),
    }),
  ),
  days: z
    .array(
      z.object({
        title: z.string().min(1),
        summary: z.string().min(1),
        stops: z.array(stop).min(1),
      }),
    )
    .min(1),
  departures: z.array(
    z.object({
      id: z.string().min(1),
      startDate: isoDate,
      endDate: isoDate,
      time: clockTime,
      meetingPoint: z.string().min(1),
      bookedSeats: z.array(z.number().int().positive()),
    }),
  ),
}) satisfies z.ZodType<TourData>;

export const collections = {
  tours: defineCollection({
    loader: glob({ pattern: '*.json', base: './src/content/tours' }),
    schema: tour,
  }),
};
