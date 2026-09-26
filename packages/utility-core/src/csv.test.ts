import { describe, expect, it } from "vitest";

import { CsvRecordParser, csvRecordsToObjects } from "./csv.js";

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
