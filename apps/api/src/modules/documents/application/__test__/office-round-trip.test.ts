import type { Output } from "@ngriffin_uk/polychat-schemas";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import {
  checkOfficePackage,
  checkWorkOutputRoundTrip,
  officeFormatFor,
} from "../office-round-trip";

const output = { title: "Quarter" } as Output;

const CONTENT_TYPES = `<Types><Override PartName="/word/document.xml"/></Types>`;
const RELS = "<Relationships></Relationships>";

function docx(body: string, parts: Record<string, string> = {}): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries({
        "[Content_Types].xml": CONTENT_TYPES,
        "_rels/.rels": RELS,
        "word/document.xml": `<w:document><w:body>${body}</w:body></w:document>`,
        ...parts,
      }).map(([name, value]) => [name, strToU8(value)]),
    ),
  );
}

describe("checkOfficePackage", () => {
  it("passes a package that reopens with its text", () => {
    expect(checkOfficePackage(docx("<w:p><w:r><w:t>Hello</w:t></w:r></w:p>"), "docx").status).toBe(
      "verified",
    );
  });

  it("reads text from a workbook's shared strings", () => {
    const workbook = zipSync({
      "[Content_Types].xml": strToU8(`<Types><Override PartName="/xl/workbook.xml"/></Types>`),
      "_rels/.rels": strToU8(RELS),
      "xl/workbook.xml": strToU8("<workbook><sheets/></workbook>"),
      "xl/worksheets/sheet1.xml": strToU8("<worksheet><sheetData/></worksheet>"),
      "xl/sharedStrings.xml": strToU8("<sst><si><t>Revenue</t></si></sst>"),
    });

    expect(checkOfficePackage(workbook, "xlsx").status).toBe("verified");
  });

  it("fails bytes that are not a package at all", () => {
    expect(checkOfficePackage(strToU8("this is not a zip file"), "docx").status).toBe("failed");
  });

  it("fails a truncated package", () => {
    const bytes = docx("<w:t>Hello</w:t>");

    expect(checkOfficePackage(bytes.slice(0, bytes.length / 2), "docx").status).toBe("failed");
  });

  it("fails a package that is missing the part a reader opens first", () => {
    const deck = zipSync({ "[Content_Types].xml": strToU8(CONTENT_TYPES) });

    expect(checkOfficePackage(deck, "pptx").status).toBe("failed");
  });

  it("fails a file that opens but has nothing in it", () => {
    expect(checkOfficePackage(docx("<w:p><w:t>   </w:t></w:p>"), "docx").detail).toContain(
      "no content",
    );
  });

  it("fails main XML that was cut off", () => {
    const bytes = docx("", { "word/document.xml": "<w:document><w:t>Hello</w:t>" });

    expect(checkOfficePackage(bytes, "docx").status).toBe("failed");
  });

  it("leaves a format it cannot read unverified rather than failed", () => {
    expect(checkOfficePackage(new Uint8Array(), "doc").status).toBe("unverified");
  });
});

describe("officeFormatFor", () => {
  it("goes by MIME type, then file extension, and ignores other files", () => {
    expect(
      officeFormatFor({
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    ).toBe("xlsx");
    expect(officeFormatFor({ mimeType: "application/octet-stream", filename: "A.PPTX" })).toBe(
      "pptx",
    );
    expect(officeFormatFor({ mimeType: "application/pdf", filename: "a.pdf" })).toBeNull();
  });
});

describe("checkWorkOutputRoundTrip", () => {
  it("reads a sheet back cell for cell, through quotes, commas and newlines", () => {
    const result = checkWorkOutputRoundTrip({
      kind: "sheet",
      output,
      text: "",
      content: {
        format: "tables",
        tables: [
          {
            name: "Spend",
            columns: [
              { key: "item", label: "Item", type: "text" },
              { key: "cost", label: "Cost", type: "number" },
            ],
            rows: [
              { item: 'Desks, "standing"\nchairs', cost: 120.5 },
              { item: "=SUM(A1)", cost: null },
            ],
          },
        ],
      },
    });

    expect(result.status).toBe("verified");
  });

  it("fails a sheet with nothing in it", () => {
    const result = checkWorkOutputRoundTrip({
      kind: "sheet",
      output,
      text: "",
      content: { format: "tables", tables: [] },
    });

    expect(result.status).toBe("failed");
  });

  it("passes a deck whose slides come back in order, even with a rule in a body", () => {
    const result = checkWorkOutputRoundTrip({
      kind: "deck",
      output,
      text: "",
      content: {
        format: "slides",
        slides: [
          { layout: "content", title: "One", bullets: ["First"], body: "a\n\n---\n\nb" },
          { layout: "content", title: "Two", bullets: [] },
        ],
      },
    });

    expect(result.status).toBe("verified");
  });

  it("fails an empty document", () => {
    expect(checkWorkOutputRoundTrip({ kind: "document", output, text: "  \n" }).status).toBe(
      "failed",
    );
  });
});
