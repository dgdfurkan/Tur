import type { BookingService, PassengerDraft } from '@/application/BookingService';

type SamplePerson = Pick<
  PassengerDraft,
  'fullName' | 'phone' | 'depositLira' | 'paymentMethod' | 'note'
>;

/**
 * Invented passengers, for trying the panel out. The 0500 prefix is not
 * assigned to any operator, so none of these numbers can belong to a person.
 */
export const SAMPLE_PEOPLE: readonly SamplePerson[] = [
  {
    fullName: 'Ayşe Yılmaz',
    phone: '0500 000 00 01',
    depositLira: 500,
    paymentMethod: 'nakit',
    note: '',
  },
  {
    fullName: 'Mehmet Demir',
    phone: '0500 000 00 02',
    depositLira: 1000,
    paymentMethod: 'havale',
    note: 'Eşiyle yan yana oturacak.',
  },
  {
    fullName: 'Zeynep Kaya',
    phone: '0500 000 00 03',
    depositLira: 2000,
    paymentMethod: 'kart',
    note: '',
  },
  {
    fullName: 'Hasan Çelik',
    phone: '0500 000 00 04',
    depositLira: 500,
    paymentMethod: 'nakit',
    note: 'Ön sıralardan koltuk istedi.',
  },
  {
    fullName: 'Elif Şahin',
    phone: '0500 000 00 05',
    depositLira: 1000,
    paymentMethod: 'havale',
    note: '',
  },
  {
    fullName: 'Mustafa Öztürk',
    phone: '0500 000 00 06',
    depositLira: 0,
    paymentMethod: 'nakit',
    note: 'Kapora kalkış günü alınacak.',
  },
];

/** How many departures the sample passengers are spread over. */
const SAMPLE_DEPARTURES = 2;

/**
 * Records the sample passengers on the two nearest departures that have room
 * for them, each on the first free seat. Returns how many were recorded.
 */
export function loadSamples(bookings: BookingService, today: string): number {
  const perDeparture = Math.ceil(SAMPLE_PEOPLE.length / SAMPLE_DEPARTURES);
  const targets = bookings
    .bookings(today)
    .filter(({ departure }) => departure.occupancy.remaining >= perDeparture)
    .slice(0, SAMPLE_DEPARTURES);
  let added = 0;
  SAMPLE_PEOPLE.forEach((person, index) => {
    const target = targets[index % Math.max(1, targets.length)];
    if (!target) return;
    // Read the departure again so seats taken earlier in this loop are left alone.
    const seat = bookings.booking(target.departure.id)?.departure.freeSeats[0];
    if (seat === undefined) return;
    const result = bookings.addPassenger({
      ...person,
      departureId: target.departure.id,
      seatNumber: seat,
    });
    if (result.ok) added += 1;
  });
  return added;
}
