export type MediaContainer = "png" | "jpeg" | "webp" | "gif" | "wav" | "bmff" | "mp3" | "flac";

export interface ByteRange {
  start: number;
  length: number;
}

export interface EmbeddedSlot {
  bytes: Uint8Array<ArrayBuffer>;
  exclusion: ByteRange;
  write(packet: Uint8Array): void;
}

const encoder = new TextEncoder();
const XMP_UUID = Uint8Array.from([
  0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac,
]);
const PNG_SIGNATURE_LENGTH = 8;
const PNG_XMP_HEADER = encoder.encode("XML:com.adobe.xmp\0\0\0\0\0");
const JPEG_XMP_HEADER = encoder.encode("http://ns.adobe.com/xap/1.0/\0");
const GIF_XMP_HEADER = Uint8Array.from([0x21, 0xff, 0x0b, ...encoder.encode("XMP DataXMP")]);
const FLAC_APPLICATION_ID = encoder.encode("pXMP");
const ID3_XMP_OWNER = encoder.encode("XMP\0");
const RIFF_AUDIO_VISUAL_CHUNKS = new Set(["data", "VP8 ", "VP8L", "ALPH", "ANMF"]);

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (crcTable[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function view(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function assemble(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

function syncsafe(value: number): Uint8Array {
  return Uint8Array.from([
    (value >>> 21) & 0x7f,
    (value >>> 14) & 0x7f,
    (value >>> 7) & 0x7f,
    value & 0x7f,
  ]);
}

function readSyncsafe(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 21) |
    ((bytes[offset + 1] ?? 0) << 14) |
    ((bytes[offset + 2] ?? 0) << 7) |
    (bytes[offset + 3] ?? 0)
  );
}

export function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  const first = needle[0];
  const last = haystack.length - needle.length;

  for (let index = haystack.indexOf(first ?? 0, from); index !== -1 && index <= last;) {
    let offset = 1;

    while (offset < needle.length && haystack[index + offset] === needle[offset]) {
      offset += 1;
    }

    if (offset === needle.length) {
      return index;
    }

    index = haystack.indexOf(first ?? 0, index + 1);
  }

  return -1;
}

function isMp3FrameHeader(bytes: Uint8Array): boolean {
  const version = ((bytes[1] ?? 0) >>> 3) & 0x03;
  const layer = ((bytes[1] ?? 0) >>> 1) & 0x03;
  const bitrate = ((bytes[2] ?? 0) >>> 4) & 0x0f;
  const sampleRate = ((bytes[2] ?? 0) >>> 2) & 0x03;

  return (
    bytes[0] === 0xff &&
    ((bytes[1] ?? 0) & 0xe0) === 0xe0 &&
    version !== 1 &&
    layer !== 0 &&
    bitrate !== 0x0f &&
    sampleRate !== 3
  );
}

export function detectContainer(bytes: Uint8Array): MediaContainer | null {
  if (bytes.length < 12) {
    return null;
  }

  const head = ascii(bytes, 0, 4);
  const brand = ascii(bytes, 8, 4);
  const boxType = ascii(bytes, 4, 4);

  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === "PNG") {
    return "png";
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  if (head === "RIFF" && brand === "WEBP") {
    return "webp";
  }

  if (head === "RIFF" && brand === "WAVE") {
    return "wav";
  }

  if (head === "GIF8") {
    return "gif";
  }

  if (head === "fLaC") {
    return "flac";
  }

  if (["ftyp", "moov", "mdat", "wide", "free"].includes(boxType)) {
    return "bmff";
  }

  if (ascii(bytes, 0, 3) === "ID3" || isMp3FrameHeader(bytes)) {
    return "mp3";
  }

  return null;
}

function pngChunks(bytes: Uint8Array): Array<{ type: string; start: number; length: number }> {
  const chunks: Array<{ type: string; start: number; length: number }> = [];
  const data = view(bytes);

  for (let offset = PNG_SIGNATURE_LENGTH; offset + 12 <= bytes.length;) {
    const length = data.getUint32(offset);

    chunks.push({ type: ascii(bytes, offset + 4, 4), start: offset, length });
    offset += 12 + length;
  }

  return chunks;
}

function jpegSegments(bytes: Uint8Array): Array<{ marker: number; start: number; end: number }> {
  const segments: Array<{ marker: number; start: number; end: number }> = [];
  const data = view(bytes);

  for (let offset = 2; offset + 4 <= bytes.length && bytes[offset] === 0xff;) {
    const marker = bytes[offset + 1] ?? 0;

    if (marker === 0xda || marker === 0xd9) {
      break;
    }

    const end = offset + 2 + data.getUint16(offset + 2);

    segments.push({ marker, start: offset, end });
    offset = end;
  }

  return segments;
}

function riffChunks(bytes: Uint8Array): Array<{ id: string; start: number; size: number }> {
  const chunks: Array<{ id: string; start: number; size: number }> = [];
  const data = view(bytes);

  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = data.getUint32(offset + 4, true);

    chunks.push({ id: ascii(bytes, offset, 4), start: offset, size });
    offset += 8 + size + (size % 2);
  }

  return chunks;
}

function bmffBoxes(bytes: Uint8Array): Array<{ type: string; start: number; size: number }> {
  const boxes: Array<{ type: string; start: number; size: number }> = [];
  const data = view(bytes);

  for (let offset = 0; offset + 8 <= bytes.length;) {
    const declared = data.getUint32(offset);
    const type = ascii(bytes, offset + 4, 4);
    const size =
      declared === 1
        ? Number(data.getBigUint64(offset + 8))
        : declared === 0
          ? bytes.length - offset
          : declared;

    if (size < 8) {
      break;
    }

    boxes.push({ type, start: offset, size });
    offset += size;
  }

  return boxes;
}

function flacBlocks(bytes: Uint8Array): Array<{ start: number; end: number; last: boolean }> {
  const blocks: Array<{ start: number; end: number; last: boolean }> = [];

  for (let offset = 4; offset + 4 <= bytes.length;) {
    const header = bytes[offset] ?? 0;
    const length =
      ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    const end = offset + 4 + length;
    const last = (header & 0x80) !== 0;

    blocks.push({ start: offset, end, last });
    offset = end;

    if (last) {
      break;
    }
  }

  return blocks;
}

/**
 * The parts of a file that hold metadata rather than encoded media. Searching only these keeps
 * detection fast on large video and stops compressed samples matching a marker by chance.
 */
export function metadataRegions(container: MediaContainer, bytes: Uint8Array): Uint8Array[] {
  switch (container) {
    case "png":
      return pngChunks(bytes)
        .filter((chunk) => chunk.type !== "IDAT")
        .map((chunk) => bytes.subarray(chunk.start, chunk.start + 12 + chunk.length));
    case "jpeg":
      return jpegSegments(bytes).map((segment) => bytes.subarray(segment.start, segment.end));
    case "webp":
    case "wav":
      return riffChunks(bytes)
        .filter((chunk) => !RIFF_AUDIO_VISUAL_CHUNKS.has(chunk.id))
        .map((chunk) => bytes.subarray(chunk.start, chunk.start + 8 + chunk.size));
    case "bmff":
      return bmffBoxes(bytes)
        .filter((box) => box.type === "uuid")
        .map((box) => bytes.subarray(box.start, box.start + box.size));
    case "mp3":
      return ascii(bytes, 0, 3) === "ID3" ? [bytes.subarray(0, 10 + readSyncsafe(bytes, 6))] : [];
    case "flac":
      return flacBlocks(bytes).map((block) => bytes.subarray(block.start, block.end));
    case "gif":
      return [bytes];
  }
}

function embedPng(bytes: Uint8Array, packetLength: number): EmbeddedSlot {
  const header = pngChunks(bytes)[0];

  if (header?.type !== "IHDR") {
    throw new Error("PNG has no IHDR chunk");
  }

  const insertAt = header.start + 12 + header.length;
  const dataLength = PNG_XMP_HEADER.length + packetLength;
  const chunk = new Uint8Array(12 + dataLength);

  view(chunk).setUint32(0, dataLength);
  chunk.set(encoder.encode("iTXt"), 4);
  chunk.set(PNG_XMP_HEADER, 8);

  const out = assemble(bytes.subarray(0, insertAt), chunk, bytes.subarray(insertAt));
  const packetStart = insertAt + 8 + PNG_XMP_HEADER.length;
  const crcStart = packetStart + packetLength;

  return {
    bytes: out,
    exclusion: { start: packetStart, length: packetLength + 4 },
    write(packet) {
      out.set(packet, packetStart);
      view(out).setUint32(crcStart, crc32(out.subarray(insertAt + 4, crcStart)));
    },
  };
}

function embedJpeg(bytes: Uint8Array, packetLength: number): EmbeddedSlot {
  const first = jpegSegments(bytes)[0];
  const insertAt = first?.marker === 0xe0 ? first.end : 2;
  const segmentLength = 2 + JPEG_XMP_HEADER.length + packetLength;

  if (segmentLength > 0xffff) {
    throw new Error("XMP packet is too large for a JPEG segment");
  }

  const segment = new Uint8Array(2 + segmentLength);

  segment.set([0xff, 0xe1]);
  view(segment).setUint16(2, segmentLength);
  segment.set(JPEG_XMP_HEADER, 4);

  const out = assemble(bytes.subarray(0, insertAt), segment, bytes.subarray(insertAt));

  return plainSlot(out, insertAt + 4 + JPEG_XMP_HEADER.length, packetLength);
}

function plainSlot(out: Uint8Array<ArrayBuffer>, start: number, length: number): EmbeddedSlot {
  return {
    bytes: out,
    exclusion: { start, length },
    write(packet) {
      out.set(packet, start);
    },
  };
}

function riffChunk(id: string, payloadLength: number): Uint8Array {
  const chunk = new Uint8Array(8 + payloadLength + (payloadLength % 2));

  chunk.set(encoder.encode(id));
  view(chunk).setUint32(4, payloadLength, true);

  return chunk;
}

function webpCanvas(bytes: Uint8Array): { width: number; height: number; alpha: boolean } {
  const data = view(bytes);
  const format = ascii(bytes, 12, 4);

  if (format === "VP8 ") {
    return {
      width: data.getUint16(26, true) & 0x3fff,
      height: data.getUint16(28, true) & 0x3fff,
      alpha: false,
    };
  }

  if (format === "VP8L") {
    const bits = data.getUint32(21, true);

    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
      alpha: ((bits >>> 28) & 1) === 1,
    };
  }

  throw new Error(`Unsupported WebP bitstream: ${format}`);
}

function extendedWebp(bytes: Uint8Array): Uint8Array {
  if (ascii(bytes, 12, 4) === "VP8X") {
    return bytes;
  }

  const { width, height, alpha } = webpCanvas(bytes);
  const header = riffChunk("VP8X", 10);
  const data = view(header);

  header[8] = alpha ? 0x10 : 0;
  data.setUint16(12, (width - 1) & 0xffff, true);
  header[14] = (width - 1) >>> 16;
  data.setUint16(15, (height - 1) & 0xffff, true);
  header[17] = (height - 1) >>> 16;

  return assemble(bytes.subarray(0, 12), header, bytes.subarray(12));
}

function embedWebp(bytes: Uint8Array, packetLength: number): EmbeddedSlot {
  const extended = extendedWebp(bytes);
  const chunk = riffChunk("XMP ", packetLength);
  const out = assemble(extended, chunk);
  const data = view(out);

  out[20] = (out[20] ?? 0) | 0x04;
  data.setUint32(4, out.length - 8, true);

  return plainSlot(out, extended.length + 8, packetLength);
}

function embedWav(bytes: Uint8Array, packetLength: number): EmbeddedSlot {
  const audio = riffChunks(bytes).find((chunk) => chunk.id === "data");

  if (!audio) {
    throw new Error("WAV has no data chunk");
  }

  const chunk = riffChunk("_PMX", packetLength);
  const out = assemble(bytes.subarray(0, audio.start), chunk, bytes.subarray(audio.start));
  const data = view(out);
  const declared = data.getUint32(4, true);

  if (declared !== 0 && declared !== 0xffffffff) {
    data.setUint32(4, declared + chunk.length, true);
  }

  return plainSlot(out, audio.start + 8, packetLength);
}

function embedBmff(bytes: Uint8Array, packetLength: number): EmbeddedSlot {
  const last = bmffBoxes(bytes).at(-1);
  const boxLength = 8 + XMP_UUID.length + packetLength;
  const box = new Uint8Array(boxLength);

  view(box).setUint32(0, boxLength);
  box.set(encoder.encode("uuid"), 4);
  box.set(XMP_UUID, 8);

  const out = assemble(bytes, box);

  if (last && view(bytes).getUint32(last.start) === 0) {
    if (last.size > 0xffffffff) {
      throw new Error("Final box is too large to close");
    }

    view(out).setUint32(last.start, last.size);
  }

  return plainSlot(out, bytes.length + 8 + XMP_UUID.length, packetLength);
}

function embedMp3(bytes: Uint8Array, packetLength: number): EmbeddedSlot {
  const frameLength = ID3_XMP_OWNER.length + packetLength;
  const tag = new Uint8Array(20 + frameLength);

  tag.set(encoder.encode("ID3"));
  tag[3] = 4;
  tag.set(syncsafe(10 + frameLength), 6);
  tag.set(encoder.encode("PRIV"), 10);
  tag.set(syncsafe(frameLength), 14);
  tag.set(ID3_XMP_OWNER, 20);

  return plainSlot(assemble(tag, bytes), 20 + ID3_XMP_OWNER.length, packetLength);
}

function embedFlac(bytes: Uint8Array, packetLength: number): EmbeddedSlot {
  const streamInfo = flacBlocks(bytes)[0];

  if (!streamInfo) {
    throw new Error("FLAC has no STREAMINFO block");
  }

  const blockLength = FLAC_APPLICATION_ID.length + packetLength;
  const block = new Uint8Array(4 + blockLength);

  block[0] = 2 | (streamInfo.last ? 0x80 : 0);
  block[1] = (blockLength >>> 16) & 0xff;
  block[2] = (blockLength >>> 8) & 0xff;
  block[3] = blockLength & 0xff;
  block.set(FLAC_APPLICATION_ID, 4);

  const out = assemble(bytes.subarray(0, streamInfo.end), block, bytes.subarray(streamInfo.end));

  out[streamInfo.start] = (out[streamInfo.start] ?? 0) & 0x7f;

  return plainSlot(out, streamInfo.end + 4 + FLAC_APPLICATION_ID.length, packetLength);
}

function gifMagicTrailer(): Uint8Array {
  const trailer = new Uint8Array(258);

  trailer[0] = 0x01;

  for (let index = 0; index < 256; index += 1) {
    trailer[index + 1] = 0xff - index;
  }

  return trailer;
}

function embedGif(bytes: Uint8Array, packetLength: number): EmbeddedSlot {
  const packed = bytes[10] ?? 0;
  const colourTable = packed & 0x80 ? 3 * 2 ** ((packed & 0x07) + 1) : 0;
  const insertAt = 13 + colourTable;
  const extension = assemble(GIF_XMP_HEADER, new Uint8Array(packetLength), gifMagicTrailer());
  const out = assemble(bytes.subarray(0, insertAt), extension, bytes.subarray(insertAt));

  return plainSlot(out, insertAt + GIF_XMP_HEADER.length, packetLength);
}

const EMBEDDERS: Record<MediaContainer, (bytes: Uint8Array, length: number) => EmbeddedSlot> = {
  png: embedPng,
  jpeg: embedJpeg,
  webp: embedWebp,
  gif: embedGif,
  wav: embedWav,
  bmff: embedBmff,
  mp3: embedMp3,
  flac: embedFlac,
};

export function embedSlot(
  container: MediaContainer,
  bytes: Uint8Array,
  packetLength: number,
): EmbeddedSlot {
  return EMBEDDERS[container](bytes, packetLength);
}
