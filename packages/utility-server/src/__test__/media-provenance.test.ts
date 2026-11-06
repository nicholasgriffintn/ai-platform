import { describe, expect, it } from "vitest";

import {
  MAX_MARKABLE_BYTES,
  markGeneratedMedia,
  readMediaProvenance,
  verifyMediaProvenance,
} from "../media-provenance/index.js";

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

  it.each(CONTAINERS)("does not mark %s twice", async (_name, bytes) => {
    const first = await markGeneratedMedia(bytes, origin);
    const second = await markGeneratedMedia(first.bytes, origin);

    expect(second.status).toBe("already-marked");
    expect(second.markId).toBe(first.markId);
    expect(second.bytes).toEqual(first.bytes);
  });

  it.each([
    ["PNG", png(pngChunk("caBX", join("....jumb....c2pa")))],
    [
      "WebP",
      riff("WEBP", riffChunk("VP8X", new Uint8Array(10)), riffChunk("C2PA", join("jumbc2pa"))),
    ],
    ["MP4", join(box("ftyp", "isom"), box("uuid", "jumb c2pa manifest"), box("mdat", "frames"))],
  ])("leaves a %s with a C2PA manifest byte for byte", async (_name, bytes) => {
    const marked = await markGeneratedMedia(bytes, origin);

    expect(marked.status).toBe("provider-marked");
    expect(marked.bytes).toEqual(bytes);
  });

  it("still marks a file whose text metadata merely mentions c2pa", async () => {
    const marked = await markGeneratedMedia(
      png(pngChunk("tEXt", "prompt\0a poster about c2pa")),
      origin,
    );

    expect(marked.status).toBe("marked");
  });

  it("treats an existing AI source type as the provider's own mark", async () => {
    const bytes = png(pngChunk("iTXt", "XML:com.adobe.xmp\0trainedAlgorithmicMedia"));

    expect((await markGeneratedMedia(bytes, origin)).status).toBe("provider-marked");
  });

  it("never prepends a tag to raw PCM, even when it looks like an MP3 frame", async () => {
    const silence = new Uint8Array(64).fill(0xff);
    const declared = join(mp3Frame, new Uint8Array(32));

    expect((await markGeneratedMedia(silence, origin)).status).toBe("unsupported");
    expect(
      (await markGeneratedMedia(declared, { ...origin, mimeType: "audio/pcm;rate=24000" })).bytes,
    ).toEqual(declared);
  });

  it("returns formats it cannot embed in unchanged, with a fingerprint", async () => {
    const ogg = join("OggS", new Uint8Array(32));
    const marked = await markGeneratedMedia(ogg, origin);

    expect(marked.status).toBe("unsupported");
    expect(marked.bytes).toEqual(ogg);
    expect(marked.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records large media without copying or changing it", async () => {
    const mp4 = new Uint8Array(MAX_MARKABLE_BYTES + 16);

    mp4.set(join(box("ftyp", "isom"), u32be(mp4.length - 12), "mdat"));

    const marked = await markGeneratedMedia(mp4, origin);

    expect(marked.status).toBe("too-large");
    expect(marked.bytes.buffer).toBe(mp4.buffer);
    expect(marked.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("still reports a provider mark on media too large to mark", async () => {
    const provider = box("uuid", "jumb c2pa manifest");
    const mp4 = new Uint8Array(MAX_MARKABLE_BYTES + 16);

    mp4.set(join(box("ftyp", "isom"), provider, u32be(mp4.length - 12 - provider.length), "mdat"));

    expect((await markGeneratedMedia(mp4, origin)).status).toBe("provider-marked");
  });

  it("adds a comment without disturbing existing Ogg comments or later pages", async () => {
    const source = ogg(opusTags("TITLE=x"));
    const { bytes } = await markGeneratedMedia(source, origin);
    const text = new TextDecoder("latin1").decode(bytes);
    const countOffset = text.indexOf("OpusTags") + 8 + 4 + 3;

    expect(new DataView(bytes.buffer).getUint32(countOffset, true)).toBe(2);
    expect(text).toContain("TITLE=x");
    expect(text.indexOf("TITLE=x")).toBeLessThan(text.indexOf("POLYCHAT_XMP="));
    expect(bytes.subarray(bytes.length - 33)).toEqual(source.subarray(source.length - 33));
  });

  it("declines an Ogg comment that would not fit its page", async () => {
    const source = ogg(opusTags("x".repeat(64_800)));

    expect((await markGeneratedMedia(source, origin)).status).toBe("unsupported");
  });

  it("declines an Ogg comment packet that runs onto another page", async () => {
    const spanning = join(
      oggPage(2, 0, [join("OpusHead", new Uint8Array(11))]),
      "OggS",
      [0, 0],
      new Uint8Array(8),
      u32le(1),
      u32le(1),
      u32le(0),
      [1, 255],
      opusTags("x".repeat(300)).subarray(0, 255),
    );

    expect((await markGeneratedMedia(spanning, origin)).status).toBe("unsupported");
  });

  it("grows a sized Matroska segment by exactly the appended tags", async () => {
    const source = join(EBML_HEADER, ebml(SEGMENT_ID, "clusters"));
    const { bytes } = await markGeneratedMedia(source, origin);
    const sizeOffset = EBML_HEADER.length + 4;
    const size = new DataView(bytes.buffer).getUint32(sizeOffset + 4);

    expect(sizeOffset + 8 + size).toBe(bytes.length);
  });

  it("leaves an unknown Matroska segment size unknown", async () => {
    const unknown = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];
    const source = join(EBML_HEADER, SEGMENT_ID, unknown, "clusters");
    const { bytes } = await markGeneratedMedia(source, origin);

    expect((await verifyMediaProvenance(bytes))?.contentIntact).toBe(true);
    expect(bytes.subarray(EBML_HEADER.length + 4, EBML_HEADER.length + 12)).toEqual(
      Uint8Array.from(unknown),
    );
  });

  it("places SVG metadata inside the real root element", async () => {
    const svg = join('<!-- <svg width="1"> --><svg data-note="a > b" viewBox="0 0 1 1"><g/></svg>');
    const { bytes } = await markGeneratedMedia(svg, origin);
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('<svg data-note="a > b" viewBox="0 0 1 1"><metadata>');
    expect(text).toContain("</metadata><g/></svg>");
  });

  it("finds the root element after a DOCTYPE with an internal subset", async () => {
    const svg = join(
      '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "b">]><svg viewBox="0 0 1 1"><g/></svg>',
    );
    const { bytes } = await markGeneratedMedia(svg, origin);
    const text = new TextDecoder().decode(bytes);

    expect(text).toContain('<svg viewBox="0 0 1 1"><metadata>');
  });

  it("leaves an SVG alone when its prolog never closes", async () => {
    const svg = join(`<!DOCTYPE[${"<!DOCTYPE[>".repeat(5000)}`);
    const marked = await markGeneratedMedia(svg, origin);

    expect(marked.bytes).toEqual(svg);
  });

  it("declines a self-closing SVG, which has nowhere to hold metadata", async () => {
    const svg = join('<svg viewBox="0 0 1 1"/>');
    const marked = await markGeneratedMedia(svg, origin);

    expect(marked.status).toBe("unsupported");
    expect(marked.bytes).toEqual(svg);
  });

  it("leaves an SVG with a C2PA manifest alone", async () => {
    const svg = join("<svg><metadata><c2pa:manifest>AAAA</c2pa:manifest></metadata></svg>");

    expect((await markGeneratedMedia(svg, origin)).status).toBe("provider-marked");
  });

  it("does not treat an HTML page with inline SVG as SVG", async () => {
    const html = join("<html><body><svg></svg></body></html>");

    expect((await markGeneratedMedia(html, origin)).status).toBe("unsupported");
  });

  it("upgrades a simple WebP so its canvas size survives", async () => {
    const { bytes } = await markGeneratedMedia(lossyWebp(640, 480), origin);
    const view = new DataView(bytes.buffer);

    expect(String.fromCharCode(...bytes.subarray(12, 16))).toBe("VP8X");
    expect(bytes[20]).toBe(0x04);
    expect(view.getUint16(24, true)).toBe(639);
    expect(view.getUint16(27, true)).toBe(479);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
  });

  it("keeps the mark out of the audio when a WAV declares a streaming data size", async () => {
    const wav = riff(
      "WAVE",
      riffChunk("fmt ", new Uint8Array(16)),
      riffChunk("data", [1, 2, 3, 4], 0xffffffff),
    );
    const { bytes } = await markGeneratedMedia(wav, origin);
    const text = new TextDecoder("latin1").decode(bytes);

    expect(text.indexOf("_PMX")).toBeLessThan(text.indexOf("data"));
    expect((await verifyMediaProvenance(bytes))?.contentIntact).toBe(true);
  });

  it("closes a final MP4 box that ran to the end of the file", async () => {
    const mp4 = join(box("ftyp", "isom"), box("mdat", "frames", 0));
    const { bytes } = await markGeneratedMedia(mp4, origin);
    const mdatStart = box("ftyp", "isom").length;

    expect(new DataView(bytes.buffer).getUint32(mdatStart)).toBe(14);
    expect(readMediaProvenance(bytes)).not.toBeNull();
  });

  it("escapes model names so they cannot break out of the packet", async () => {
    const model = 'evil"/><rdf:Injected & more';
    const { bytes } = await markGeneratedMedia(png(), { ...origin, model });

    expect(readMediaProvenance(bytes)?.model).toBe(model);
    expect(new TextDecoder().decode(bytes)).not.toContain("<rdf:Injected");
  });
});

describe("verifyMediaProvenance", () => {
  async function signingPair() {
    const { privateKey, publicKey } = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"],
    );

    return {
      publicKey,
      signer: {
        keyId: "key-1",
        sign: async (message: Uint8Array) =>
          new Uint8Array(
            await crypto.subtle.sign(
              { name: "ECDSA", hash: "SHA-256" },
              privateKey,
              Uint8Array.from(message),
            ),
          ),
      },
    };
  }

  it("accepts a signed file with the matching key", async () => {
    const { publicKey, signer } = await signingPair();
    const { bytes } = await markGeneratedMedia(png(), origin, signer);

    expect(await verifyMediaProvenance(bytes, publicKey)).toMatchObject({
      contentIntact: true,
      signatureValid: true,
    });
  });

  it("rejects a signature from another key", async () => {
    const { signer } = await signingPair();
    const { publicKey: otherKey } = await signingPair();
    const { bytes } = await markGeneratedMedia(png(), origin, signer);

    expect((await verifyMediaProvenance(bytes, otherKey))?.signatureValid).toBe(false);
  });

  it("detects a changed file", async () => {
    const { bytes } = await markGeneratedMedia(png(), origin);
    const tampered = new Uint8Array(bytes);

    tampered[tampered.length - 20] = (tampered[tampered.length - 20] ?? 0) ^ 0xff;

    expect((await verifyMediaProvenance(tampered))?.contentIntact).toBe(false);
  });

  it("rejects a record rewritten after signing", async () => {
    const { publicKey, signer } = await signingPair();
    const { bytes } = await markGeneratedMedia(png(), origin, signer);
    const forged = new Uint8Array(bytes);

    forged[Buffer.from(forged).indexOf("acme/image-1") + "acme/image-".length] = 0x32;

    expect(await verifyMediaProvenance(forged, publicKey)).toMatchObject({
      record: { model: "acme/image-2" },
      contentIntact: true,
      signatureValid: false,
    });
  });

  it("reports nothing for a file with no mark", async () => {
    expect(await verifyMediaProvenance(Uint8Array.from(png()))).toBeNull();
  });
});
