export type OccupancyLevel = 'available' | 'limited' | 'full';

const LIMITED_THRESHOLD = 6;

/** How full a departure is. */
export class Occupancy {
  constructor(
    readonly capacity: number,
    readonly booked: number,
  ) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError(`Capacity must be a positive integer, received ${capacity}`);
    }
    if (!Number.isInteger(booked) || booked < 0 || booked > capacity) {
      throw new RangeError(`Booked must be between 0 and ${capacity}, received ${booked}`);
    }
  }

  get remaining(): number {
    return this.capacity - this.booked;
  }

  get ratio(): number {
    return this.booked / this.capacity;
  }

  get percent(): number {
    return Math.round(this.ratio * 100);
  }

  get level(): OccupancyLevel {
    if (this.remaining === 0) return 'full';
    return this.remaining <= LIMITED_THRESHOLD ? 'limited' : 'available';
  }
}
