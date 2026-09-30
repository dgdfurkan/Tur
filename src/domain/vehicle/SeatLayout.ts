export type SeatLayoutCode = '2+1' | '2+2';

export interface Seat {
  readonly number: number;
  readonly row: number;
  /** Grid column including the aisle gap, left to right. */
  readonly column: number;
}

interface LayoutSpec {
  readonly rowCount: number;
  readonly leftColumns: readonly number[];
  readonly rightColumns: readonly number[];
  /** Row that loses its right-hand seats to the middle door. */
  readonly doorRow: number;
  readonly columnCount: number;
}

const SPECS: Record<SeatLayoutCode, LayoutSpec> = {
  '2+1': { rowCount: 14, leftColumns: [0, 1], rightColumns: [3], doorRow: 7, columnCount: 4 },
  '2+2': { rowCount: 12, leftColumns: [0, 1], rightColumns: [3, 4], doorRow: 6, columnCount: 5 },
};

/** Seating plan of a coach. Seats are numbered row by row, left to right. */
export class SeatLayout {
  private static readonly cache = new Map<SeatLayoutCode, SeatLayout>();

  readonly seats: readonly Seat[];

  private constructor(
    readonly code: SeatLayoutCode,
    private readonly spec: LayoutSpec,
  ) {
    const seats: Seat[] = [];
    for (let row = 1; row <= spec.rowCount; row += 1) {
      const columns =
        row === spec.doorRow ? spec.leftColumns : [...spec.leftColumns, ...spec.rightColumns];
      for (const column of columns) {
        seats.push({ number: seats.length + 1, row, column });
      }
    }
    this.seats = seats;
  }

  static of(code: SeatLayoutCode): SeatLayout {
    let layout = SeatLayout.cache.get(code);
    if (!layout) {
      layout = new SeatLayout(code, SPECS[code]);
      SeatLayout.cache.set(code, layout);
    }
    return layout;
  }

  get capacity(): number {
    return this.seats.length;
  }

  get rowCount(): number {
    return this.spec.rowCount;
  }

  get columnCount(): number {
    return this.spec.columnCount;
  }

  get doorRow(): number {
    return this.spec.doorRow;
  }

  hasSeat(seatNumber: number): boolean {
    return Number.isInteger(seatNumber) && seatNumber >= 1 && seatNumber <= this.capacity;
  }
}
