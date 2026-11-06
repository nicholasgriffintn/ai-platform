import type { R2ObjectBody } from "@cloudflare/workers-types";

export type ByteStream = ReadableStream | R2ObjectBody["body"];

export function isByteStream(
  value: unknown,
): value is ReadableStream<Uint8Array> & R2ObjectBody["body"] {
  return value instanceof ReadableStream;
}
