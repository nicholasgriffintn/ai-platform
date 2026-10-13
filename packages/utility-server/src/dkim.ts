import { base64ToBuffer, bufferToBase64 } from "./base64.js";

export type TxtResolver = (name: string) => Promise<string[]>;

export interface DkimVerification {
  domain: string;
  signedHeaders: string[];
}

type Canonicalisation = "simple" | "relaxed";

interface HeaderField {
  name: string;
  raw: string;
}

interface DkimSignature {
  algorithm: "rsa-sha256" | "ed25519-sha256";
  signature: Uint8Array<ArrayBuffer>;
  bodyHash: string;
  domain: string;
  selector: string;
  signedHeaders: string[];
  headerCanonicalisation: Canonicalisation;
  bodyCanonicalisation: Canonicalisation;
  expiresAt?: number;
}

const DNS_LABEL_PATTERN = /^[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9])?$/i;
const TAG_NAME_PATTERN = /^[a-z][a-z0-9_]*$/i;
const MIN_RSA_MODULUS_BITS = 1024;

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return binary;
}

function binaryToBytes(binary: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

function isDnsName(value: string): boolean {
  const labels = value.split(".");

  return (
    value.length <= 253 &&
    labels.length > 0 &&
    labels.every((label) => DNS_LABEL_PATTERN.test(label))
  );
}

function parseTagList(value: string): Map<string, string> | null {
  const tags = new Map<string, string>();

  for (const part of value.split(";")) {
    if (!part.trim()) {
      continue;
    }

    const separator = part.indexOf("=");

    if (separator < 0) {
      return null;
    }

    const name = part.slice(0, separator).trim();

    if (!TAG_NAME_PATTERN.test(name) || tags.has(name)) {
      return null;
    }

    tags.set(name, part.slice(separator + 1).trim());
  }

  return tags;
}

function splitMessage(raw: Uint8Array): {
  headers: HeaderField[];
  body: string;
} {
  const message = bytesToBinary(raw).replace(/\r?\n/g, "\r\n");
  const boundary = message.indexOf("\r\n\r\n");
  const headerBlock = boundary < 0 ? message : message.slice(0, boundary);
  const body = boundary < 0 ? "" : message.slice(boundary + 4);
  const headers: HeaderField[] = [];

  for (const line of headerBlock.split("\r\n")) {
    if (/^[ \t]/.test(line) && headers.length > 0) {
      headers[headers.length - 1].raw += `\r\n${line}`;
      continue;
    }

    const colon = line.indexOf(":");

    if (colon > 0) {
      headers.push({
        name: line.slice(0, colon).trim().toLowerCase(),
        raw: line,
      });
    }
  }

  return { headers, body };
}

function canonicaliseHeader(raw: string, mode: Canonicalisation): string {
  if (mode === "simple") {
    return raw;
  }

  const colon = raw.indexOf(":");
  const name = raw.slice(0, colon).trim().toLowerCase();
  const value = raw
    .slice(colon + 1)
    .replace(/\r\n/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

  return `${name}:${value}`;
}

function canonicaliseBody(body: string, mode: Canonicalisation): string {
  const lines = body.split("\r\n");
  const canonical =
    mode === "relaxed"
      ? lines.map((line) => line.replace(/[ \t]+/g, " ").replace(/ $/, ""))
      : lines;

  while (canonical.length > 0 && canonical[canonical.length - 1] === "") {
    canonical.pop();
  }

  if (canonical.length === 0) {
    return mode === "relaxed" ? "" : "\r\n";
  }

  return `${canonical.join("\r\n")}\r\n`;
}

function isCanonicalisation(value: string): value is Canonicalisation {
  return value === "simple" || value === "relaxed";
}

function parseCanonicalisation(
  value: string | undefined,
): [Canonicalisation, Canonicalisation] | null {
  const [header = "simple", body = "simple"] = (value ?? "simple/simple").split("/");

  return isCanonicalisation(header) && isCanonicalisation(body) ? [header, body] : null;
}

function parseSignature(field: HeaderField): DkimSignature | null {
  const tags = parseTagList(field.raw.slice(field.raw.indexOf(":") + 1).replace(/\r\n/g, ""));

  if (!tags || tags.get("v") !== "1" || tags.has("l")) {
    return null;
  }

  const algorithm = tags.get("a");
  const domain = tags.get("d")?.toLowerCase();
  const selector = tags.get("s")?.toLowerCase();
  const signature = tags.get("b")?.replace(/\s/g, "");
  const bodyHash = tags.get("bh")?.replace(/\s/g, "");
  const signedHeaders = tags
    .get("h")
    ?.split(":")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const canonicalisation = parseCanonicalisation(tags.get("c"));
  const expiry = tags.has("x") ? Number(tags.get("x")) : undefined;

  if (
    (algorithm !== "rsa-sha256" && algorithm !== "ed25519-sha256") ||
    !domain ||
    !selector ||
    !isDnsName(domain) ||
    !isDnsName(selector) ||
    !signature ||
    !bodyHash ||
    !signedHeaders?.includes("from") ||
    !canonicalisation ||
    (expiry !== undefined && !Number.isSafeInteger(expiry))
  ) {
    return null;
  }

  return {
    algorithm,
    signature: base64ToBuffer(signature),
    bodyHash,
    domain,
    selector,
    signedHeaders,
    headerCanonicalisation: canonicalisation[0],
    bodyCanonicalisation: canonicalisation[1],
    ...(expiry !== undefined ? { expiresAt: expiry } : {}),
  };
}

function buildSignedData(
  headers: HeaderField[],
  signatureField: HeaderField,
  signature: DkimSignature,
): Uint8Array<ArrayBuffer> {
  const used = new Set<HeaderField>();
  const lines: string[] = [];

  for (const name of signature.signedHeaders) {
    const field = [...headers]
      .reverse()
      .find((header) => header.name === name && !used.has(header));

    if (field) {
      used.add(field);
      lines.push(`${canonicaliseHeader(field.raw, signature.headerCanonicalisation)}\r\n`);
    }
  }

  const colon = signatureField.raw.indexOf(":");
  const unsigned = `${signatureField.raw.slice(0, colon + 1)}${signatureField.raw
    .slice(colon + 1)
    .replace(/(^|;)(\s*b\s*=)[^;]*/, "$1$2")}`;

  lines.push(canonicaliseHeader(unsigned, signature.headerCanonicalisation));

  return binaryToBytes(lines.join(""));
}

async function importPublicKey(
  record: Map<string, string>,
  algorithm: DkimSignature["algorithm"],
): Promise<CryptoKey | null> {
  const keyType = record.get("k") ?? "rsa";
  const publicKey = record.get("p")?.replace(/\s/g, "");
  const version = record.get("v");

  if (!publicKey || (version !== undefined && version !== "DKIM1")) {
    return null;
  }

  if (algorithm === "ed25519-sha256" && keyType === "ed25519") {
    return crypto.subtle.importKey("raw", base64ToBuffer(publicKey), { name: "Ed25519" }, false, [
      "verify",
    ]);
  }

  if (algorithm === "rsa-sha256" && keyType === "rsa") {
    const key = await crypto.subtle.importKey(
      "spki",
      base64ToBuffer(publicKey),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const { algorithm: keyAlgorithm } = key;

    return "modulusLength" in keyAlgorithm &&
      typeof keyAlgorithm.modulusLength === "number" &&
      keyAlgorithm.modulusLength >= MIN_RSA_MODULUS_BITS
      ? key
      : null;
  }

  return null;
}

async function verifyWithKey(
  key: CryptoKey,
  signature: DkimSignature,
  data: Uint8Array<ArrayBuffer>,
): Promise<boolean> {
  if (signature.algorithm === "ed25519-sha256") {
    return crypto.subtle.verify({ name: "Ed25519" }, key, signature.signature, await sha256(data));
  }

  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature.signature, data);
}

async function verifySignature(params: {
  headers: HeaderField[];
  body: string;
  field: HeaderField;
  resolveTxt: TxtResolver;
  now: number;
}): Promise<DkimVerification | null> {
  const signature = parseSignature(params.field);

  if (!signature || (signature.expiresAt !== undefined && signature.expiresAt < params.now)) {
    return null;
  }

  const bodyHash = bufferToBase64(
    await sha256(binaryToBytes(canonicaliseBody(params.body, signature.bodyCanonicalisation))),
  );

  if (bodyHash !== signature.bodyHash) {
    return null;
  }

  const records = await params.resolveTxt(`${signature.selector}._domainkey.${signature.domain}`);
  const data = buildSignedData(params.headers, params.field, signature);

  for (const value of records) {
    const record = parseTagList(value);
    const key = record
      ? await importPublicKey(record, signature.algorithm).catch(() => null)
      : null;

    if (key && (await verifyWithKey(key, signature, data).catch(() => false))) {
      return {
        domain: signature.domain,
        signedHeaders: [...new Set(signature.signedHeaders)],
      };
    }
  }

  return null;
}

export async function verifyDkimSignatures(
  raw: Uint8Array,
  resolveTxt: TxtResolver,
  now: number = Math.floor(Date.now() / 1000),
): Promise<DkimVerification[]> {
  const { headers, body } = splitMessage(raw);
  const signatures = headers.filter((header) => header.name === "dkim-signature");
  const verified = await Promise.all(
    signatures.map((field) =>
      verifySignature({ headers, body, field, resolveTxt, now }).catch(() => null),
    ),
  );

  return verified.filter((result): result is DkimVerification => result !== null);
}

export function isDkimAligned(fromDomain: string, signingDomain: string): boolean {
  const from = fromDomain.toLowerCase();
  const signer = signingDomain.toLowerCase();

  return from === signer || from.endsWith(`.${signer}`);
}
