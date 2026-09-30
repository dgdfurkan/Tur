import type { Tour } from './Tour';

export interface TourRepository {
  findAll(): Promise<readonly Tour[]>;
}
