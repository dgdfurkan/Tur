import { JOURNEY_GROUPS } from '@/domain/journey/Journey';
import { SCENE_KEYS } from '@/domain/tour/Tour';
import { z } from '../zod';
import { isoDate, slug } from './fields';
import type { JourneyData, JourneySnapshot } from './JourneyData';

const scene = z.enum(SCENE_KEYS);

/**
 * The rules every completed journey obeys, whether it comes from a content
 * file or was recorded in the operations panel.
 */
export const journeyDataSchema = z.object({
  tour: slug,
  title: z.string().trim().min(1).max(80),
  scene,
  startDate: isoDate,
  endDate: isoDate,
  group: z.enum(JOURNEY_GROUPS),
  guests: z.number().int().min(1).max(1000),
  distanceKm: z.number().int().min(1).max(20_000),
  story: z.string().trim().min(1).max(700),
  moments: z
    .array(
      z.object({
        day: z.number().int().min(1).max(60),
        place: z.string().trim().min(1).max(60),
        scene,
        note: z.string().trim().max(280),
      }),
    )
    .max(12),
}) satisfies z.ZodType<JourneyData>;

export const journeySnapshotSchema = journeyDataSchema.extend({
  id: slug,
}) satisfies z.ZodType<JourneySnapshot>;
