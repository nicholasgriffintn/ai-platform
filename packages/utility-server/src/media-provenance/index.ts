import { decodeBase64Url, encodeBase64Url } from "../base64url.js";
import { toHex } from "../crypto.js";
import {
  detectContainer,
  embedSlot,
  indexOfBytes,
  metadataRegions,
  type ByteRange,
  type MediaContainer,
} from "./containers.js";

export type MediaProvenanceStatus = "marked" | "provider-marked" | "already-marked" | "unsupported";

export interface MediaProvenanceOrigin {
  generator: string;
  model?: string;
  provider?: string;
  mimeType?: string;
}

export type GeneratedMediaOrigin = Omit<MediaProvenanceOrigin, "generator">;

export interface MediaProvenanceSigner {
  keyId: string;
  sign(message: Uint8Array): Promise<Uint8Array>;
}

export interface MarkedMedia {
  bytes: Uint8Array<ArrayBuffer>;
  status: MediaProvenanceStatus;
  container: MediaContainer | null;
  fingerprint: string;
  markId?: string;
}

export interface MediaProvenanceRecord {
  markId: string;
  generator: string;
  model?: string;
  provider?: string;
  createdAt: string;
  contentHash: string;
  exclusion: ByteRange;
  keyId?: string;
  signature?: string;
}

export interface MediaProvenanceVerification {
  record: MediaProvenanceRecord;
  contentIntact: boolean;
  signatureValid: boolean | null;
}

const AI_DIGITAL_SOURCE_TYPE =
  "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";
const MARK_NAMESPACE = "https://polychat.app/ns/provenance/1.0/";
const SIGNATURE_LENGTH = 86;
const HASH_LENGTH = 43;
const OFFSET_DIGITS = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const OWN_MARK = encoder.encode("polychat:MarkId=");
const PACKET_START = encoder.encode("<?xpacket begin");
const PACKET_END = encoder.encode("<?xpacket end");
const AI_SOURCE_TYPE_MARKER = encoder.encode("trainedAlgorithmicMedia");
const JUMBF_BOX = encoder.encode("jumb");
const C2PA_LABEL = encoder.encode("c2pa");
const GIF_C2PA_EXTENSION = encoder.encode("C2PA_GIF");
const RAW_AUDIO_MIME_TYPE = /^audio\/(?:pcm|l16)\b/i;

async function sha256(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

/** Hashes each side of the mark separately so large video never needs a third full copy. */
async function hashOutside(bytes: Uint8Array<ArrayBuffer>, exclusion: ByteRange): Promise<string> {
  const sides = new Uint8Array(64);

  sides.set(await sha256(bytes.subarray(0, exclusion.start)));
  sides.set(await sha256(bytes.subarray(exclusion.start + exclusion.length)), 32);

  return encodeBase64Url(await sha256(sides));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeXml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function formatExclusion({ start, length }: ByteRange): string {
  return `${String(start).padStart(OFFSET_DIGITS, "0")},${String(length).padStart(OFFSET_DIGITS, "0")}`;
}

function signingMessage(record: Omit<MediaProvenanceRecord, "signature">): Uint8Array {
  return encoder.encode(
    JSON.stringify([
      "polychat-provenance-v1",
      record.markId,
      record.generator,
      record.model ?? null,
      record.provider ?? null,
      record.createdAt,
      record.contentHash,
      formatExclusion(record.exclusion),
      record.keyId ?? null,
    ]),
  );
}

function buildPacket(record: MediaProvenanceRecord): Uint8Array {
  const optional = (name: string, value: string | undefined) =>
    value === undefined ? "" : `\n    polychat:${name}="${escapeXml(value)}"`;

  return encoder.encode(
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    xmlns:polychat="${MARK_NAMESPACE}"
    Iptc4xmpExt:DigitalSourceType="${AI_DIGITAL_SOURCE_TYPE}"
    xmp:CreatorTool="${escapeXml(record.generator)}"
    xmp:CreateDate="${record.createdAt}"
    polychat:MarkId="${record.markId}"
    polychat:Generator="${escapeXml(record.generator)}"${optional("Model", record.model)}${optional("Provider", record.provider)}
    polychat:CreatedAt="${record.createdAt}"
    polychat:ContentHash="${record.contentHash}"
    polychat:HashExclusion="${formatExclusion(record.exclusion)}"${optional("KeyId", record.keyId)}${optional("Signature", record.signature)}/>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="r"?>`,
  );
}

function regionsContain(regions: Uint8Array[], needle: Uint8Array): boolean {
  return regions.some((region) => indexOfBytes(region, needle) !== -1);
}

function hasC2paManifest(regions: Uint8Array[]): boolean {
  return regions.some(
    (region) =>
      indexOfBytes(region, GIF_C2PA_EXTENSION) !== -1 ||
      (indexOfBytes(region, JUMBF_BOX) !== -1 && indexOfBytes(region, C2PA_LABEL) !== -1),
  );
}

function readAttribute(packet: string, name: string): string | undefined {
  const value = new RegExp(`polychat:${name}="([^"]*)"`).exec(packet)?.[1];

  return value === undefined ? undefined : unescapeXml(value);
}

function parsePacket(packet: string): MediaProvenanceRecord | null {
  const markId = readAttribute(packet, "MarkId");
  const generator = readAttribute(packet, "Generator");
  const createdAt = readAttribute(packet, "CreatedAt");
  const contentHash = readAttribute(packet, "ContentHash");
  const [start, length] = (readAttribute(packet, "HashExclusion") ?? "").split(",").map(Number);

  if (!markId || !generator || !createdAt || !contentHash || start === undefined || !length) {
    return null;
  }

  return {
    markId,
    generator,
    model: readAttribute(packet, "Model"),
    provider: readAttribute(packet, "Provider"),
    createdAt,
    contentHash,
    exclusion: { start, length },
    keyId: readAttribute(packet, "KeyId"),
    signature: readAttribute(packet, "Signature"),
  };
}

export function readMediaProvenance(bytes: Uint8Array): MediaProvenanceRecord | null {
  const container = detectContainer(bytes);

  if (!container) {
    return null;
  }

  for (const region of metadataRegions(container, bytes)) {
    const mark = indexOfBytes(region, OWN_MARK);

    if (mark === -1) {
      continue;
    }

    const packetEnd = indexOfBytes(region, PACKET_END, mark);
    let packetStart = -1;

    for (
      let next = indexOfBytes(region, PACKET_START);
      next !== -1 && next < mark;
      next = indexOfBytes(region, PACKET_START, next + 1)
    ) {
      packetStart = next;
    }

    if (packetStart !== -1 && packetEnd !== -1) {
      return parsePacket(decoder.decode(region.subarray(packetStart, packetEnd)));
    }
  }

  return null;
}

async function fingerprintOf(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return toHex(await sha256(bytes));
}

/**
 * Embeds a signed XMP mark without touching encoded samples. A C2PA manifest binds a hash of the
 * file, so any file that already declares its origin is returned byte for byte.
 */
export async function markGeneratedMedia(
  data: ArrayBuffer | Uint8Array,
  origin: MediaProvenanceOrigin,
  signer?: MediaProvenanceSigner,
): Promise<MarkedMedia> {
  const input = new Uint8Array(data);
  const container = RAW_AUDIO_MIME_TYPE.test(origin.mimeType ?? "") ? null : detectContainer(input);

  if (!container) {
    return {
      bytes: input,
      status: "unsupported",
      container,
      fingerprint: await fingerprintOf(input),
    };
  }

  const regions = metadataRegions(container, input);
  const unchanged = async (status: MediaProvenanceStatus): Promise<MarkedMedia> => ({
    bytes: input,
    status,
    container,
    fingerprint: await fingerprintOf(input),
    markId: status === "already-marked" ? readMediaProvenance(input)?.markId : undefined,
  });

  if (regionsContain(regions, OWN_MARK)) {
    return unchanged("already-marked");
  }

  if (hasC2paManifest(regions) || regionsContain(regions, AI_SOURCE_TYPE_MARKER)) {
    return unchanged("provider-marked");
  }

  const draft: MediaProvenanceRecord = {
    markId: crypto.randomUUID(),
    generator: origin.generator,
    model: origin.model,
    provider: origin.provider,
    createdAt: new Date().toISOString(),
    contentHash: "0".repeat(HASH_LENGTH),
    exclusion: { start: 0, length: 0 },
    keyId: signer?.keyId,
    signature: signer ? "0".repeat(SIGNATURE_LENGTH) : undefined,
  };
  const packetLength = buildPacket(draft).length;
  const slot = embedSlot(container, input, packetLength);
  const record: MediaProvenanceRecord = { ...draft, exclusion: slot.exclusion };

  record.contentHash = await hashOutside(slot.bytes, slot.exclusion);

  if (signer) {
    const { signature: _unsigned, ...unsigned } = record;

    record.signature = encodeBase64Url(await signer.sign(signingMessage(unsigned)));
  }

  slot.write(buildPacket(record));

  return {
    bytes: slot.bytes,
    status: "marked",
    container,
    fingerprint: await fingerprintOf(slot.bytes),
    markId: record.markId,
  };
}

export async function verifyMediaProvenance(
  bytes: Uint8Array<ArrayBuffer>,
  publicKey?: CryptoKey,
): Promise<MediaProvenanceVerification | null> {
  const record = readMediaProvenance(bytes);

  if (!record) {
    return null;
  }

  const contentIntact = (await hashOutside(bytes, record.exclusion)) === record.contentHash;

  if (!publicKey || !record.signature) {
    return { record, contentIntact, signatureValid: null };
  }

  const { signature, ...unsigned } = record;
  const signatureValid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    Uint8Array.from(decodeBase64Url(signature)),
    Uint8Array.from(signingMessage(unsigned)),
  );

  return { record, contentIntact, signatureValid };
}
