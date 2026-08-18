import type { ExecutionContext } from "@cloudflare/workers-types";

import { isRecord } from "~/utils/objects";

export function requireCloudflareExecutionContext(value: unknown): ExecutionContext {
  if (!isCloudflareExecutionContext(value)) {
    throw new TypeError("Expected a Cloudflare Workers ExecutionContext");
  }

  return value;
}

function isCloudflareExecutionContext(value: unknown): value is ExecutionContext {
  return isRecord(value) && typeof value.waitUntil === "function";
}
