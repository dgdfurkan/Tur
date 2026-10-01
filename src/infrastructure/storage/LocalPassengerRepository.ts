import { PAYMENT_METHODS, Passenger, type PaymentMethod } from '@/domain/booking/Passenger';
import type { PassengerRepository } from '@/domain/booking/PassengerRepository';
import { Phone } from '@/domain/booking/Phone';
import { Money } from '@/domain/shared/Money';
import type { SafeStorage } from './SafeStorage';

const KEY = 'passengers';

/** Plain shape written to storage; never trusted when read back. */
export interface StoredPassenger {
  id: string;
  departureId: string;
  fullName: string;
  phone: string;
  seatNumber: number;
  depositKurus: number;
  paymentMethod: string;
  note: string;
  createdAt: string;
}

const isPaymentMethod = (value: string): value is PaymentMethod =>
  (PAYMENT_METHODS as readonly string[]).includes(value);

/**
 * Passenger records in localStorage. Anything that fails to parse or validate
 * is dropped, so a corrupted or tampered entry can never break the panel.
 */
export class LocalPassengerRepository implements PassengerRepository {
  constructor(private readonly storage: SafeStorage) {}

  findAll(): readonly Passenger[] {
    const raw = this.storage.read(KEY);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.flatMap((item) => {
        const passenger = LocalPassengerRepository.revive(item);
        return passenger ? [passenger] : [];
      });
    } catch {
      return [];
    }
  }

  save(passenger: Passenger): void {
    this.replaceAll([...this.findAll().filter((item) => item.id !== passenger.id), passenger]);
  }

  remove(passengerId: string): void {
    this.replaceAll(this.findAll().filter((item) => item.id !== passengerId));
  }

  replaceAll(passengers: readonly Passenger[]): void {
    this.storage.write(KEY, JSON.stringify(passengers.map(LocalPassengerRepository.toPlain)));
  }

  /** The plain shape a record is written in, here and in backups. */
  static toPlain(passenger: Passenger): StoredPassenger {
    return {
      id: passenger.id,
      departureId: passenger.departureId,
      fullName: passenger.fullName,
      phone: passenger.phone.digits,
      seatNumber: passenger.seatNumber,
      depositKurus: passenger.deposit.kurus,
      paymentMethod: passenger.paymentMethod,
      note: passenger.note,
      createdAt: passenger.createdAt,
    };
  }

  /** Turns a plain record back into a passenger; anything incomplete or invalid gives null. */
  static revive(item: unknown): Passenger | null {
    if (typeof item !== 'object' || item === null) return null;
    const record = item as Partial<Record<keyof StoredPassenger, unknown>>;
    const phone = typeof record.phone === 'string' ? Phone.parse(record.phone) : null;
    if (
      typeof record.id !== 'string' ||
      typeof record.departureId !== 'string' ||
      typeof record.fullName !== 'string' ||
      typeof record.seatNumber !== 'number' ||
      typeof record.depositKurus !== 'number' ||
      typeof record.paymentMethod !== 'string' ||
      typeof record.note !== 'string' ||
      typeof record.createdAt !== 'string' ||
      !isPaymentMethod(record.paymentMethod) ||
      phone === null
    ) {
      return null;
    }
    try {
      return new Passenger({
        id: record.id,
        departureId: record.departureId,
        fullName: record.fullName,
        phone,
        seatNumber: record.seatNumber,
        deposit: Money.fromKurus(record.depositKurus),
        paymentMethod: record.paymentMethod,
        note: record.note,
        createdAt: record.createdAt,
      });
    } catch {
      return null;
    }
  }
}
