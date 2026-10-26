import { READING_FORMS, type SourceReading } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { highlightSegments, readRows, readTotal } from "../reading.js";

const receipt = READING_FORMS.receipt;

describe("highlightSegments", () => {
  it("merges overlapping spans and ignores ones outside the text", () => {
    expect(
      highlightSegments("Order A-88412 arrived", [
        [6, 10],
        [8, 13],
        [40, 50],
      ]),
    ).toEqual([
      { start: 0, text: "Order ", marked: false },
      { start: 6, text: "A-88412", marked: true },
      { start: 13, text: " arrived", marked: false },
    ]);
  });
});

describe("readRows", () => {
  it("flags shaky figures and missing values the model is unsure are missing", () => {
    const read: SourceReading["answers"] = {
      total: { type: "number", value: 15.9, guess: 15.9, p_null: 0, confidence: 0.7 },
      tip: { type: "number", value: null, guess: 2.39, p_null: 0.6, confidence: 0.4 },
      discount: { type: "number", value: null, guess: 0, p_null: 0.999, confidence: 0.9 },
    };
    const rows = Object.fromEntries(readRows(receipt, read).map((row) => [row.name, row]));

    expect(rows.total).toMatchObject({ value: "15.90", needsLook: true });
    expect(rows.tip).toMatchObject({
      value: "Not on it",
      detail: "Best guess 2.39",
      needsLook: true,
    });
    expect(rows.discount).toMatchObject({ found: false, needsLook: false });
    expect(rows.merchant).toMatchObject({ value: "Not read", needsLook: true });
    expect(readTotal(receipt, read)).toBe(15.9);
  });
});
