export class CsvRecordParser {
  private field = "";
  private record: string[] = [];
  private quoted = false;
  private pendingQuote = false;

  push(chunk: string): string[][] {
    const records: string[][] = [];

    for (const char of chunk) {
      if (this.quoted) {
        if (this.pendingQuote) {
          this.pendingQuote = false;

          if (char === '"') {
            this.field += '"';
            continue;
          }

          this.quoted = false;
        } else if (char === '"') {
          this.pendingQuote = true;
          continue;
        } else {
          this.field += char;
          continue;
        }
      }

      if (char === '"' && this.field === "") {
        this.quoted = true;
      } else if (char === ",") {
        this.record.push(this.field);
        this.field = "";
      } else if (char === "\n") {
        this.record.push(this.field.replace(/\r$/, ""));
        records.push(this.record);
        this.record = [];
        this.field = "";
      } else {
        this.field += char;
      }
    }

    return records;
  }

  finish(): string[][] {
    if (this.pendingQuote) {
      this.pendingQuote = false;
      this.quoted = false;
    }

    if (this.field === "" && this.record.length === 0) {
      return [];
    }

    this.record.push(this.field.replace(/\r$/, ""));

    const records = [this.record];

    this.record = [];
    this.field = "";

    return records;
  }
}

export function csvRecordsToObjects(header: readonly string[], records: readonly string[][]) {
  return records
    .filter((record) => record.some((value) => value !== ""))
    .map((record) => Object.fromEntries(header.map((name, index) => [name, record[index] ?? ""])));
}
