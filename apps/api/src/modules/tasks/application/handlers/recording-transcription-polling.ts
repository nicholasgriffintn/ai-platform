import type { AsyncInvocationMetadata } from "@ngriffin_uk/polychat-ai-providers";
import { PENDING } from "@ngriffin_uk/polychat-ai-workflows";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { z } from "zod/v4";

import { getChatProvider } from "~/infrastructure/providers/capabilities/chat";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";

import { definePoll } from "../workflows";

export const recordingTranscriptionPolling = definePoll({
  payload: z.object({
    recordingId: z.string().min(1),
    userId: z.number(),
    projectId: z.string().optional(),
    startedAt: z.string().optional(),
    pollAttempt: z.number().optional(),
  }),
  check: async (data, { env }) => {
    const outputRepo = new OutputRepository(env);
    const records = data.projectId
      ? await outputRepo.listProjectOutputGroup(
          data.projectId,
          "recordings",
          data.recordingId,
          "transcribe",
        )
      : await outputRepo.listPersonalOutputGroup(
          data.userId,
          "recordings",
          data.recordingId,
          "transcribe",
        );
    const transcriptionRecord = records[0];

    if (!transcriptionRecord) {
      return {
        status: "error",
        message: `Recording transcription ${data.recordingId} not found`,
      };
    }

    const transcriptionData = safeParseJson<Record<string, any>>(transcriptionRecord.content);

    if (!transcriptionData) {
      return {
        status: "error",
        message: "Invalid recording transcription data",
      };
    }

    const asyncInvocation = transcriptionData.transcriptionData?.data?.asyncInvocation as
      | AsyncInvocationMetadata
      | undefined;

    if (!asyncInvocation || transcriptionData.status !== "pending") {
      return {
        status: "success",
        message: "Recording transcription is not pending",
        data: {
          recordingId: data.recordingId,
          status: transcriptionData.status,
        },
      };
    }

    const provider = getChatProvider(asyncInvocation.provider || "replicate", {
      env,
      user: undefined,
    });

    if (!provider?.getAsyncInvocationStatus) {
      return {
        status: "error",
        message: "Provider does not support async invocation status",
      };
    }

    const result = await provider.getAsyncInvocationStatus(
      asyncInvocation,
      {
        model: asyncInvocation.context?.version || "",
        env,
        messages: [],
        completion_id: data.recordingId,
      },
      data.userId,
    );

    if (result.status === "completed" && result.result) {
      transcriptionData.status = "complete";
      transcriptionData.transcriptionData = result.result;
      transcriptionData.output = result.result.response;
      await outputRepo.updateOutput(transcriptionRecord.id, {
        status: "ready",
        content: transcriptionData,
        expectedRevision: transcriptionRecord.revision,
        updatedByUserId: data.userId,
      });

      return {
        status: "success",
        message: "Recording transcription completed",
        data: { recordingId: data.recordingId },
      };
    }

    if (result.status === "failed") {
      transcriptionData.status = "failed";
      transcriptionData.error = result.raw?.error || "Transcription failed";
      await outputRepo.updateOutput(transcriptionRecord.id, {
        status: "failed",
        content: transcriptionData,
        expectedRevision: transcriptionRecord.revision,
        updatedByUserId: data.userId,
      });

      return {
        status: "success",
        message: "Recording transcription failed",
        data: {
          recordingId: data.recordingId,
          error: transcriptionData.error,
        },
      };
    }

    return PENDING;
  },
});
