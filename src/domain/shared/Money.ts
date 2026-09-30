/** Amount in Turkish lira, stored as whole kuruş so arithmetic never drifts. */
export class Money {
  private constructor(readonly kurus: number) {}

  static fromKurus(kurus: number): Money {
    if (!Number.isInteger(kurus) || kurus < 0) {
      throw new RangeError(`Kuruş must be a non-negative integer, received ${kurus}`);
    }
    return new Money(kurus);
  }

  static fromLira(lira: number): Money {
    if (!Number.isFinite(lira) || lira < 0) {
      throw new RangeError(`Lira must be a non-negative number, received ${lira}`);
    }
    return new Money(Math.round(lira * 100));
  }

  static zero(): Money {
    return new Money(0);
  }

  get lira(): number {
    return this.kurus / 100;
  }

  add(other: Money): Money {
    return new Money(this.kurus + other.kurus);
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor) || factor < 0) {
      throw new RangeError(`Factor must be a non-negative number, received ${factor}`);
    }
    return new Money(Math.round(this.kurus * factor));
  }

  equals(other: Money): boolean {
    return this.kurus === other.kurus;
  }
}
