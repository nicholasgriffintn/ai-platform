import {
  parseServerSentEventBuffer,
  type ServerSentEventParserOptions,
} from "@ngriffin_uk/polychat-utility-core";

export type SseParserOptions<T> = ServerSentEventParserOptions<T>;

export function parseSseBuffer<T>(buffer: string, options: SseParserOptions<T>): string {
  return parseServerSentEventBuffer<T>(buffer, options);
}
