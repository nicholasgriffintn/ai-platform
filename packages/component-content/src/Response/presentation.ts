import { hasUrlExtension, isRecord, readOptionalString } from "@ngriffin_uk/polychat-utility-core";

import {
  resolveGeneratedAudioResponseData,
  resolveGeneratedImageResponseData,
  type GeneratedAudioResponseData,
  type GeneratedImageResponseData,
  type ResponseDisplayField,
} from "./response-data";

export interface SourceRecord {
  url: string;
  title?: string;
  snippet?: string;
}

export interface DefinitionEntry {
  key: string;
  label: string;
  value: string;
}

export type ResponsePresentation =
  | { kind: "image"; data: GeneratedImageResponseData }
  | { kind: "audio"; data: GeneratedAudioResponseData }
  | { kind: "video"; url: string; title: string; content: string }
  | { kind: "sources"; sources: SourceRecord[] }
  | { kind: "table"; headers: ResponseDisplayField[]; rows: Record<string, unknown>[] }
  | { kind: "markdown"; content: string }
  | { kind: "definitions"; entries: DefinitionEntry[] }
  | { kind: "json"; data: unknown };

const MAX_INFERRED_TABLE_COLUMNS = 8;
const MIN_INFERRED_TABLE_ROWS = 2;

const PRESENTATION_KEYS = new Set([
  "formattedName",
  "icon",
  "modelContext",
  "name",
  "renderer",
  "responseDisplay",
  "responseType",
]);

export function stripPresentationMetadata(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  const entries = Object.entries(payload).filter(([key]) => !PRESENTATION_KEYS.has(key));

  if (entries.length === Object.keys(payload).length) {
    return payload;
  }

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov", "m4v", "ogv"]);

export function resolveResponsePresentation(
  payload: unknown,
  options?: { content?: string; fields?: ResponseDisplayField[] },
): ResponsePresentation {
  const image = resolveGeneratedImageResponseData(payload);

  if (image) {
    return { kind: "image", data: image };
  }

  const audio = resolveGeneratedAudioResponseData(payload);

  if (audio) {
    return { kind: "audio", data: audio };
  }

  const video = resolveVideoPresentation(payload);

  if (video) {
    return video;
  }

  const records = resolveRecordArray(payload);

  if (records) {
    const sources = resolveSources(records);

    if (sources) {
      return { kind: "sources", sources };
    }

    const table = resolveTable(records, options?.fields);

    if (table) {
      return table;
    }
  }

  const prose = resolveProse(payload, options?.content);

  if (prose !== undefined) {
    return { kind: "markdown", content: prose };
  }

  const definitions = resolveDefinitions(payload);

  if (definitions) {
    return { kind: "definitions", entries: definitions };
  }

  return { kind: "json", data: payload };
}

function resolveVideoPresentation(payload: unknown): ResponsePresentation | null {
  if (!isRecord(payload)) {
    return null;
  }

  const nested = isRecord(payload.data) ? payload.data : payload;
  const url =
    readOptionalString(nested.videoUrl) ??
    readOptionalString(nested.video_url) ??
    resolveAttachmentUrl(nested.attachments, "video") ??
    resolveDirectVideoUrl(nested.url);

  if (!url) {
    return null;
  }

  return {
    kind: "video",
    url,
    title: "Generated Video",
    content: readOptionalString(payload.content) ?? "",
  };
}

function resolveDirectVideoUrl(url: unknown): string | undefined {
  const value = readOptionalString(url);

  if (!value) {
    return undefined;
  }

  return hasUrlExtension(value, VIDEO_EXTENSIONS) ? value : undefined;
}

function resolveAttachmentUrl(attachments: unknown, type: string): string | undefined {
  if (!Array.isArray(attachments)) {
    return undefined;
  }

  for (const attachment of attachments) {
    if (!isRecord(attachment)) {
      continue;
    }

    const url = readOptionalString(attachment.url);

    if (url && readOptionalString(attachment.type) === type) {
      return url;
    }
  }

  return undefined;
}

function resolveRecordArray(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) {
    const records = payload.filter(isRecord);

    return records.length === payload.length && records.length > 0 ? records : null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const arrayEntries = Object.values(payload).filter(Array.isArray);

  if (arrayEntries.length !== 1) {
    return null;
  }

  const [candidate] = arrayEntries;
  const records = candidate.filter(isRecord);

  return records.length === candidate.length && records.length > 0 ? records : null;
}

function resolveSources(records: Record<string, unknown>[]): SourceRecord[] | null {
  const sources: SourceRecord[] = [];

  for (const record of records) {
    const url =
      readOptionalString(record.url) ??
      readOptionalString(record.link) ??
      readOptionalString(record.uri) ??
      readOptionalString(record.href);

    if (!url || !/^https?:\/\//i.test(url)) {
      return null;
    }

    const title =
      readOptionalString(record.title) ??
      readOptionalString(record.name) ??
      readOptionalString(record.heading);
    const snippet =
      readOptionalString(record.snippet) ??
      readOptionalString(record.description) ??
      readOptionalString(record.summary) ??
      readOptionalString(record.content);

    sources.push({ url, title, snippet });
  }

  return sources.length > 0 ? sources : null;
}

function resolveTable(
  records: Record<string, unknown>[],
  fields?: ResponseDisplayField[],
): ResponsePresentation | null {
  if (fields && fields.length > 0) {
    return { kind: "table", headers: fields, rows: records };
  }

  if (records.length < MIN_INFERRED_TABLE_ROWS) {
    return null;
  }

  const sharedKeys = Object.keys(records[0]).filter((key) =>
    records.every((record) => key in record),
  );

  if (sharedKeys.length === 0 || sharedKeys.length > MAX_INFERRED_TABLE_COLUMNS) {
    return null;
  }

  const scalarKeys = sharedKeys.filter((key) =>
    records.every((record) => isScalar(record[key]) || record[key] == null),
  );

  if (scalarKeys.length !== sharedKeys.length) {
    return null;
  }

  return {
    kind: "table",
    headers: scalarKeys.map((key) => ({ key, label: humanise(key) })),
    rows: records,
  };
}

function resolveProse(payload: unknown, content?: string): string | undefined {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (isRecord(payload)) {
    const keys = Object.keys(payload);
    const prose =
      readOptionalString(payload.markdown) ??
      readOptionalString(payload.text) ??
      readOptionalString(payload.content) ??
      readOptionalString(payload.answer);

    if (prose && keys.length === 1) {
      return prose;
    }
  }

  if (payload == null && content && content.trim().length > 0) {
    return content;
  }

  return undefined;
}

function resolveDefinitions(payload: unknown): DefinitionEntry[] | null {
  if (!isRecord(payload)) {
    return null;
  }

  const entries = Object.entries(payload).filter(([, value]) => isScalar(value) || value == null);

  if (entries.length === 0 || entries.length !== Object.keys(payload).length) {
    return null;
  }

  return entries.map(([key, value]) => ({
    key,
    label: humanise(key),
    value: isScalar(value) ? String(value) : "—",
  }));
}

function isScalar(value: unknown): value is string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function humanise(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim();

  if (!spaced) {
    return key;
  }

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
