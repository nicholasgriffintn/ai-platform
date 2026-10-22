import {
  DECK_OUTPUT_KIND,
  DOCUMENT_OUTPUT_KIND,
  documentExportFilename,
  SHEET_OUTPUT_KIND,
  type DeckOutputContent,
  type DeckSlide,
  type SheetCell,
  type SheetOutputContent,
} from "@ngriffin_uk/polychat-schemas";
import { formatCsv, guardSpreadsheetFormula, slugify } from "@ngriffin_uk/polychat-utility-core";

import type { ReadableWorkOutput } from "./work-outputs";

const EXPORTABLE_KINDS = new Set<string>([
  DOCUMENT_OUTPUT_KIND,
  DECK_OUTPUT_KIND,
  SHEET_OUTPUT_KIND,
]);

export function isExportableWorkOutputKind(kind: string): boolean {
  return EXPORTABLE_KINDS.has(kind);
}

export interface WorkOutputExport {
  body: string;
  contentType: string;
  filename: string;
}

function exportCell(cell: SheetCell | undefined): string {
  if (cell === undefined || cell === null) {
    return "";
  }

  return typeof cell === "string" ? guardSpreadsheetFormula(cell) : String(cell);
}

export function exportSheet(title: string, content: SheetOutputContent): WorkOutputExport {
  const rows = content.tables.flatMap((table, index) => [
    ...(content.tables.length > 1 ? [...(index > 0 ? [[]] : []), [table.name]] : []),
    table.columns.map((column) => guardSpreadsheetFormula(column.label)),
    ...table.rows.map((row) => table.columns.map((column) => exportCell(row[column.key]))),
  ]);

  return {
    body: `${formatCsv(rows)}\r\n`,
    contentType: "text/csv; charset=utf-8",
    filename: `${slugify(title, 80) || "sheet"}.csv`,
  };
}

function slideMarkdown(slide: DeckSlide): string {
  const heading = slide.layout === "title" || slide.layout === "section" ? "#" : "##";
  const parts = [
    `${heading} ${slide.title}`,
    slide.subtitle ? `_${slide.subtitle}_` : "",
    slide.layout === "quote" && slide.body ? `> ${slide.body.split("\n").join("\n> ")}` : "",
    slide.bullets.map((bullet) => `- ${bullet}`).join("\n"),
    slide.layout !== "quote" && slide.body ? slide.body : "",
    slide.columns ? slide.columns.join("\n\n") : "",
    slide.notes ? `<!-- Notes: ${slide.notes.replaceAll("-->", "--&gt;")} -->` : "",
  ];

  return parts.filter(Boolean).join("\n\n");
}

export function exportDeck(title: string, content: DeckOutputContent): WorkOutputExport {
  return {
    body: `${content.slides.map(slideMarkdown).join("\n\n---\n\n")}\n`,
    contentType: "text/markdown; charset=utf-8",
    filename: `${slugify(title, 80) || "deck"}.md`,
  };
}

export function exportWorkOutput(file: ReadableWorkOutput): WorkOutputExport {
  if (file.kind === DECK_OUTPUT_KIND) {
    return exportDeck(file.output.title, file.content);
  }

  if (file.kind === SHEET_OUTPUT_KIND) {
    return exportSheet(file.output.title, file.content);
  }

  return {
    body: file.text,
    contentType: "text/markdown; charset=utf-8",
    filename: documentExportFilename(file.output.title),
  };
}
