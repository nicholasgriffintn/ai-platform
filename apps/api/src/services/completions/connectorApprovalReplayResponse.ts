import { createEventData, encodeEventData } from "~/lib/chat/streaming/emitter";
import type { ApprovedConnectorReplay } from "~/services/apps/connectors/approved-operation-replay";
import type { Message } from "~/types";

export function prependConnectorReplayToStream(params: {
  stream: ReadableStream<Uint8Array>;
  toolCall: ApprovedConnectorReplay["toolCall"];
  toolResult: Message;
}): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encodeEventData(createEventData("tool_response_start", { tool_calls: [params.toolCall] })),
      );
      controller.enqueue(
        encodeEventData(
          createEventData("tool_response", {
            tool_id: params.toolResult.id,
            result: params.toolResult,
          }),
        ),
      );
      controller.enqueue(encodeEventData(createEventData("tool_response_end")));

      reader = params.stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          controller.enqueue(value);
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        reader = undefined;
      }
    },
    cancel(reason) {
      return reader?.cancel(reason) ?? params.stream.cancel(reason);
    },
  });
}
