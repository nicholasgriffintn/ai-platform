async function digestHex(algorithm: "SHA-1" | "SHA-256", input: string): Promise<string> {
  const hash = await crypto.subtle.digest(algorithm, new TextEncoder().encode(input));

  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sha256Hex(input: string): Promise<string> {
  return digestHex("SHA-256", input);
}

export async function sha256Base64Url(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));

  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function sha1Hex(input: string): Promise<string> {
  return digestHex("SHA-1", input);
}

export function randomUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}
