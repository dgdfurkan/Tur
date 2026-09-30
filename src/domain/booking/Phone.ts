/** A Turkish phone number, stored as its ten national digits. */
export class Phone {
  private constructor(readonly digits: string) {}

  /**
   * Accepts the forms people actually type ("0532 000 00 00", "+90 532…",
   * "5320000000") and returns `null` for anything that is not a ten-digit
   * national number.
   */
  static parse(input: string): Phone | null {
    let digits = input.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    // Area and operator codes run from 2xx to 5xx.
    return /^[2-5]\d{9}$/.test(digits) ? new Phone(digits) : null;
  }

  /** "0 (532) 000 00 00" */
  format(): string {
    const d = this.digits;
    return `0 (${d.slice(0, 3)}) ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
  }
}
