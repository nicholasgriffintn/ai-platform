import { describe, expect, it } from "vitest";

import { CsvRecordParser, csvRecordsToObjects, formatCsv, guardSpreadsheetFormula } from "./csv.js";

describe("CsvRecordParser", () => {
  it("handles quoted commas, escaped quotes and newlines split across chunks", () => {
    const parser = new CsvRecordParser();
    const records = [
      ...parser.push('prompt,response\r\n"Hello, there","She said ""hi""\nthen'),
      ...parser.push(' left"\nplain,row'),
      ...parser.finish(),
    ];

    expect(records).toEqual([
      ["prompt", "response"],
      ["Hello, there", 'She said "hi"\nthen left'],
      ["plain", "row"],
    ]);
    expect(csvRecordsToObjects(records[0], records.slice(1))).toEqual([
      { prompt: "Hello, there", response: 'She said "hi"\nthen left' },
      { prompt: "plain", response: "row" },
    ]);
  });
});

describe("formatCsv", () => {
  it("quotes only fields that need it and round-trips through the parser", () => {
    const rows = [
      ["merchant", "total"],
      ['Joe\'s "Fine" Fish, Chips', "12.50"],
      ["Two\nlines", "-3"],
    ];
    const csv = formatCsv(rows);
    const parser = new CsvRecordParser();

    expect(csv).toBe('merchant,total\r\n"Joe\'s ""Fine"" Fish, Chips",12.50\r\n"Two\nlines",-3');
    expect([...parser.push(csv), ...parser.finish()]).toEqual(rows);
  });
});

describe("guardSpreadsheetFormula", () => {
  it("stops text from being read as a formula but leaves signed numbers alone", () => {
    expect(guardSpreadsheetFormula('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(guardSpreadsheetFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(guardSpreadsheetFormula("-12.5")).toBe("-12.5");
    expect(guardSpreadsheetFormula("plain")).toBe("plain");
  });
});
