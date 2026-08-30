export interface ImageDimensions {
  format: "png" | "webp";
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function matches(bytes: Uint8Array, offset: number, expected: number[]): boolean {
  if (bytes.length < offset + expected.length) {
    return false;
  }

  return expected.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.length < offset + length) {
    return "";
  }

  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] + (bytes[offset + 1] << 8) + (bytes[offset + 2] << 16);
}

function readPng(bytes: Uint8Array): ImageDimensions | null {
  if (!matches(bytes, 0, PNG_SIGNATURE) || ascii(bytes, 12, 4) !== "IHDR") {
    return null;
  }

  return {
    format: "png",
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

function readWebp(bytes: Uint8Array): ImageDimensions | null {
  if (ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    return null;
  }

  const chunk = ascii(bytes, 12, 4);

  if (chunk === "VP8X" && bytes.length >= 30) {
    return {
      format: "webp",
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }

  if (chunk === "VP8 " && bytes.length >= 30 && matches(bytes, 23, [0x9d, 0x01, 0x2a])) {
    return {
      format: "webp",
      width: (bytes[26] + (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] + (bytes[29] << 8)) & 0x3fff,
    };
  }

  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] + (bytes[22] << 8) + (bytes[23] << 16) + bytes[24] * 0x1000000;

    return {
      format: "webp",
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

export function readImageDimensions(data: ArrayBuffer | Uint8Array): ImageDimensions | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  return readPng(bytes) ?? readWebp(bytes);
}
