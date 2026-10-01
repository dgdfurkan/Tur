import { PAYMENT_METHODS, Passenger, type PaymentMethod } from '@/domain/booking/Passenger';
import type { PassengerRepository } from '@/domain/booking/PassengerRepository';
import { Phone } from '@/domain/booking/Phone';
import { Money } from '@/domain/shared/Money';
import type { Departure } from '@/domain/tour/Departure';
import type { Tour } from '@/domain/tour/Tour';
import type { TourSource } from './TourCatalogEditor';

/** What the entry form collects, before anything has been validated. */
export interface PassengerDraft {
  readonly departureId: string;
  readonly fullName: string;
  readonly phone: string;
  readonly seatNumber: number | null;
  readonly depositLira: number | null;
  readonly paymentMethod: string;
  readonly note: string;
}

export type DraftField =
  'departureId' | 'fullName' | 'phone' | 'seatNumber' | 'depositLira' | 'paymentMethod';

/** Why a field was rejected; the interface turns the reason into a message. */
export type DraftProblem = 'required' | 'invalid' | 'taken';

export type DraftErrors = Partial<Record<DraftField, DraftProblem>>;

export type SavePassengerResult =
  | { readonly ok: true; readonly passenger: Passenger }
  | { readonly ok: false; readonly errors: DraftErrors };

/** A departure as the office sees it: seats sold on the site plus the panel's own records. */
export interface DepartureBooking {
  readonly tour: Tour;
  readonly departure: Departure;
  readonly passengers: readonly Passenger[];
}

export interface BookingSummary {
  readonly departureCount: number;
  readonly passengerCount: number;
  readonly depositTotal: Money;
  readonly freeSeats: number;
}

const isPaymentMethod = (value: string): value is PaymentMethod =>
  (PAYMENT_METHODS as readonly string[]).includes(value);

/** Use cases of the operations panel: record passengers and deposits, watch occupancy. */
export class BookingService {
  constructor(
    private readonly catalog: TourSource,
    private readonly repository: PassengerRepository,
    private readonly now: () => Date,
    private readonly newId: () => string,
  ) {}

  /** Departures that have not left yet, soonest first. */
  bookings(today: string): readonly DepartureBooking[] {
    const passengers = this.repository.findAll();
    return this.catalog
      .tours()
      .flatMap((tour) =>
        tour.upcomingDepartures(today).map((departure) => this.merge(tour, departure, passengers)),
      )
      .sort((a, b) => a.departure.startDate.localeCompare(b.departure.startDate));
  }

  booking(departureId: string): DepartureBooking | undefined {
    return this.bookingWith(departureId, this.repository.findAll());
  }

  summary(today: string): BookingSummary {
    const bookings = this.bookings(today);
    return {
      departureCount: bookings.length,
      passengerCount: bookings.reduce((sum, booking) => sum + booking.passengers.length, 0),
      depositTotal: bookings
        .flatMap((booking) => booking.passengers)
        .reduce((sum, passenger) => sum.add(passenger.deposit), Money.zero()),
      freeSeats: bookings.reduce((sum, booking) => sum + booking.departure.occupancy.remaining, 0),
    };
  }

  addPassenger(draft: PassengerDraft): SavePassengerResult {
    return this.save(draft);
  }

  /**
   * Changes a record, which keeps its identity and the time it was made. Its
   * own seat counts as free, so the passenger can keep it or move to another.
   */
  updatePassenger(original: Passenger, draft: PassengerDraft): SavePassengerResult {
    return this.save(draft, original);
  }

  /** All records, for searching across departures. */
  passengers(): readonly Passenger[] {
    return this.repository.findAll();
  }

  /** What is still to be paid after the deposit, at the tour's price per person. */
  balance(passenger: Passenger): Money {
    const booking = this.booking(passenger.departureId);
    if (!booking) return Money.zero();
    return Money.fromKurus(Math.max(0, booking.tour.price.kurus - passenger.deposit.kurus));
  }

  /** Removes a record and returns it, so the caller can offer to undo. */
  removePassenger(passengerId: string): Passenger | undefined {
    const passenger = this.repository.findAll().find((item) => item.id === passengerId);
    if (passenger) this.repository.remove(passengerId);
    return passenger;
  }

  /** Puts a removed record back, unless its seat has been given away meanwhile. */
  restorePassenger(passenger: Passenger): boolean {
    const booking = this.booking(passenger.departureId);
    if (!booking || booking.departure.isBooked(passenger.seatNumber)) return false;
    this.repository.save(passenger);
    return true;
  }

  clear(): void {
    this.repository.replaceAll([]);
  }

  private save(draft: PassengerDraft, original?: Passenger): SavePassengerResult {
    const errors: DraftErrors = {};
    const others = this.repository.findAll().filter((item) => item.id !== original?.id);
    const booking = this.bookingWith(draft.departureId, others);
    if (!booking) errors.departureId = 'required';

    const fullName = draft.fullName.trim();
    if (fullName === '') errors.fullName = 'required';
    else if (!Passenger.isFullName(fullName)) errors.fullName = 'invalid';

    const phone = Phone.parse(draft.phone);
    if (draft.phone.trim() === '') errors.phone = 'required';
    else if (!phone) errors.phone = 'invalid';

    if (draft.seatNumber === null) errors.seatNumber = 'required';
    else if (booking && !booking.departure.layout.hasSeat(draft.seatNumber)) {
      errors.seatNumber = 'invalid';
    } else if (booking?.departure.isBooked(draft.seatNumber)) errors.seatNumber = 'taken';

    if (draft.depositLira === null) errors.depositLira = 'required';
    else if (!Number.isFinite(draft.depositLira) || draft.depositLira < 0) {
      errors.depositLira = 'invalid';
    }

    if (!isPaymentMethod(draft.paymentMethod)) errors.paymentMethod = 'required';

    if (
      Object.keys(errors).length > 0 ||
      !booking ||
      !phone ||
      draft.seatNumber === null ||
      draft.depositLira === null ||
      !isPaymentMethod(draft.paymentMethod)
    ) {
      return { ok: false, errors };
    }

    const passenger = new Passenger({
      id: original?.id ?? this.newId(),
      departureId: booking.departure.id,
      fullName,
      phone,
      seatNumber: draft.seatNumber,
      deposit: Money.fromLira(draft.depositLira),
      paymentMethod: draft.paymentMethod,
      note: draft.note,
      createdAt: original?.createdAt ?? this.now().toISOString(),
    });
    this.repository.save(passenger);
    return { ok: true, passenger };
  }

  private bookingWith(
    departureId: string,
    passengers: readonly Passenger[],
  ): DepartureBooking | undefined {
    for (const tour of this.catalog.tours()) {
      const departure = tour.findDeparture(departureId);
      if (departure) return this.merge(tour, departure, passengers);
    }
    return undefined;
  }

  private merge(
    tour: Tour,
    departure: Departure,
    passengers: readonly Passenger[],
  ): DepartureBooking {
    const own = passengers
      .filter((passenger) => passenger.departureId === departure.id)
      .sort((a, b) => a.seatNumber - b.seatNumber);
    return {
      tour,
      departure: departure.withBookedSeats(own.map((passenger) => passenger.seatNumber)),
      passengers: own,
    };
  }
}
