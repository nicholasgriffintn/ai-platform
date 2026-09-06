import type z from "zod/v4";

import { handleRecordingTranscribe } from "~/services/apps/recordings/transcribe";
import type { IFunctionResponse } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { AssistantError, ErrorType } from "~/utils/errors";

import {
  process_recording as processRecordingDescriptor,
  type processRecordingInputSchema,
} from "./definitions/process_recording";
import { resolveRequestProjectId } from "./request-context";

export const process_recording: ApiToolDefinition = {
  ...processRecordingDescriptor,
  execute: async (args: z.infer<typeof processRecordingInputSchema>, toolContext) => {
    const request = toolContext.request;
    const user = request.user;

    if (!user?.id) {
      throw new AssistantError(
        "Transcribing a recording needs a signed-in user",
        ErrorType.AUTHENTICATION_ERROR,
        401,
      );
    }

    const projectId = resolveRequestProjectId(request);
    const result = await handleRecordingTranscribe({
      ...(request.context ? { context: request.context } : {}),
      ...(request.env ? { env: request.env } : {}),
      request: {
        recordingId: args.recordingId,
        numberOfSpeakers: args.speakers,
        prompt: args.prompt,
      },
      user,
      ...(request.app_url ? { app_url: request.app_url } : {}),
      ...(projectId ? { projectId } : {}),
    });
    const response = Array.isArray(result) ? result[0] : result;

    return {
      status: "success",
      name: processRecordingDescriptor.name,
      content: response?.content ?? "Started transcribing the recording.",
      data: response?.data ?? {},
    } satisfies IFunctionResponse;
  },
};
