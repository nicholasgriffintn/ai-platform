export function generateId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 10);
}

export function randomHex(len: number): string {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, len)
    .toUpperCase();
}

export function randomUUIDLike(): string {
  return [8, 4, 4, 4, 12].map((n) => randomHex(n)).join("-");
}
