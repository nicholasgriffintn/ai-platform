const encoder = new TextEncoder();

export function encodeServerSentEvent(value: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
}

export function encodeServerSentEventComment(value: string): Uint8Array {
  return encoder.encode(`: ${value}\n\n`);
}

export function encodeServerSentEventDone(): Uint8Array {
  return encoder.encode("data: [DONE]\n\n");
}
