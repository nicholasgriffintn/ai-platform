export async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));

  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const FNV_64_PRIME = 0x100000001b3n;
const FNV_64_OFFSET = 0xcbf29ce484222325n;
const UINT64_MASK = 0xffffffffffffffffn;

export function fnv1a64Hex(input: string, seed = ""): string {
  let hash = FNV_64_OFFSET;

  for (const byte of new TextEncoder().encode(`${seed}${input}`)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_64_PRIME) & UINT64_MASK;
  }

  return hash.toString(16).padStart(16, "0");
}

export function randomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
