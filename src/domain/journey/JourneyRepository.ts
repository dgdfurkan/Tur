import type { Journey } from './Journey';

export interface JourneyRepository {
  findAll(): Promise<readonly Journey[]>;
}
