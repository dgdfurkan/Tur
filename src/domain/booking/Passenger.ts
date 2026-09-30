import type { Money } from '../shared/Money';
import type { Phone } from './Phone';

export const PAYMENT_METHODS = ['nakit', 'havale', 'kart'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface PassengerProps {
  readonly id: string;
  readonly departureId: string;
  readonly fullName: string;
  readonly phone: Phone;
  readonly seatNumber: number;
  readonly deposit: Money;
  readonly paymentMethod: PaymentMethod;
  readonly note: string;
  /** ISO 8601 timestamp of when the record was created. */
  readonly createdAt: string;
}

/** A traveller booked onto a departure, with the deposit taken from them. */
export class Passenger {
  readonly id: string;
  readonly departureId: string;
  readonly fullName: string;
  readonly phone: Phone;
  readonly seatNumber: number;
  readonly deposit: Money;
  readonly paymentMethod: PaymentMethod;
  readonly note: string;
  readonly createdAt: string;

  constructor(props: PassengerProps) {
    const fullName = props.fullName.trim().replace(/\s+/g, ' ');
    if (!Passenger.isFullName(fullName)) {
      throw new RangeError('A passenger needs a first name and a surname');
    }
    if (!Number.isInteger(props.seatNumber) || props.seatNumber < 1) {
      throw new RangeError(`Invalid seat number: ${props.seatNumber}`);
    }
    this.id = props.id;
    this.departureId = props.departureId;
    this.fullName = fullName;
    this.phone = props.phone;
    this.seatNumber = props.seatNumber;
    this.deposit = props.deposit;
    this.paymentMethod = props.paymentMethod;
    this.note = props.note.trim();
    this.createdAt = props.createdAt;
  }

  /** At least two words of two or more letters each. */
  static isFullName(value: string): boolean {
    const words = value.trim().split(/\s+/);
    return words.length >= 2 && words.every((word) => /^[\p{L}'’.-]{2,}$/u.test(word));
  }
}
