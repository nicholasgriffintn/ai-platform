import { describe, expect, it } from "vitest";

import { markGeneratedMedia, verifyMediaProvenance } from "../media-provenance/index.js";

const encoder = new TextEncoder();
const origin = { generator: "Polychat", model: "acme/image-1", provider: "acme" };

function join(...parts: Array<Uint8Array | number[] | string>): Uint8Array {
  const bytes = parts.map((part) =>
    typeof part === "string" ? encoder.encode(part) : Uint8Array.from(part),
  );
  const out = new Uint8Array(bytes.reduce((total, part) => total + part.length, 0));
  let offset = 0;

  for (const part of bytes) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}

function u32be(value: number): number[] {
  return [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function u32le(value: number): number[] {
  return u32be(value).reverse();
}

function pngChunk(type: string, data: Uint8Array | string = ""): Uint8Array {
  const body = join(data);

  return join(u32be(body.length), type, body, [0, 0, 0, 0]);
}

function png(...extra: Uint8Array[]): Uint8Array {
  return join(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pngChunk("IHDR", new Uint8Array(13)),
    ...extra,
    pngChunk("IDAT", "pixels"),
    pngChunk("IEND"),
  );
}

function riff(form: string, ...chunks: Uint8Array[]): Uint8Array {
  const body = join(form, ...chunks);

  return join("RIFF", u32le(body.length), body);
}

function riffChunk(id: string, payload: Uint8Array | number[], declared?: number): Uint8Array {
  const body = join(payload);

  return join(id, u32le(declared ?? body.length), body, body.length % 2 ? [0] : []);
}

function lossyWebp(width: number, height: number): Uint8Array {
  return riff(
    "WEBP",
    riffChunk("VP8 ", [
      0,
      0,
      0,
      0x9d,
      0x01,
      0x2a,
      width & 0xff,
      width >>> 8,
      height & 0xff,
      height >>> 8,
    ]),
  );
}

function box(type: string, payload: Uint8Array | string = "", declared?: number): Uint8Array {
  const body = join(payload);

  return join(u32be(declared ?? body.length + 8), type, body);
}

function oggPage(flags: number, sequence: number, packets: Uint8Array[]): Uint8Array {
  const lacing = packets.flatMap((packet) => [
    ...Array.from({ length: Math.floor(packet.length / 255) }, () => 255),
    packet.length % 255,
  ]);

  return join(
    "OggS",
    [0, flags],
    new Uint8Array(8),
    u32le(1),
    u32le(sequence),
    u32le(0),
    [lacing.length, ...lacing],
    ...packets,
  );
}

function opusTags(...comments: string[]): Uint8Array {
  return join(
    "OpusTags",
    u32le(3),
    "abc",
    u32le(comments.length),
    ...comments.flatMap((comment) => [join(u32le(comment.length)), join(comment)]),
  );
}

function ogg(comment: Uint8Array): Uint8Array {
  return join(
    oggPage(2, 0, [join("OpusHead", new Uint8Array(11))]),
    oggPage(0, 1, [comment]),
    oggPage(4, 2, [join("audio")]),
  );
}

function ebml(id: number[], payload: Uint8Array | string = ""): Uint8Array {
  const body = join(payload);

  return join(id, [0x01, 0, 0, 0, 0, 0, 0, 0], body).map((byte, index) =>
    index === id.length + 7 ? body.length : byte,
  );
}

const EBML_HEADER = ebml([0x1a, 0x45, 0xdf, 0xa3], "webm");
const SEGMENT_ID = [0x18, 0x53, 0x80, 0x67];

const mp3Frame = [0xff, 0xfb, 0x90, 0x00, 1, 2, 3, 4, 5, 6, 7, 8];

const CONTAINERS: Array<[string, Uint8Array]> = [
  ["png", png()],
  ["jpeg", join([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xda, 0, 2, 1, 2, 0xff, 0xd9])],
  ["webp", lossyWebp(640, 480)],
  ["gif", join("GIF89a", [1, 0, 1, 0, 0, 0, 0], [0x3b])],
  ["wav", riff("WAVE", riffChunk("fmt ", new Uint8Array(16)), riffChunk("data", [1, 2]))],
  ["mp4", join(box("ftyp", "isom"), box("mdat", "frames"))],
  ["mp3", join(mp3Frame)],
  ["flac", join("fLaC", [0x80, 0, 0, 34], new Uint8Array(34), [0xff, 0xf8])],
  ["ogg", ogg(opusTags("TITLE=x"))],
  ["webm", join(EBML_HEADER, ebml(SEGMENT_ID, "clusters"))],
  ["svg", join('<?xml version="1.0"?><svg viewBox="0 0 1 1"><path/></svg>')],
];

describe("markGeneratedMedia", () => {
  it.each(CONTAINERS)("embeds a mark that verifies in %s", async (_name, bytes) => {
    const marked = await markGeneratedMedia(bytes, origin);
    const verified = await verifyMediaProvenance(marked.bytes);

    expect(marked.status).toBe("marked");
    expect(verified?.contentIntact).toBe(true);
    expect(verified?.record).toMatchObject({ markId: marked.markId, model: "acme/image-1" });
  });
});

describe("verifyMediaProvenance", () => {
  it("detects a changed file", async () => {
    const { bytes } = await markGeneratedMedia(png(), origin);
    const tampered = new Uint8Array(bytes);

    tampered[tampered.length - 20] = (tampered[tampered.length - 20] ?? 0) ^ 0xff;

    expect((await verifyMediaProvenance(tampered))?.contentIntact).toBe(false);
  });
});
