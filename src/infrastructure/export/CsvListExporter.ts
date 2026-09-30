import type { ListExporter, ListTable } from './ListExporter';

/** Excel only recognises UTF-8, and therefore Turkish letters, when the file starts with this mark. */
const BYTE_ORDER_MARK = '﻿';
/** Turkish regional settings use the comma as decimal mark, so lists are separated by semicolons. */
const SEPARATOR = ';';
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * CSV that opens correctly in Excel with Turkish regional settings. Cells that
 * a spreadsheet would run as a formula are neutralised, since names and notes
 * are typed in by hand.
 */
export class CsvListExporter implements ListExporter {
  readonly mimeType = 'text/csv;charset=utf-8';
  readonly extension = 'csv';

  export(table: ListTable): string {
    const lines = [table.columns, ...table.rows].map((row) =>
      row.map((cell) => CsvListExporter.escape(cell)).join(SEPARATOR),
    );
    return BYTE_ORDER_MARK + lines.join('\r\n') + '\r\n';
  }

  private static escape(cell: string): string {
    const safe = FORMULA_START.test(cell) ? `'${cell}` : cell;
    return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  }
}
