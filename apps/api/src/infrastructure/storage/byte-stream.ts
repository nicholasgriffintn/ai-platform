import type { R2ObjectBody } from "@cloudflare/workers-types";

export type ByteStream = ReadableStream | R2ObjectBody["body"];

/** DOM and Workers typings describe the same runtime class but are not assignable to each other. */
export function isByteStream(
  value: unknown,
): value is ReadableStream<Uint8Array> & R2ObjectBody["body"] {
  return value instanceof ReadableStream;
}
