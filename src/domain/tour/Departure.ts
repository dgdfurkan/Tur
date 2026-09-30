import type { SeatLayout } from '../vehicle/SeatLayout';
import { Occupancy } from './Occupancy';

export interface DepartureProps {
  readonly id: string;
  readonly tourId: string;
  /** ISO calendar dates (YYYY-MM-DD); they compare correctly as strings. */
  readonly startDate: string;
  readonly endDate: string;
  /** 24-hour HH:MM. */
  readonly time: string;
  readonly meetingPoint: string;
  readonly layout: SeatLayout;
  readonly bookedSeats: readonly number[];
}

/** One scheduled run of a tour on a specific coach. */
export class Departure {
  readonly id: string;
  readonly tourId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly time: string;
  readonly meetingPoint: string;
  readonly layout: SeatLayout;
  private readonly booked: ReadonlySet<number>;

  constructor(props: DepartureProps) {
    if (props.endDate < props.startDate) {
      throw new RangeError(`Departure ${props.id} ends before it starts`);
    }
    const booked = new Set<number>();
    for (const seat of props.bookedSeats) {
      if (!props.layout.hasSeat(seat)) {
        throw new RangeError(`Departure ${props.id} books seat ${seat}, which does not exist`);
      }
      if (booked.has(seat)) {
        throw new RangeError(`Departure ${props.id} books seat ${seat} twice`);
      }
      booked.add(seat);
    }
    this.id = props.id;
    this.tourId = props.tourId;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.time = props.time;
    this.meetingPoint = props.meetingPoint;
    this.layout = props.layout;
    this.booked = booked;
  }

  get occupancy(): Occupancy {
    return new Occupancy(this.layout.capacity, this.booked.size);
  }

  get bookedSeats(): readonly number[] {
    return [...this.booked].sort((a, b) => a - b);
  }

  get freeSeats(): readonly number[] {
    return this.layout.seats.map((seat) => seat.number).filter((seat) => !this.booked.has(seat));
  }

  isBooked(seatNumber: number): boolean {
    return this.booked.has(seatNumber);
  }

  isUpcoming(today: string): boolean {
    return this.startDate >= today;
  }

  /** Copy with extra seats taken; seats that are already booked are ignored. */
  withBookedSeats(seats: readonly number[]): Departure {
    const merged = new Set(this.booked);
    for (const seat of seats) {
      if (this.layout.hasSeat(seat)) merged.add(seat);
    }
    return new Departure({
      id: this.id,
      tourId: this.tourId,
      startDate: this.startDate,
      endDate: this.endDate,
      time: this.time,
      meetingPoint: this.meetingPoint,
      layout: this.layout,
      bookedSeats: [...merged],
    });
  }
}
