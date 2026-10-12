import type { VerbatimStreamEvent } from "@ngriffin_uk/polychat-schemas";
import {
  encodeServerSentEvent,
  encodeServerSentEventDone,
} from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import { sseResponse } from "~/infrastructure/http/streaming";
import type { IEnv, IUser } from "~/types";

import { assertVerbatimSegmentSize, transcribeVerbatimSegment } from "./transcribe-segment";

export function streamVerbatimSegment(options: {
  env: IEnv;
  user: IUser;
  audio: File;
  context?: string;
}): Response {
  assertVerbatimSegmentSize(options.audio);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: VerbatimStreamEvent) => {
        controller.enqueue(encodeServerSentEvent(event));
      };

      try {
        const segment = await transcribeVerbatimSegment({
          ...options,
          onDraft: (text) => emit({ type: "draft", text }),
        });

        emit({ type: "segment", segment });
      } catch (error) {
        emit({ type: "error", error: getErrorMessage(error) });
      } finally {
        controller.enqueue(encodeServerSentEventDone());
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
