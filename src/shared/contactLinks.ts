/*
 * Links that reach the office. Each takes what the office typed and returns a
 * link only when the value is usable, so nothing typed can turn into another
 * kind of address.
 */

const digitsOf = (value: string): string => value.replace(/\D/g, '');

/** "tel:" link for a phone number written in any of the usual ways. */
export function telHref(phone: string): string | null {
  const digits = digitsOf(phone);
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${phone.trim().startsWith('+') ? '+' : ''}${digits}`;
}

/** The number in the international form WhatsApp expects; Turkish numbers may be written locally. */
export function whatsappNumber(phone: string): string | null {
  let digits = digitsOf(phone);
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `90${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith('5')) digits = `90${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

/** A WhatsApp chat with the office, with the first message already written when one is given. */
export function whatsappHref(phone: string, message?: string): string | null {
  const number = whatsappNumber(phone);
  if (!number) return null;
  return message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;
}

const EMAIL = /^[^\s@"'<>()]+@[^\s@"'<>()]+\.[a-z]{2,}$/i;

export function mailHref(email: string, subject?: string): string | null {
  const address = email.trim();
  if (!EMAIL.test(address) || address.length > 120) return null;
  return subject ? `mailto:${address}?subject=${encodeURIComponent(subject)}` : `mailto:${address}`;
}

const HANDLE = /^@?([A-Za-z0-9._]{1,30})$/;

export function instagramHref(handle: string): string | null {
  const match = HANDLE.exec(handle.trim());
  return match ? `https://www.instagram.com/${match[1]}/` : null;
}

/** "@ajansadi" for a handle written with or without its sign. */
export function instagramName(handle: string): string {
  const match = HANDLE.exec(handle.trim());
  return match ? `@${match[1]}` : handle;
}
