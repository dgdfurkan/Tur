import { describe, expect, it } from 'vitest';
import {
  instagramHref,
  instagramName,
  mailHref,
  telHref,
  whatsappHref,
  whatsappNumber,
} from '@/shared/contactLinks';

describe('contact links', () => {
  it('turns a phone number written any usual way into a call link', () => {
    expect(telHref('0312 000 00 00')).toBe('tel:03120000000');
    expect(telHref('+90 (532) 000 00 00')).toBe('tel:+905320000000');
    expect(telHref('12')).toBeNull();
  });

  it('writes Turkish numbers in the international form WhatsApp expects', () => {
    expect(whatsappNumber('0532 000 00 00')).toBe('905320000000');
    expect(whatsappNumber('532 000 00 00')).toBe('905320000000');
    expect(whatsappNumber('+90 532 000 00 00')).toBe('905320000000');
    expect(whatsappNumber('0090 532 000 00 00')).toBe('905320000000');
    expect(whatsappNumber('0532')).toBeNull();
  });

  it('opens a WhatsApp chat with the first message written', () => {
    expect(whatsappHref('0532 000 00 00', 'Merhaba, bilgi almak istiyorum.')).toBe(
      'https://wa.me/905320000000?text=Merhaba%2C%20bilgi%20almak%20istiyorum.',
    );
  });

  it('accepts only an e-mail address as an e-mail link', () => {
    expect(mailHref('ofis@ornek.com.tr')).toBe('mailto:ofis@ornek.com.tr');
    expect(mailHref('ofis@ornek.com', 'Kapadokya')).toBe('mailto:ofis@ornek.com?subject=Kapadokya');
    expect(mailHref('javascript:alert(1)')).toBeNull();
    expect(mailHref('ofis@ornek')).toBeNull();
  });

  it('accepts only an Instagram handle as an Instagram link', () => {
    expect(instagramHref('@ajans.adi')).toBe('https://www.instagram.com/ajans.adi/');
    expect(instagramName('ajans.adi')).toBe('@ajans.adi');
    expect(instagramHref('https://evil.example')).toBeNull();
  });
});
