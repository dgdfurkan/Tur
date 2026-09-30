/** A table of text, ready to be written in some file format. */
export interface ListTable {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** Turns a table into file contents. New formats implement this; callers do not change. */
export interface ListExporter {
  readonly mimeType: string;
  readonly extension: string;
  export(table: ListTable): string;
}
