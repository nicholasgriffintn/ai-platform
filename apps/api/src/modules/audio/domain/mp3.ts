export function stripId3Tag(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) {
    return bytes;
  }

  const size =
    ((bytes[6] & 0x7f) << 21) |
    ((bytes[7] & 0x7f) << 14) |
    ((bytes[8] & 0x7f) << 7) |
    (bytes[9] & 0x7f);
  const hasFooter = (bytes[5] & 0x10) !== 0;
  const tagLength = 10 + size + (hasFooter ? 10 : 0);

  return bytes.subarray(Math.min(tagLength, bytes.length));
}

const MPEG1_LAYER3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_LAYER3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MPEG1_SAMPLE_RATES = [44100, 48000, 32000];

function matchesAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  return [...text].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
}

export function stripMp3InfoFrame(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 4 || bytes[0] !== 0xff || (bytes[1] & 0xe0) !== 0xe0) {
    return bytes;
  }

  const version = (bytes[1] >> 3) & 0x03;
  const layer = (bytes[1] >> 1) & 0x03;
  const mpeg1 = version === 0x03;
  const kbps = (mpeg1 ? MPEG1_LAYER3_KBPS : MPEG2_LAYER3_KBPS)[(bytes[2] >> 4) & 0x0f] ?? 0;
  const baseRate = MPEG1_SAMPLE_RATES[(bytes[2] >> 2) & 0x03] ?? 0;
  const sampleRate = mpeg1 ? baseRate : version === 0x02 ? baseRate / 2 : baseRate / 4;

  if (layer !== 0x01 || !kbps || !sampleRate) {
    return bytes;
  }

  const mono = bytes[3] >> 6 === 0x03;
  const sideInfo = mpeg1 ? (mono ? 17 : 32) : mono ? 9 : 17;
  const tagged =
    matchesAscii(bytes, 4 + sideInfo, "Xing") ||
    matchesAscii(bytes, 4 + sideInfo, "Info") ||
    matchesAscii(bytes, 36, "VBRI");

  if (!tagged) {
    return bytes;
  }

  const frameLength =
    Math.floor(((mpeg1 ? 144 : 72) * kbps * 1000) / sampleRate) + ((bytes[2] >> 1) & 0x01);

  return bytes.subarray(Math.min(frameLength, bytes.length));
}

const MPEG25_SAMPLE_RATES = [11025, 12000, 8000];

interface Mp3FrameInfo {
  length: number;
  seconds: number;
}

function readMp3Frame(bytes: Uint8Array, offset: number): Mp3FrameInfo | null {
  if (offset + 4 > bytes.length || bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) {
    return null;
  }

  const version = (bytes[offset + 1] >> 3) & 0x03;
  const layer = (bytes[offset + 1] >> 1) & 0x03;
  const mpeg1 = version === 0x03;
  const kbps =
    (mpeg1 ? MPEG1_LAYER3_KBPS : MPEG2_LAYER3_KBPS)[(bytes[offset + 2] >> 4) & 0x0f] ?? 0;
  const rateIndex = (bytes[offset + 2] >> 2) & 0x03;
  const sampleRate = mpeg1
    ? (MPEG1_SAMPLE_RATES[rateIndex] ?? 0)
    : version === 0x02
      ? (MPEG1_SAMPLE_RATES[rateIndex] ?? 0) / 2
      : (MPEG25_SAMPLE_RATES[rateIndex] ?? 0);

  if (layer !== 0x01 || version === 0x01 || !kbps || !sampleRate) {
    return null;
  }

  const padding = (bytes[offset + 2] >> 1) & 0x01;
  const length = Math.floor(((mpeg1 ? 144 : 72) * kbps * 1000) / sampleRate) + padding;

  return { length, seconds: (mpeg1 ? 1152 : 576) / sampleRate };
}

export function mp3DurationSeconds(bytes: Uint8Array): number {
  let offset = 0;
  let seconds = 0;

  while (offset + 4 <= bytes.length) {
    const frame = readMp3Frame(bytes, offset);

    if (!frame) {
      offset += 1;
      continue;
    }

    seconds += frame.seconds;
    offset += frame.length;
  }

  return seconds;
}

export function joinAudioSegments(segments: Uint8Array[]): Uint8Array {
  const frames = segments.map((segment) => stripMp3InfoFrame(stripId3Tag(segment)));
  const joined = new Uint8Array(frames.reduce((total, frame) => total + frame.length, 0));
  let offset = 0;

  for (const frame of frames) {
    joined.set(frame, offset);
    offset += frame.length;
  }

  return joined;
}

export function mp3SegmentSeconds(segment: Uint8Array): number {
  return mp3DurationSeconds(stripMp3InfoFrame(stripId3Tag(segment)));
}
