import {
  DECISION_CONFIDENCE_THRESHOLDS,
  type ExtractionAnswer,
  type ExtractionFields,
  type ExtractionRequest,
  type ExtractionResponse,
} from "@ngriffin_uk/polychat-schemas";
import { guardSpreadsheetFormula } from "@ngriffin_uk/polychat-utility-core";

import type { PaperworkField, PaperworkForm } from "./forms.js";

export type PaperworkSource = { kind: "image"; dataUrl: string } | { kind: "text"; text: string };

export interface ReadingRow {
  name: string;
  label: string;
  value: string;
  detail?: string;
  confidence: number | null;
  found: boolean;
  needsLook: boolean;
}

export interface HighlightSegment {
  start: number;
  text: string;
  marked: boolean;
}

export function buildExtractionRequest(
  form: PaperworkForm,
  source: PaperworkSource,
  referenceDate: string,
): ExtractionRequest {
  const fields: ExtractionFields = Object.fromEntries(
    form.fields.map(({ name, field }) => [name, field]),
  );

  return {
    ...(source.kind === "image" ? { images: [source.dataUrl] } : { state: source.text }),
    fields,
    reference_date: referenceDate,
    options: { return_state_text: true },
  };
}

function formatPoint(value: string | number | null | undefined, field: PaperworkField): string {
  if (value === null || value === undefined) {
    return "?";
  }

  return typeof value === "number" && field.money ? value.toFixed(2) : String(value);
}

function isShaky(confidence: number | null): boolean {
  return confidence !== null && confidence < DECISION_CONFIDENCE_THRESHOLDS.act;
}

function readRow(field: PaperworkField, answer: ExtractionAnswer | undefined): ReadingRow {
  const base = { name: field.name, label: field.label };

  if (!answer) {
    return { ...base, value: "Not read", confidence: null, found: false, needsLook: true };
  }

  if (answer.type === "list") {
    const items = answer.value ?? [];
    const confidence = answer.confidence ?? null;

    return {
      ...base,
      value: items.length > 0 ? items.join(", ") : "None",
      confidence,
      found: items.length > 0,
      needsLook: isShaky(confidence),
    };
  }

  if (answer.type === "estimate") {
    const hasRange =
      answer.p10 !== null &&
      answer.p10 !== undefined &&
      answer.p90 !== null &&
      answer.p90 !== undefined;

    return {
      ...base,
      value: formatPoint(answer.median ?? answer.value, field),
      detail: hasRange
        ? `80% between ${formatPoint(answer.p10, field)} and ${formatPoint(answer.p90, field)}`
        : undefined,
      confidence: null,
      found: answer.value !== null,
      needsLook: false,
    };
  }

  if (answer.type === "forecast") {
    const series = answer.median ?? answer.value ?? [];

    return {
      ...base,
      value: series.map((point) => formatPoint(point, field)).join(", "),
      confidence: null,
      found: series.length > 0,
      needsLook: false,
    };
  }

  const unit = answer.type === "duration" && answer.unit ? ` ${answer.unit}` : "";

  if (answer.value === null) {
    const pNull = answer.p_null ?? null;

    return {
      ...base,
      value: "Not on it",
      detail:
        answer.guess === null || answer.guess === undefined
          ? undefined
          : `Best guess ${formatPoint(answer.guess, field)}${unit}`,
      confidence: pNull === null ? null : 1 - pNull,
      found: false,
      needsLook: pNull !== null && pNull < DECISION_CONFIDENCE_THRESHOLDS.act,
    };
  }

  const confidence = answer.confidence ?? null;

  return {
    ...base,
    value: `${formatPoint(answer.value, field)}${unit}`,
    confidence,
    found: true,
    needsLook: isShaky(confidence),
  };
}

export function readRows(form: PaperworkForm, response: ExtractionResponse): ReadingRow[] {
  return form.fields.map((field) => readRow(field, response.answers[field.name]));
}

export function readTotal(form: PaperworkForm, response: ExtractionResponse): number | null {
  const answer = response.answers[form.totalField];

  return answer?.type === "number" && answer.value !== null ? answer.value : null;
}

export function readSpans(response: ExtractionResponse): [number, number][] {
  return Object.values(response.answers).flatMap((answer) => {
    if (answer.type === "text" && answer.value !== null && answer.span) {
      return [answer.span];
    }

    return answer.type === "list"
      ? (answer.spans ?? []).filter((span): span is [number, number] => span !== null)
      : [];
  });
}

export function highlightSegments(
  text: string,
  spans: readonly [number, number][],
): HighlightSegment[] {
  const merged = spans
    .map(([start, end]) => [Math.max(0, start), Math.min(text.length, end)] as const)
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0])
    .reduce<[number, number][]>((ranges, [start, end]) => {
      const last = ranges.at(-1);

      if (last && start <= last[1]) {
        last[1] = Math.max(last[1], end);
      } else {
        ranges.push([start, end]);
      }

      return ranges;
    }, []);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const [start, end] of merged) {
    if (start > cursor) {
      segments.push({ start: cursor, text: text.slice(cursor, start), marked: false });
    }

    segments.push({ start, text: text.slice(start, end), marked: true });
    cursor = end;
  }

  if (cursor < text.length) {
    segments.push({ start: cursor, text: text.slice(cursor), marked: false });
  }

  return segments;
}

export function paperworkCsvRecords(
  form: PaperworkForm,
  readings: readonly { name: string; response: ExtractionResponse }[],
): string[][] {
  return [
    ["document", ...form.fields.map((field) => field.name)],
    ...readings.map(({ name, response }) =>
      [name, ...readRows(form, response).map((row) => (row.found ? row.value : ""))].map(
        guardSpreadsheetFormula,
      ),
    ),
  ];
}
