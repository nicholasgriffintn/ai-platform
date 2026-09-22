import {
  parseServerSentEventBuffer,
  type ServerSentEventParserOptions,
} from "@ngriffin_uk/polychat-utility-core";

export type SseParserOptions = ServerSentEventParserOptions<Record<string, unknown>>;

export const parseSseBuffer: (buffer: string, options: SseParserOptions) => string =
  parseServerSentEventBuffer;

export function detectStreaming(body: Record<string, any>, endpoint: string) {
  const isStreaming = body?.stream === true;
  const isEndpointStreaming =
    endpoint.includes("streamGenerateContent") || endpoint.includes("converse-stream");

  return isStreaming || isEndpointStreaming;
}
