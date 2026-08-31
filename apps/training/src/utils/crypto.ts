import { createHash, createHmac, timingSafeEqual } from "crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Compare digests rather than the raw values so neither the outcome nor the
// secret's length is observable in the time this takes.
export function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}

export function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

export function hmacHex(key: string | Buffer, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}
