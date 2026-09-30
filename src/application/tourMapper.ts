import { GeoPoint } from '@/domain/geo/GeoPoint';
import { Money } from '@/domain/shared/Money';
import { Departure } from '@/domain/tour/Departure';
import { Tour } from '@/domain/tour/Tour';
import { SeatLayout } from '@/domain/vehicle/SeatLayout';
import type { TourSnapshot } from './dto/TourData';

/** Builds the domain object from the serializable tour shape. */
export function toTour(snapshot: TourSnapshot): Tour {
  const layout = SeatLayout.of(snapshot.seatLayout);
  return new Tour({
    id: snapshot.id,
    title: snapshot.title,
    category: snapshot.category,
    summary: snapshot.summary,
    emblem: snapshot.emblem,
    scene: snapshot.scene,
    destination: snapshot.destination,
    nights: snapshot.nights,
    distanceFromOriginKm: snapshot.distanceFromAnkaraKm,
    price: Money.fromLira(snapshot.pricePerPersonTry),
    singleSupplement:
      snapshot.singleSupplementTry === undefined
        ? null
        : Money.fromLira(snapshot.singleSupplementTry),
    included: snapshot.included,
    excluded: snapshot.excluded,
    hotels: snapshot.hotels,
    days: snapshot.days.map((day, index) => ({
      number: index + 1,
      title: day.title,
      summary: day.summary,
      stops: day.stops.map((stop) => ({
        id: stop.id,
        name: stop.name,
        kind: stop.kind,
        location: new GeoPoint(stop.lat, stop.lon),
        summary: stop.summary,
        scene: stop.scene,
        facts: stop.facts ?? [],
        ...(stop.durationMinutes === undefined ? {} : { durationMinutes: stop.durationMinutes }),
      })),
    })),
    departures: snapshot.departures.map(
      (departure) =>
        new Departure({
          id: departure.id,
          tourId: snapshot.id,
          startDate: departure.startDate,
          endDate: departure.endDate,
          time: departure.time,
          meetingPoint: departure.meetingPoint,
          layout,
          bookedSeats: departure.bookedSeats,
        }),
    ),
  });
}
