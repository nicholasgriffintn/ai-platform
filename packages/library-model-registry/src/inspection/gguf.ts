import { ByteCursor, ByteCursorOverflowError } from "@ngriffin_uk/polychat-utility-core";

import { ModelRegistryError } from "../errors.js";

export const GGUF_INSPECTION_BYTES = 16 * 1024 * 1024;

const GGUF_MAGIC = 0x46554747;
const MAX_STRING_BYTES = 256 * 1024;

type GgufScalar = string | number | boolean;

export interface GgufHeaderSummary {
  version: number;
  tensorCount: number;
  metadata: Record<string, GgufScalar>;
  arrayLengths: Record<string, number>;
  truncated: boolean;
}

enum GgufValueType {
  Uint8 = 0,
  Int8 = 1,
  Uint16 = 2,
  Int16 = 3,
  Uint32 = 4,
  Int32 = 5,
  Float32 = 6,
  Bool = 7,
  String = 8,
  Array = 9,
  Uint64 = 10,
  Int64 = 11,
  Float64 = 12,
}

const SCALAR_BYTES: Partial<Record<GgufValueType, number>> = {
  [GgufValueType.Uint8]: 1,
  [GgufValueType.Int8]: 1,
  [GgufValueType.Bool]: 1,
  [GgufValueType.Uint16]: 2,
  [GgufValueType.Int16]: 2,
  [GgufValueType.Uint32]: 4,
  [GgufValueType.Int32]: 4,
  [GgufValueType.Float32]: 4,
  [GgufValueType.Uint64]: 8,
  [GgufValueType.Int64]: 8,
  [GgufValueType.Float64]: 8,
};

export function parseGgufHeader(bytes: Uint8Array): GgufHeaderSummary {
  const cursor = new ByteCursor(bytes);

  if (bytes.byteLength < 24 || cursor.u32() !== GGUF_MAGIC) {
    throw new ModelRegistryError("malformed_file", "File does not start with the GGUF magic");
  }

  const version = cursor.u32();

  if (version < 2) {
    throw new ModelRegistryError("unsupported_format", `GGUF version ${version} is not supported`);
  }

  const tensorCount = cursor.u64();
  const keyCount = cursor.u64();
  const metadata: Record<string, GgufScalar> = {};
  const arrayLengths: Record<string, number> = {};

  try {
    for (let index = 0; index < keyCount; index += 1) {
      const key = readString(cursor);
      const type: GgufValueType = cursor.u32();

      if (type === GgufValueType.Array) {
        const itemType: GgufValueType = cursor.u32();
        const length = cursor.u64();

        arrayLengths[key] = length;
        skipArray(cursor, itemType, length);
        continue;
      }

      metadata[key] = readScalar(cursor, type);
    }
  } catch (error) {
    if (error instanceof ByteCursorOverflowError) {
      return { version, tensorCount, metadata, arrayLengths, truncated: true };
    }

    throw error;
  }

  return { version, tensorCount, metadata, arrayLengths, truncated: false };
}

function readString(cursor: ByteCursor): string {
  const length = cursor.u64();

  if (length > MAX_STRING_BYTES) {
    cursor.skip(length);

    return "";
  }

  return cursor.text(length);
}

function readScalar(cursor: ByteCursor, type: GgufValueType): GgufScalar {
  switch (type) {
    case GgufValueType.String:
      return readString(cursor);
    case GgufValueType.Bool:
      return cursor.u8() !== 0;
    case GgufValueType.Uint8:
    case GgufValueType.Int8:
      return cursor.u8();
    case GgufValueType.Uint16:
    case GgufValueType.Int16:
      return cursor.u16();
    case GgufValueType.Uint32:
      return cursor.u32();
    case GgufValueType.Int32:
      return cursor.i32();
    case GgufValueType.Uint64:
    case GgufValueType.Int64:
      return cursor.u64();
    case GgufValueType.Float32: {
      const bytes = cursor.bytesOf(4);

      return new DataView(bytes.buffer, bytes.byteOffset, 4).getFloat32(0, true);
    }

    case GgufValueType.Float64: {
      const bytes = cursor.bytesOf(8);

      return new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, true);
    }

    default:
      throw new ModelRegistryError("malformed_file", `Unknown GGUF value type ${type}`);
  }
}

function skipArray(cursor: ByteCursor, itemType: GgufValueType, length: number): void {
  const width = SCALAR_BYTES[itemType];

  if (width !== undefined) {
    cursor.skip(width * length);

    return;
  }

  for (let index = 0; index < length; index += 1) {
    if (itemType === GgufValueType.String) {
      cursor.skip(cursor.u64());
    } else if (itemType === GgufValueType.Array) {
      skipArray(cursor, cursor.u32(), cursor.u64());
    } else {
      throw new ModelRegistryError("malformed_file", `Unknown GGUF array type ${itemType}`);
    }
  }
}
