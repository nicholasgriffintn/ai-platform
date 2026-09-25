import { ByteCursor } from "@ngriffin_uk/polychat-utility-core";

import { ModelRegistryError } from "../errors.js";

export const ZIP_TAIL_BYTES = 64 * 1024 + 22;
export const ZIP_LOCAL_HEADER_BYTES = 30;

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_END_LOCATOR = 0x07064b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY = 0x06064b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const ZIP64_MARKER = 0xffffffff;

export interface ZipDirectoryLocation {
  offset: number;
  size: number;
  entryCount: number;
}

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export function isZipPrefix(prefix: Uint8Array): boolean {
  return prefix.byteLength >= 4 && new ByteCursor(prefix).u32() === LOCAL_FILE_HEADER;
}

export function locateZipDirectory(tail: Uint8Array, fileSize: number): ZipDirectoryLocation {
  const tailStart = fileSize - tail.byteLength;

  for (let index = tail.byteLength - 22; index >= 0; index -= 1) {
    const cursor = new ByteCursor(tail, index);

    if (cursor.u32() !== END_OF_CENTRAL_DIRECTORY) {
      continue;
    }

    cursor.skip(6);
    const entryCount = cursor.u16();
    const size = cursor.u32();
    const offset = cursor.u32();

    if (offset !== ZIP64_MARKER && size !== ZIP64_MARKER && entryCount !== 0xffff) {
      return { offset, size, entryCount };
    }

    const locatorIndex = index - 20;

    if (locatorIndex < 0) {
      throw new ModelRegistryError("truncated_input", "Zip64 locator lies outside the tail");
    }

    const locator = new ByteCursor(tail, locatorIndex);

    if (locator.u32() !== ZIP64_END_LOCATOR) {
      throw new ModelRegistryError("malformed_file", "Zip64 end locator is missing");
    }

    locator.skip(4);
    const zip64RecordOffset = locator.u64() - tailStart;

    if (zip64RecordOffset < 0) {
      throw new ModelRegistryError(
        "truncated_input",
        "Zip64 directory record lies outside the tail",
      );
    }

    const record = new ByteCursor(tail, zip64RecordOffset);

    if (record.u32() !== ZIP64_END_OF_CENTRAL_DIRECTORY) {
      throw new ModelRegistryError("malformed_file", "Zip64 directory record is missing");
    }

    record.skip(28);
    const zip64Entries = record.u64();
    const zip64Size = record.u64();
    const zip64Offset = record.u64();

    return { offset: zip64Offset, size: zip64Size, entryCount: zip64Entries };
  }

  throw new ModelRegistryError("malformed_file", "No zip end-of-directory record found");
}

export function parseZipDirectory(directory: Uint8Array, entryCount: number): ZipEntry[] {
  const cursor = new ByteCursor(directory);
  const entries: ZipEntry[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor.u32() !== CENTRAL_DIRECTORY_ENTRY) {
      throw new ModelRegistryError("malformed_file", `Zip directory entry ${index} is corrupt`);
    }

    cursor.skip(6);
    const method = cursor.u16();

    cursor.skip(8);
    let compressedSize = cursor.u32();
    let uncompressedSize = cursor.u32();
    const nameLength = cursor.u16();
    const extraLength = cursor.u16();
    const commentLength = cursor.u16();

    cursor.skip(8);
    let localHeaderOffset = cursor.u32();
    const name = cursor.text(nameLength);
    const extra = new ByteCursor(cursor.bytesOf(extraLength));

    cursor.skip(commentLength);

    while (extra.remaining >= 4) {
      const id = extra.u16();
      const length = extra.u16();
      const field = new ByteCursor(extra.bytesOf(length));

      if (id !== 0x0001) {
        continue;
      }

      if (uncompressedSize === ZIP64_MARKER) {
        uncompressedSize = field.u64();
      }

      if (compressedSize === ZIP64_MARKER) {
        compressedSize = field.u64();
      }

      if (localHeaderOffset === ZIP64_MARKER) {
        localHeaderOffset = field.u64();
      }
    }

    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
  }

  return entries;
}

export function readLocalHeaderLength(localHeader: Uint8Array): number {
  const cursor = new ByteCursor(localHeader);

  if (cursor.u32() !== LOCAL_FILE_HEADER) {
    throw new ModelRegistryError("malformed_file", "Zip local file header is corrupt");
  }

  cursor.skip(22);
  const nameLength = cursor.u16();
  const extraLength = cursor.u16();

  return ZIP_LOCAL_HEADER_BYTES + nameLength + extraLength;
}

export function findPickleEntries(entries: readonly ZipEntry[]): ZipEntry[] {
  return entries.filter((entry) => entry.name.endsWith(".pkl"));
}
