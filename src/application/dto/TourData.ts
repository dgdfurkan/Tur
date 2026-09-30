import type { EmblemKey, StopKind, TourCategory } from '@/domain/tour/Tour';
import type { SeatLayoutCode } from '@/domain/vehicle/SeatLayout';

/**
 * Serializable shape of a tour. Content files are validated against it at build
 * time and the same object is handed to the browser, where toTour turns it
 * back into domain objects.
 */
export interface StopData {
  id: string;
  name: string;
  kind: StopKind;
  lat: number;
  lon: number;
  summary: string;
  durationMinutes?: number | undefined;
}

export interface DayData {
  title: string;
  summary: string;
  stops: StopData[];
}

export interface HotelData {
  name: string;
  location: string;
  stars: number;
  nights: number;
  board: string;
}

export interface DepartureData {
  id: string;
  startDate: string;
  endDate: string;
  time: string;
  meetingPoint: string;
  bookedSeats: number[];
}

export interface TourData {
  title: string;
  category: TourCategory;
  summary: string;
  emblem: EmblemKey;
  destination: string;
  nights: number;
  distanceFromAnkaraKm: number;
  pricePerPersonTry: number;
  singleSupplementTry?: number | undefined;
  seatLayout: SeatLayoutCode;
  included: string[];
  excluded: string[];
  hotels: HotelData[];
  days: DayData[];
  departures: DepartureData[];
}

export interface TourSnapshot extends TourData {
  id: string;
}
