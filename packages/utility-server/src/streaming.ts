import {
  parseServerSentEventBuffer,
  type ServerSentEventParserOptions,
} from "@ngriffin_uk/polychat-utility-core";

export function detectStreaming(body: Record<string, any>, endpoint: string) {
  const isStreaming = body?.stream === true;
  const isEndpointStreaming =
    endpoint.includes("streamGenerateContent") || endpoint.includes("converse-stream");

  return isStreaming || isEndpointStreaming;
}

export type SseParserOptions = ServerSentEventParserOptions<Record<string, unknown>>;

export function parseSseBuffer(buffer: string, options: SseParserOptions): string {
  return parseServerSentEventBuffer(buffer, options);
}
