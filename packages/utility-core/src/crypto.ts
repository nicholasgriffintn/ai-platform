async function digestHex(algorithm: "SHA-1" | "SHA-256", input: string): Promise<string> {
  const hash = await crypto.subtle.digest(algorithm, new TextEncoder().encode(input));

  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sha256Hex(input: string): Promise<string> {
  return digestHex("SHA-256", input);
}

export function sha1Hex(input: string): Promise<string> {
  return digestHex("SHA-1", input);
}

export function randomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
