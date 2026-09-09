import { createHash, generateKeyPairSync, randomBytes, webcrypto } from "node:crypto";

export const NOW = new Date();
export const SEED_MODEL = "@cf/openai/gpt-oss-120b";
export const SEED_MODEL_SMALL = "@cf/openai/gpt-oss-20b";
export const SEED_PREFIX = "seed";

export function seedId(...parts) {
  return [SEED_PREFIX, ...parts].join("-");
}

export function at({ days = 0, hours = 0, minutes = 0, seconds = 0 } = {}) {
  const time = NOW.getTime() - ((days * 24 + hours) * 60 + minutes) * 60_000 - seconds * 1000;

  return new Date(time).toISOString();
}

export function ahead({ days = 0, hours = 0, minutes = 0 } = {}) {
  return new Date(NOW.getTime() + ((days * 24 + hours) * 60 + minutes) * 60_000).toISOString();
}

export function shift(iso, { minutes = 0, seconds = 0 } = {}) {
  return new Date(Date.parse(iso) + minutes * 60_000 + seconds * 1000).toISOString();
}

export function period(date = NOW) {
  return date.toISOString().slice(0, 7);
}

export function credits(amount) {
  return Math.round(amount * 1_000_000);
}

export function sqlValue(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (typeof value === "string") {
    return `'${value.replaceAll("'", "''")}'`;
  }

  return sqlValue(JSON.stringify(value));
}

export function insert(table, row, { replace = false } = {}) {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined);
  const columns = entries.map(([column]) => `"${column}"`).join(", ");
  const values = entries.map(([, value]) => sqlValue(value)).join(", ");

  return `INSERT ${replace ? "OR REPLACE " : ""}INTO "${table}" (${columns}) VALUES (${values});`;
}

export function sha256Hex(input) {
  return createHash("sha256").update(input).digest("hex");
}

export function sha256Base64Url(input) {
  return createHash("sha256").update(input).digest("base64url");
}

export function randomToken(bytes = 24) {
  return randomBytes(bytes).toString("base64url");
}

async function importServerKey(privateKeyBase64) {
  return webcrypto.subtle.importKey(
    "raw",
    Buffer.from(privateKeyBase64, "base64"),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
}

export async function encryptWithServerKey(privateKeyBase64, plaintext) {
  const key = await importServerKey(privateKeyBase64);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const data = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return JSON.stringify({
    iv: Buffer.from(iv).toString("base64"),
    data: Buffer.from(data).toString("base64"),
  });
}

export async function createUserKeyPair(privateKeyBase64) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
  const publicJwk = JSON.stringify(publicKey.export({ format: "jwk" }));
  const privateJwk = JSON.stringify(privateKey.export({ format: "jwk" }));

  return {
    publicKey: publicJwk,
    privateKey: await encryptWithServerKey(privateKeyBase64, privateJwk),
  };
}

const SILENT_WAV = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQAAAAA=";

export const SILENT_AUDIO_DATA_URL = `data:audio/wav;base64,${SILENT_WAV}`;

export function svgDataUrl(label, fill = "#2563EB") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${fill}"/><text x="50%" y="50%" fill="#fff" font-family="sans-serif" font-size="32" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
