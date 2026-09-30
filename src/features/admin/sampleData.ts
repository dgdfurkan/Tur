import type { PassengerDraft } from '@/application/BookingService';

type SamplePerson = Pick<
  PassengerDraft,
  'fullName' | 'phone' | 'depositLira' | 'paymentMethod' | 'note'
>;

/**
 * Invented passengers for demonstrations. The 0500 prefix is not assigned to
 * any operator, so none of these numbers can belong to a real person.
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
