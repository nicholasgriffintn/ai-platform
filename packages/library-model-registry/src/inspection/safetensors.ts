import { ByteCursor, isRecord } from "@ngriffin_uk/polychat-utility-core";

import { ModelRegistryError } from "../errors.js";

export const SAFETENSORS_LENGTH_PREFIX_BYTES = 8;
export const SAFETENSORS_MAX_HEADER_BYTES = 100 * 1024 * 1024;

const DTYPE_BYTES: Record<string, number> = {
  BOOL: 1,
  U8: 1,
  I8: 1,
  F8_E5M2: 1,
  F8_E4M3: 1,
  U16: 2,
  I16: 2,
  F16: 2,
  BF16: 2,
  U32: 4,
  I32: 4,
  F32: 4,
  U64: 8,
  I64: 8,
  F64: 8,
};

export interface SafetensorsHeaderSummary {
  tensorCount: number;
  parameterCount: number;
  dtypes: Record<string, number>;
  metadata: Record<string, string>;
  issues: string[];
}

export function readSafetensorsHeaderLength(prefix: Uint8Array): number {
  if (prefix.byteLength < SAFETENSORS_LENGTH_PREFIX_BYTES) {
    throw new ModelRegistryError("truncated_input", "Safetensors prefix needs 8 bytes");
  }

  const length = new ByteCursor(prefix).u64();

  if (length === 0 || length > SAFETENSORS_MAX_HEADER_BYTES) {
    throw new ModelRegistryError(
      "malformed_file",
      `Safetensors header length ${length} is invalid`,
    );
  }

  return length;
}

export function parseSafetensorsHeader(
  header: Uint8Array,
  fileSize?: number,
): SafetensorsHeaderSummary {
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(header));
  } catch {
    throw new ModelRegistryError("malformed_file", "Safetensors header is not valid UTF-8 JSON");
  }

  if (!isRecord(parsed)) {
    throw new ModelRegistryError("malformed_file", "Safetensors header must be a JSON object");
  }

  const issues: string[] = [];
  const dtypes: Record<string, number> = {};
  const ranges: Array<[number, number]> = [];
  const metadata: Record<string, string> = {};
  let parameterCount = 0;
  let tensorCount = 0;

  for (const [name, entry] of Object.entries(parsed)) {
    if (name === "__metadata__") {
      if (isRecord(entry)) {
        for (const [key, value] of Object.entries(entry)) {
          if (typeof value === "string") {
            metadata[key] = value;
          } else {
            issues.push(`Metadata value for ${key} is not a string`);
          }
        }
      }

      continue;
    }

    if (!isRecord(entry) || typeof entry.dtype !== "string" || !Array.isArray(entry.shape)) {
      issues.push(`Tensor ${name} has no dtype or shape`);
      continue;
    }

    const shape = entry.shape;

    if (!shape.every((dimension) => Number.isInteger(dimension) && dimension >= 0)) {
      issues.push(`Tensor ${name} has a non-integer shape`);
      continue;
    }

    const elements = shape.reduce<number>((product, dimension) => product * dimension, 1);
    const offsets = entry.data_offsets;

    tensorCount += 1;
    parameterCount += elements;
    dtypes[entry.dtype] = (dtypes[entry.dtype] ?? 0) + 1;

    if (
      !Array.isArray(offsets) ||
      offsets.length !== 2 ||
      !Number.isInteger(offsets[0]) ||
      !Number.isInteger(offsets[1]) ||
      offsets[1] < offsets[0]
    ) {
      issues.push(`Tensor ${name} has invalid data offsets`);
      continue;
    }

    const byteWidth = DTYPE_BYTES[entry.dtype];

    if (byteWidth === undefined) {
      issues.push(`Tensor ${name} uses unknown dtype ${entry.dtype}`);
    } else if (offsets[1] - offsets[0] !== elements * byteWidth) {
      issues.push(`Tensor ${name} byte range does not match its shape`);
    }

    ranges.push([offsets[0], offsets[1]]);
  }

  ranges.sort((a, b) => a[0] - b[0]);

  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index][0] < ranges[index - 1][1]) {
      issues.push("Tensor byte ranges overlap");
      break;
    }
  }

  if (fileSize !== undefined && ranges.length > 0) {
    const dataBytes = fileSize - SAFETENSORS_LENGTH_PREFIX_BYTES - header.byteLength;
    const end = ranges[ranges.length - 1][1];

    if (end > dataBytes) {
      issues.push("Tensor data runs past the end of the file");
    } else if (end < dataBytes) {
      issues.push(`${dataBytes - end} trailing bytes follow the tensor data`);
    }
  }

  return { tensorCount, parameterCount, dtypes, metadata, issues };
}
