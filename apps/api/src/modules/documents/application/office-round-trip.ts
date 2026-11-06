import type {
  DeckOutputContent,
  RunVerificationFinding,
  SheetOutputContent,
} from "@ngriffin_uk/polychat-schemas";
import {
  DECK_OUTPUT_KIND,
  DOCUMENT_OUTPUT_KIND,
  SHEET_OUTPUT_KIND,
} from "@ngriffin_uk/polychat-schemas";
import { parseCsv } from "@ngriffin_uk/polychat-utility-core";
import { unzipSync } from "fflate";

import { exportWorkOutput, sheetExportRows } from "./work-output-exports";
import type { ReadableWorkOutput } from "./work-outputs";

export const MAX_OFFICE_PACKAGE_BYTES = 25 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 64 * 1024 * 1024;
const CONTENT_TYPES_PART = "[Content_Types].xml";
const RELATIONSHIPS_PART = "_rels/.rels";
const XML_ROOT = /<([A-Za-z_][\w:.-]*)[\s/>]/;

export type RoundTripResult = Pick<RunVerificationFinding, "status" | "detail">;

interface OfficeFormat {
  label: string;
  mainPart: string;
  contentPart: RegExp;
  text: RegExp;
}

const OFFICE_FORMATS: Record<string, OfficeFormat> = {
  docx: {
    label: "Word document",
    mainPart: "word/document.xml",
    contentPart: /^word\/document\.xml$/,
    text: /<w:t(?:\s[^>]*)?>\s*[^<\s]/,
  },
  xlsx: {
    label: "Excel workbook",
    mainPart: "xl/workbook.xml",
    contentPart: /^xl\/(?:worksheets\/[^/]+\.xml|sharedStrings\.xml)$/,
    text: /<(?:\w+:)?[vt](?:\s[^>]*)?>\s*[^<\s]/,
  },
  pptx: {
    label: "PowerPoint deck",
    mainPart: "ppt/presentation.xml",
    contentPart: /^ppt\/slides\/[^/]+\.xml$/,
    text: /<a:t(?:\s[^>]*)?>\s*[^<\s]/,
  },
};

const OFFICE_EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export function officeFormatFor(file: {
  mimeType?: string | null;
  filename?: string | null;
}): string | null {
  const extension = file.filename?.split(".").pop()?.toLowerCase();

  return (
    OFFICE_EXTENSIONS_BY_MIME_TYPE[file.mimeType ?? ""] ??
    (extension && extension in OFFICE_FORMATS ? extension : null)
  );
}

function passed(detail: string): RoundTripResult {
  return { status: "verified", detail };
}

function failed(detail: string): RoundTripResult {
  return { status: "failed", detail };
}

export function officeFileTooLarge(label = "file"): RoundTripResult {
  return { status: "unverified", detail: `This ${label} is too large to reopen and check.` };
}

function closesRootElement(xml: string): boolean {
  const root = xml.match(XML_ROOT)?.[1];

  return Boolean(root) && xml.trimEnd().endsWith(`</${root}>`);
}

export function checkOfficePackage(bytes: Uint8Array, formatId: string): RoundTripResult {
  const format = OFFICE_FORMATS[formatId];

  if (!format) {
    return { status: "unverified", detail: "This file type cannot be reopened and checked." };
  }

  let unpackedBytes = 0;
  let parts: Record<string, Uint8Array>;

  try {
    parts = unzipSync(bytes, {
      filter: (file) => {
        const wanted =
          file.name === CONTENT_TYPES_PART ||
          file.name === RELATIONSHIPS_PART ||
          file.name === format.mainPart ||
          format.contentPart.test(file.name);

        unpackedBytes += wanted ? file.originalSize : 0;

        return wanted && unpackedBytes <= MAX_UNPACKED_BYTES;
      },
    });
  } catch {
    return failed(`This ${format.label} could not be reopened: the package is corrupt.`);
  }

  if (unpackedBytes > MAX_UNPACKED_BYTES) {
    return officeFileTooLarge(format.label);
  }

  const decoder = new TextDecoder();
  const read = (name: string) => (parts[name] ? decoder.decode(parts[name]) : null);
  const contentTypes = read(CONTENT_TYPES_PART);
  const mainPart = read(format.mainPart);

  if (!contentTypes || !read(RELATIONSHIPS_PART) || !mainPart) {
    return failed(`This ${format.label} is missing parts it needs to open.`);
  }

  if (!contentTypes.includes(`/${format.mainPart}`) || !closesRootElement(mainPart)) {
    return failed(`This ${format.label} is damaged and may not open.`);
  }

  const hasText = Object.keys(parts).some(
    (name) => format.contentPart.test(name) && format.text.test(read(name) ?? ""),
  );

  return hasText
    ? passed(`The ${format.label} reopened with its content intact.`)
    : failed(`This ${format.label} opens but has no content.`);
}

function populatedRows(rows: readonly (readonly string[])[]): string[] {
  return rows.filter((row) => row.some((cell) => cell !== "")).map((row) => JSON.stringify(row));
}

function checkSheet(content: SheetOutputContent, body: string): RoundTripResult {
  const expected = populatedRows(sheetExportRows(content));
  const reopened = populatedRows(parseCsv(body));

  if (expected.length === 0) {
    return failed("This sheet has no content.");
  }

  return expected.length === reopened.length &&
    expected.every((row, index) => row === reopened[index])
    ? passed("The sheet reopened with every cell intact.")
    : failed("This sheet lost cells when it was exported and reopened.");
}

function checkDeck(content: DeckOutputContent, body: string): RoundTripResult {
  if (content.slides.length === 0) {
    return failed("This deck has no slides.");
  }

  let cursor = 0;

  for (const slide of content.slides) {
    for (const text of [slide.title, ...slide.bullets]) {
      const found = body.indexOf(text, cursor);

      if (found < 0) {
        return failed(`This deck lost "${slide.title}" when it was exported and reopened.`);
      }

      cursor = found + text.length;
    }
  }

  return passed("The deck reopened with every slide in order.");
}

export function checkWorkOutputRoundTrip(file: ReadableWorkOutput): RoundTripResult {
  const { body } = exportWorkOutput(file);

  switch (file.kind) {
    case SHEET_OUTPUT_KIND:
      return checkSheet(file.content, body);
    case DECK_OUTPUT_KIND:
      return checkDeck(file.content, body);
    case DOCUMENT_OUTPUT_KIND:
      return body.trim()
        ? passed("The document reopened with its text intact.")
        : failed("This document has no content.");
  }
}
