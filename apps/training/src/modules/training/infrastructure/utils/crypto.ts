import { createHash, timingSafeEqual } from "crypto";

export function constantTimeEqual(left: string, right: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(left).digest(),
    createHash("sha256").update(right).digest(),
  );
}
