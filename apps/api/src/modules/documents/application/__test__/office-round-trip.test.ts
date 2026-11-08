import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { checkOfficePackage } from "../office-round-trip";

const CONTENT_TYPES = `<Types><Override PartName="/word/document.xml"/></Types>`;

describe("checkOfficePackage", () => {
  it("fails bytes that are not a package at all", () => {
    expect(checkOfficePackage(strToU8("this is not a zip file"), "docx").status).toBe("failed");
  });

  it("fails a package that is missing the part a reader opens first", () => {
    const deck = zipSync({ "[Content_Types].xml": strToU8(CONTENT_TYPES) });

    expect(checkOfficePackage(deck, "pptx").status).toBe("failed");
  });
});
