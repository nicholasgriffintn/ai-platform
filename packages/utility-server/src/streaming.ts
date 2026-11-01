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

export function failWhenQuiet<T>(
  stream: ReadableStream<T>,
  quietMs: number,
  message: string,
): ReadableStream<T> {
  const reader = stream.getReader();

  return new ReadableStream<T>({
    async pull(controller) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const quiet = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), quietMs);
      });

      try {
        const next = await Promise.race([reader.read(), quiet]);

        if (next.done) {
          controller.close();
        } else {
          controller.enqueue(next.value);
        }
      } catch (error) {
        await reader.cancel(error).catch(() => {});
        controller.error(error);
      } finally {
        clearTimeout(timer);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
