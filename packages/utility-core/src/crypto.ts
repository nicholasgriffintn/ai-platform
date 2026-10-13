export async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));

  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
