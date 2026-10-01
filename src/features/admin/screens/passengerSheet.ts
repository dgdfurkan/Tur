import type { Passenger } from '@/domain/booking/Passenger';
import { tr } from '@/i18n/tr';
import { dateOfInstant, formatDate, formatDateRange, formatMoney } from '@/shared/format';
import { href, type AppContext } from '../context';
import { el } from '../ui/dom';
import { button, group, icon, row } from '../ui/kit';
import { tap } from '../ui/motion';

/** Opens a passenger's record in a sheet, with ways to call, write, change or remove it. */
export function openPassenger(context: AppContext, passenger: Passenger): void {
  const booking = context.bookings.booking(passenger.departureId);
  const international = `90${passenger.phone.digits}`;
  const balance = context.bookings.balance(passenger);

  const remove = async (): Promise<void> => {
    await context.sheet.close();
    context.bookings.removePassenger(passenger.id);
    tap();
    context.refresh();
    context.toast.show(tr.admin.passenger.removed, {
      label: tr.admin.ui.undo,
      run: () => {
        const restored = context.bookings.restorePassenger(passenger);
        context.refresh();
        context.toast.show(
          restored ? tr.admin.passenger.restored : tr.admin.passenger.restoreFailed,
        );
      },
    });
  };

  context.sheet.open({
    title: passenger.fullName,
    body: [
      el('div', { class: 'contact-actions' }, [
        el('a', { class: 'contact-action', attrs: { href: `tel:+${international}` } }, [
          icon('phone', 22),
          el('span', { text: tr.admin.passenger.call }),
        ]),
        el(
          'a',
          {
            class: 'contact-action',
            attrs: {
              href: `https://wa.me/${international}`,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          },
          [icon('message', 22), el('span', { text: tr.admin.passenger.whatsapp })],
        ),
      ]),
      group([
        booking
          ? row({
              title: booking.tour.title,
              subtitle: formatDateRange(booking.departure.startDate, booking.departure.endDate),
              icon: { name: 'bus', tone: 'blue' },
              href: href(`/kalkis/${passenger.departureId}`),
            })
          : null,
        row({
          title: tr.admin.form.seat,
          value: String(passenger.seatNumber),
          icon: { name: 'seat', tone: 'grey' },
        }),
        row({
          title: tr.admin.form.phone,
          value: passenger.phone.format(),
          icon: { name: 'phone', tone: 'grey' },
        }),
      ]),
      group([
        row({
          title: tr.admin.passenger.deposit,
          value: `${formatMoney(passenger.deposit)}, ${tr.admin.paymentMethods[passenger.paymentMethod]}`,
          icon: { name: 'wallet', tone: 'green' },
        }),
        row({
          title: tr.admin.passenger.balance,
          value: formatMoney(balance),
          icon: { name: 'receipt', tone: balance.kurus === 0 ? 'green' : 'yellow' },
        }),
      ]),
      passenger.note === ''
        ? null
        : group([
            row({
              title: tr.admin.form.note,
              subtitle: passenger.note,
              icon: { name: 'pencil', tone: 'grey' },
            }),
          ]),
      el('p', {
        class: 'sheet__note',
        text: tr.admin.passenger.recorded(formatDate(dateOfInstant(passenger.createdAt))),
      }),
    ],
    footer: [
      button({
        label: tr.admin.ui.edit,
        icon: 'pencil',
        block: true,
        size: 'lg',
        href: href(`/yolcular/${passenger.id}`),
      }),
      button({
        label: tr.admin.passenger.remove,
        icon: 'trash',
        variant: 'danger',
        block: true,
        onClick: () => void remove(),
      }),
    ],
  });
}
