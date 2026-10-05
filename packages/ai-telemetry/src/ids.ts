import { sha256Hex } from "@ngriffin_uk/polychat-utility-core";

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);

  crypto.getRandomValues(buffer);

  return Array.from(buffer, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function createTraceId(): string {
  return randomHex(16);
}

export function createSpanId(): string {
  return randomHex(8);
}

export async function normaliseOtlpId(value: string, kind: "trace" | "span"): Promise<string> {
  const length = kind === "trace" ? 32 : 16;

  if (value.length === length && /^[a-f0-9]+$/i.test(value) && !/^0+$/.test(value)) {
    return value.toLowerCase();
  }

  return (await sha256Hex(`polychat:${kind}:${value}`)).slice(0, length);
}
