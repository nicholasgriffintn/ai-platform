export type MediaContainer =
  | "png"
  | "jpeg"
  | "webp"
  | "gif"
  | "wav"
  | "bmff"
  | "mp3"
  | "flac"
  | "ogg"
  | "matroska"
  | "svg";

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

const OGG_COMMENT_KEY = encoder.encode("POLYCHAT_XMP=");
const OGG_HEADER_LENGTH = 27;
const OGG_CRC_OFFSET = 22;
const OGG_SEGMENT_COUNT_OFFSET = 26;
const MATROSKA_MAGIC = [0x1a, 0x45, 0xdf, 0xa3];
const MATROSKA_SEGMENT_ID = [0x18, 0x53, 0x80, 0x67];
const MATROSKA_TAG_NAME = encoder.encode("POLYCHAT_XMP");
const MATROSKA_SCAN_WINDOW = 64 * 1024;
const SVG_SCAN_WINDOW = 64 * 1024;
const SVG_BYTE_ORDER_MARK = "\xef\xbb\xbf";
const WHITESPACE = /\s/;
const SVG_OPENING_TAG = /^<svg(?=[\s>/])(?:[^>"']|"[^"]*"|'[^']*')*>/;

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

const oggCrcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index << 24;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 0x80000000 ? (value << 1) ^ 0x04c11db7 : value << 1;
  }

  return value >>> 0;
});

function oggCrc(bytes: Uint8Array): number {
  let crc = 0;

  for (const byte of bytes) {
    crc = ((crc << 8) ^ (oggCrcTable[((crc >>> 24) ^ byte) & 0xff] ?? 0)) >>> 0;
  }

  return crc;
}

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

  if (head === "OggS") {
    return "ogg";
  }

  if (MATROSKA_MAGIC.every((byte, index) => bytes[index] === byte)) {
    return "matroska";
  }

  if (["ftyp", "moov", "mdat", "wide", "free"].includes(boxType)) {
    return "bmff";
  }

  if (ascii(bytes, 0, 3) === "ID3" || isMp3FrameHeader(bytes)) {
    return "mp3";
  }

  return svgOpeningTag(bytes) ? "svg" : null;
}

function endOfDelimited(text: string, from: number, closer: string): number | null {
  const end = text.indexOf(closer, from);

  return end === -1 ? null : end + closer.length;
}

function endOfDoctype(text: string, from: number): number | null {
  const close = text.indexOf(">", from);

  if (close === -1) {
    return null;
  }

  const subset = text.slice(from, close).indexOf("[");

  if (subset === -1) {
    return close + 1;
  }

  const subsetEnd = endOfDelimited(text, from + subset, "]");

  return subsetEnd === null ? null : endOfDelimited(text, subsetEnd, ">");
}

function endOfPrologItem(text: string, from: number): number | null {
  if (WHITESPACE.test(text.charAt(from))) {
    return from + 1;
  }

  if (text.startsWith("<?", from)) {
    return endOfDelimited(text, from + 2, "?>");
  }

  if (text.startsWith("<!--", from)) {
    return endOfDelimited(text, from + 4, "-->");
  }

  return text.startsWith("<!DOCTYPE", from) ? endOfDoctype(text, from) : null;
}

function svgPrologEnd(text: string): number {
  let index = text.startsWith(SVG_BYTE_ORDER_MARK) ? SVG_BYTE_ORDER_MARK.length : 0;

  while (index < text.length) {
    const next = endOfPrologItem(text, index);

    if (next === null) {
      break;
    }

    index = next;
  }

  return index;
}

function svgOpeningTag(bytes: Uint8Array): ByteRange | null {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, SVG_SCAN_WINDOW));
  const start = svgPrologEnd(head);
  const tag = SVG_OPENING_TAG.exec(head.slice(start));

  return tag ? { start, length: tag[0].length } : null;
}

interface OggPage {
  start: number;
  segments: Uint8Array;
  dataStart: number;
  end: number;
}

function oggPage(bytes: Uint8Array, start: number): OggPage | null {
  if (start + OGG_HEADER_LENGTH > bytes.length || ascii(bytes, start, 4) !== "OggS") {
    return null;
  }

  const count = bytes[start + OGG_SEGMENT_COUNT_OFFSET] ?? 0;
  const dataStart = start + OGG_HEADER_LENGTH + count;
  const segments = bytes.subarray(start + OGG_HEADER_LENGTH, dataStart);
  const end = dataStart + segments.reduce((total, length) => total + length, 0);

  return end > bytes.length ? null : { start, segments, dataStart, end };
}

function oggHeaderPages(bytes: Uint8Array): { first: OggPage; second: OggPage } | null {
  const first = oggPage(bytes, 0);
  const second = first ? oggPage(bytes, first.end) : null;

  return first && second ? { first, second } : null;
}

function readVint(bytes: Uint8Array, offset: number): { width: number; value: number } | null {
  const first = bytes[offset] ?? 0;
  const width = Math.clz32(first) - 23;

  if (width < 1 || width > 8) {
    return null;
  }

  let value = first & (0xff >>> width);

  for (let index = 1; index < width; index += 1) {
    value = value * 256 + (bytes[offset + index] ?? 0);
  }

  return { width, value };
}

function writeVint(bytes: Uint8Array, offset: number, width: number, value: number): void {
  let remaining = value;

  for (let index = width - 1; index > 0; index -= 1) {
    bytes[offset + index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }

  bytes[offset] = remaining | (0x80 >>> (width - 1));
}

function matroskaSegment(
  bytes: Uint8Array,
): { sizeOffset: number; size: ReturnType<typeof readVint> } | null {
  const header = readVint(bytes, 4);

  if (!header) {
    return null;
  }

  const start = 4 + header.width + header.value;

  if (!MATROSKA_SEGMENT_ID.every((byte, index) => bytes[start + index] === byte)) {
    return null;
  }

  return { sizeOffset: start + 4, size: readVint(bytes, start + 4) };
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
    case "ogg": {
      const pages = oggHeaderPages(bytes);

      return pages ? [bytes.subarray(0, pages.second.end)] : [];
    }

    case "matroska":
      return bytes.length <= MATROSKA_SCAN_WINDOW * 2
        ? [bytes]
        : [
            bytes.subarray(0, MATROSKA_SCAN_WINDOW),
            bytes.subarray(bytes.length - MATROSKA_SCAN_WINDOW),
          ];
    case "gif":
    case "svg":
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

function oggCommentEnd(packet: Uint8Array): { countOffset: number; listEnd: number } | null {
  const magicLength = ascii(packet, 1, 6) === "vorbis" && packet[0] === 3 ? 7 : 8;

  if (magicLength === 8 && ascii(packet, 0, 8) !== "OpusTags") {
    return null;
  }

  if (packet.length < magicLength + 8) {
    return null;
  }

  const data = view(packet);
  const countOffset = magicLength + 4 + data.getUint32(magicLength, true);

  if (countOffset + 4 > packet.length) {
    return null;
  }

  let listEnd = countOffset + 4;

  for (let index = data.getUint32(countOffset, true); index > 0; index -= 1) {
    if (listEnd + 4 > packet.length) {
      return null;
    }

    listEnd += 4 + data.getUint32(listEnd, true);
  }

  return listEnd <= packet.length ? { countOffset, listEnd } : null;
}

function oggLacing(length: number): number[] {
  return [...Array.from({ length: Math.floor(length / 255) }, () => 255), length % 255];
}

function embedOgg(bytes: Uint8Array, packetLength: number): EmbeddedSlot | null {
  const pages = oggHeaderPages(bytes);

  if (!pages) {
    return null;
  }

  const { first, second } = pages;
  const data = view(bytes);
  const sameStream = data.getUint32(14, true) === data.getUint32(second.start + 14, true);
  const flags = bytes[second.start + 5] ?? 0;
  const lastSegment = second.segments.findIndex((length) => length < 255);

  if (first.end !== second.start || !sameStream || flags !== 0 || lastSegment === -1) {
    return null;
  }

  const oldLength = second.segments
    .subarray(0, lastSegment + 1)
    .reduce((total, length) => total + length, 0);
  const comment = bytes.subarray(second.dataStart, second.dataStart + oldLength);
  const layout = oggCommentEnd(comment);

  if (!layout) {
    return null;
  }

  const entryLength = OGG_COMMENT_KEY.length + packetLength;
  const lacing = [
    ...oggLacing(oldLength + 4 + entryLength),
    ...second.segments.subarray(lastSegment + 1),
  ];

  if (lacing.length > 255) {
    return null;
  }

  const entry = new Uint8Array(4 + entryLength);

  view(entry).setUint32(0, entryLength, true);
  entry.set(OGG_COMMENT_KEY, 4);

  const listEnd = second.dataStart + layout.listEnd;
  const out = assemble(
    bytes.subarray(0, second.start + OGG_SEGMENT_COUNT_OFFSET),
    Uint8Array.from([lacing.length, ...lacing]),
    bytes.subarray(second.dataStart, listEnd),
    entry,
    bytes.subarray(listEnd),
  );
  const shift = lacing.length - second.segments.length;
  const packetStart = listEnd + shift + 4 + OGG_COMMENT_KEY.length;
  const pageEnd = second.end + shift + entry.length;
  const crcStart = second.start + OGG_CRC_OFFSET;
  const countOffset = second.dataStart + shift + layout.countOffset;
  const output = view(out);

  output.setUint32(countOffset, output.getUint32(countOffset, true) + 1, true);

  return {
    bytes: out,
    exclusion: { start: crcStart, length: packetStart + packetLength - crcStart },
    write(packet) {
      out.set(packet, packetStart);
      output.setUint32(crcStart, 0);
      output.setUint32(crcStart, oggCrc(out.subarray(second.start, pageEnd)), true);
    },
  };
}

function ebmlElement(id: number[], ...payload: Uint8Array[]): Uint8Array {
  const body = assemble(...payload);
  const size = new Uint8Array(8);

  writeVint(size, 0, 8, body.length);

  return assemble(Uint8Array.from(id), size, body);
}

function matroskaTags(packetLength: number): Uint8Array {
  return ebmlElement(
    [0x12, 0x54, 0xc3, 0x67],
    ebmlElement(
      [0x73, 0x73],
      ebmlElement([0x63, 0xc0]),
      ebmlElement(
        [0x67, 0xc8],
        ebmlElement([0x45, 0xa3], MATROSKA_TAG_NAME),
        ebmlElement([0x44, 0x87], new Uint8Array(packetLength)),
      ),
    ),
  );
}

function embedMatroska(bytes: Uint8Array, packetLength: number): EmbeddedSlot | null {
  const segment = matroskaSegment(bytes);

  if (!segment?.size) {
    return null;
  }

  const { sizeOffset, size } = segment;
  const unknownSize = size.value === 2 ** (7 * size.width) - 1;
  const dataStart = sizeOffset + size.width;
  const tags = matroskaTags(packetLength);
  const newSize = size.value + tags.length;

  if (
    !unknownSize &&
    (dataStart + size.value !== bytes.length || newSize >= 2 ** (7 * size.width) - 1)
  ) {
    return null;
  }

  const out = assemble(bytes, tags);

  if (!unknownSize) {
    writeVint(out, sizeOffset, size.width, newSize);
  }

  return plainSlot(out, out.length - packetLength, packetLength);
}

function embedSvg(bytes: Uint8Array, packetLength: number): EmbeddedSlot | null {
  const tag = svgOpeningTag(bytes);

  if (!tag || bytes[tag.start + tag.length - 2] === 0x2f) {
    return null;
  }

  const insertAt = tag.start + tag.length;
  const open = encoder.encode("<metadata>");
  const out = assemble(
    bytes.subarray(0, insertAt),
    open,
    new Uint8Array(packetLength),
    encoder.encode("</metadata>"),
    bytes.subarray(insertAt),
  );

  return plainSlot(out, insertAt + open.length, packetLength);
}

const EMBEDDERS: Record<
  MediaContainer,
  (bytes: Uint8Array, length: number) => EmbeddedSlot | null
> = {
  png: embedPng,
  jpeg: embedJpeg,
  webp: embedWebp,
  gif: embedGif,
  wav: embedWav,
  bmff: embedBmff,
  mp3: embedMp3,
  flac: embedFlac,
  ogg: embedOgg,
  matroska: embedMatroska,
  svg: embedSvg,
};

export function embedSlot(
  container: MediaContainer,
  bytes: Uint8Array,
  packetLength: number,
): EmbeddedSlot | null {
  return EMBEDDERS[container](bytes, packetLength);
}
