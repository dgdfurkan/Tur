import type { Passenger } from './Passenger';

/**
 * Where passenger records live. The demo keeps them in the browser; the real
 * panel will put an HTTP-backed implementation behind the same interface.
 */
export interface PassengerRepository {
  findAll(): readonly Passenger[];
  save(passenger: Passenger): void;
  remove(passengerId: string): void;
  replaceAll(passengers: readonly Passenger[]): void;
}
