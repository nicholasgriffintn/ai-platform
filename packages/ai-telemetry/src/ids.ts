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
