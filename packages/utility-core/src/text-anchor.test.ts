import { describe, expect, it } from "vitest";

import { createTextAnchor, locateTextAnchor } from "./text-anchor.js";

describe("passage anchors", () => {
  it("locates the chosen occurrence after text before it moves", () => {
    const original = "First: useful passage. Second: useful passage.";
    const start = original.lastIndexOf("useful passage");
    const anchor = createTextAnchor(original, start, start + "useful passage".length);
    const revised = `New introduction. ${original}`;

    expect(locateTextAnchor(revised, anchor)).toEqual({
      status: "located",
      start: revised.lastIndexOf(anchor.quote),
      end: revised.lastIndexOf(anchor.quote) + anchor.quote.length,
    });
  });

  it("requires reselection when repeated passages have equally matching context", () => {
    const repeated = `${"a".repeat(64)}passage${"b".repeat(64)}`;
    const document = `${repeated}\n${repeated}`;
    const anchor = createTextAnchor(document, 64, 71);

    expect(locateTextAnchor(document, anchor)).toEqual({ status: "ambiguous" });
    expect(
      locateTextAnchor("passage and passage", { quote: "passage", prefix: "", suffix: "" }),
    ).toEqual({ status: "ambiguous" });
  });

  it("reports a deleted selection and refuses a range outside the source", () => {
    expect(locateTextAnchor("new text", { quote: "old text", prefix: "", suffix: "" })).toEqual({
      status: "missing",
    });
    expect(() => createTextAnchor("source", 3, 8)).toThrow(RangeError);
    expect(() => createTextAnchor("source", 3, 3)).toThrow(RangeError);
  });
});
