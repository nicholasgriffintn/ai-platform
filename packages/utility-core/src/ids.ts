export function randomHex(len: number): string {
  const webCrypto = (
    globalThis as {
      crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
    }
  ).crypto;

  if (typeof webCrypto?.getRandomValues !== "function") {
    throw new Error("Secure random generator unavailable");
  }

  const bytes = new Uint8Array(Math.ceil(len / 2));

  webCrypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, len)
    .toUpperCase();
}

export function randomUUIDLike(): string {
  return [8, 4, 4, 4, 12].map((n) => randomHex(n)).join("-");
}

export function generateId(): string {
  const webCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  return randomUUIDLike();
}

export function generatePrefixedId(prefix: string): string {
  if (!/^[a-z][a-z0-9]*_$/.test(prefix)) {
    throw new Error("ID prefix must be lowercase alphanumeric and end with an underscore");
  }

  return `${prefix}${generateId()}`;
}
