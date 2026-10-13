import { concatBytes } from "./binary.js";

const MARKER_PREFIX = 0xff;
const START_OF_IMAGE = 0xd8;
const START_OF_SCAN = 0xda;
const END_OF_IMAGE = 0xd9;
const FIRST_METADATA_SEGMENT = 0xe1;
const LAST_METADATA_SEGMENT = 0xef;
const COMMENT_SEGMENT = 0xfe;

function isMetadataSegment(marker: number): boolean {
  return (
    (marker >= FIRST_METADATA_SEGMENT && marker <= LAST_METADATA_SEGMENT) ||
    marker === COMMENT_SEGMENT
  );
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === MARKER_PREFIX && bytes[1] === START_OF_IMAGE;
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (!isJpeg(bytes)) {
    throw new Error("Not a JPEG image");
  }

  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== MARKER_PREFIX) {
      throw new Error("Malformed JPEG segment");
    }

    const marker = bytes[offset + 1];

    if (marker === START_OF_SCAN || marker === END_OF_IMAGE) {
      kept.push(bytes.subarray(offset));

      break;
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const end = offset + 2 + length;

    if (length < 2 || end > bytes.length) {
      throw new Error("Malformed JPEG segment");
    }

    if (!isMetadataSegment(marker)) {
      kept.push(bytes.subarray(offset, end));
    }

    offset = end;
  }

  return concatBytes(kept);
}
