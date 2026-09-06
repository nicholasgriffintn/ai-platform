import type { AsyncInvocationMetadata } from "~/lib/async/asyncInvocation";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { OutputRepository } from "~/repositories/OutputRepository";
import { TaskRepository } from "~/repositories/TaskRepository";
import type { IEnv } from "~/types";
import { safeParseJson } from "~/utils/json";
import { getLogger } from "~/utils/logger";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";
import { TaskService } from "../TaskService";
import { getNextPollingSchedule } from "./polling";

const logger = getLogger({
  prefix: "services/tasks/recording-transcription-polling",
});

interface RecordingTranscriptionPollingData {
  recordingId: string;
  userId: number;
  projectId?: string;
  startedAt: string;
  pollAttempt?: number;
}

export class RecordingTranscriptionPollingHandler implements TaskHandler {
  public async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    try {
      const data = message.task_data as RecordingTranscriptionPollingData;

      if (!data.recordingId || !data.userId) {
        return {
          status: "error",
          message: "recordingId and userId are required for recording polling",
        };
      }

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

      const polling = getNextPollingSchedule(data.pollAttempt);
      const taskRepository = new TaskRepository(env);
      const taskService = new TaskService(env, taskRepository);

      await taskService.enqueueTask({
        task_type: "recording_transcription_polling",
        user_id: message.user_id,
        task_data: {
          ...data,
          pollAttempt: polling.pollAttempt,
        },
        schedule_type: "scheduled",
        scheduled_at: polling.scheduledAt,
        priority: message.priority || 5,
      });

      return {
        status: "success",
        message: "Recording transcription still in progress, re-queued",
        data: { recordingId: data.recordingId },
      };
    } catch (error) {
      logger.error("Recording transcription polling error:", error);

      return {
        status: "error",
        message: (error as Error).message,
      };
    }
  }
}
