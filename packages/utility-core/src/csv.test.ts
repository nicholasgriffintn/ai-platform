import { describe, expect, it } from "vitest";

import { CsvRecordParser, csvRecordsToObjects, formatCsv, guardSpreadsheetFormula } from "./csv.js";

describe("formatCsv", () => {
  it("quotes only fields that need it and round-trips through the parser", () => {
    const rows = [
      ["name", "note"],
      ["Ada", 'said "hi", then\nleft'],
    ];
    const csv = formatCsv(rows);
    const parser = new CsvRecordParser();

    expect(csv).toBe('name,note\r\nAda,"said ""hi"", then\nleft"');
    expect([...parser.push(csv), ...parser.finish()]).toEqual(rows);
  });

  it("stops text from being read as a spreadsheet formula", () => {
    expect(guardSpreadsheetFormula("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(guardSpreadsheetFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(guardSpreadsheetFormula("plain")).toBe("plain");
  });
});

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
