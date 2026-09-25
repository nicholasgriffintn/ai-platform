import { getErrorMessage, inflateRaw } from "@ngriffin_uk/polychat-utility-core";

import { parseGgufHeader, GGUF_INSPECTION_BYTES } from "./gguf.js";
import { scanPickle, type PickleScanResult } from "./pickle.js";
import {
  parseSafetensorsHeader,
  readSafetensorsHeaderLength,
  SAFETENSORS_LENGTH_PREFIX_BYTES,
} from "./safetensors.js";
import {
  findPickleEntries,
  isZipPrefix,
  locateZipDirectory,
  parseZipDirectory,
  readLocalHeaderLength,
  ZIP_LOCAL_HEADER_BYTES,
  ZIP_TAIL_BYTES,
} from "./zip.js";

export type RangeReader = (start: number, end: number) => Promise<Uint8Array>;

export interface InspectableFile {
  path: string;
  size: number;
  read: RangeReader;
}

export const PICKLE_SAMPLE_BYTES = 32 * 1024 * 1024;
const MAX_ZIP_PICKLE_ENTRIES = 3;
const LEGACY_TORCH_PICKLES = 4;
const LOCAL_HEADER_READ_BYTES = ZIP_LOCAL_HEADER_BYTES + 1024;

export interface PickleStreamScan {
  label: string;
  result: PickleScanResult;
}

export async function scanPickleFile(file: InspectableFile): Promise<PickleStreamScan[]> {
  const read = (start: number, end: number) => file.read(start, Math.min(end, file.size));

  if (!isZipPrefix(await read(0, 4))) {
    return [
      {
        label: file.path,
        result: scanPickle(await read(0, PICKLE_SAMPLE_BYTES), {
          maxPickles: LEGACY_TORCH_PICKLES,
        }),
      },
    ];
  }

  const tailStart = Math.max(0, file.size - ZIP_TAIL_BYTES);
  const tail = await read(tailStart, file.size);
  const location = locateZipDirectory(tail, file.size);
  const directory =
    location.offset >= tailStart
      ? tail.subarray(location.offset - tailStart, location.offset - tailStart + location.size)
      : await read(location.offset, location.offset + location.size);
  const entries = findPickleEntries(parseZipDirectory(directory, location.entryCount)).slice(
    0,
    MAX_ZIP_PICKLE_ENTRIES,
  );
  const scans: PickleStreamScan[] = [];

  for (const entry of entries) {
    const header = await read(
      entry.localHeaderOffset,
      entry.localHeaderOffset + LOCAL_HEADER_READ_BYTES,
    );
    const start = entry.localHeaderOffset + readLocalHeaderLength(header);
    const stored = await read(start, start + Math.min(entry.compressedSize, PICKLE_SAMPLE_BYTES));
    const bytes =
      entry.method === 8
        ? await inflateRaw(stored, PICKLE_SAMPLE_BYTES)
        : entry.method === 0
          ? stored
          : null;

    if (bytes) {
      scans.push({ label: `${file.path}:${entry.name}`, result: scanPickle(bytes) });
    }
  }

  return scans;
}

export interface SafetensorsCheck {
  checked: number;
  issues: string[];
  parameterCount: number | null;
}

export async function checkSafetensorsHeaders(
  shards: readonly InspectableFile[],
  limit: number,
): Promise<SafetensorsCheck> {
  const checked = shards.slice(0, limit);
  const issues: string[] = [];
  let parameterCount = 0;

  for (const file of checked) {
    try {
      const headerLength = readSafetensorsHeaderLength(
        await file.read(0, SAFETENSORS_LENGTH_PREFIX_BYTES),
      );
      const summary = parseSafetensorsHeader(
        await file.read(
          SAFETENSORS_LENGTH_PREFIX_BYTES,
          SAFETENSORS_LENGTH_PREFIX_BYTES + headerLength,
        ),
        file.size,
      );

      parameterCount += summary.parameterCount;
      issues.push(...summary.issues.map((issue) => `${file.path}: ${issue}`));
    } catch (error) {
      issues.push(`${file.path}: ${getErrorMessage(error, "Unreadable header")}`);
    }
  }

  return {
    checked: checked.length,
    issues,
    parameterCount: checked.length > 0 && checked.length === shards.length ? parameterCount : null,
  };
}

export async function readGgufChatTemplate(file: InspectableFile): Promise<string | null> {
  const template = parseGgufHeader(await file.read(0, GGUF_INSPECTION_BYTES)).metadata[
    "tokenizer.chat_template"
  ];

  return typeof template === "string" ? template : null;
}
