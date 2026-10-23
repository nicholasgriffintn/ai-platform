import type { JsonRpcResponse } from "@ngriffin_uk/polychat-schemas";
import { encodeServerSentEvent } from "@ngriffin_uk/polychat-utility-core";

function acceptedMediaTypes(accept: string | null): Set<string> {
  return new Set(
    (accept ?? "")
      .split(",")
      .map((part) => part.split(";")[0]?.trim().toLowerCase() ?? "")
      .filter(Boolean),
  );
}

export function prefersEventStream(accept: string | null): boolean {
  const types = acceptedMediaTypes(accept);

  return types.has("text/event-stream") && !types.has("application/json") && !types.has("*/*");
}

export function toEventStreamResponse(messages: readonly JsonRpcResponse[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const message of messages) {
        controller.enqueue(encodeServerSentEvent(message));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
    },
  });
}
