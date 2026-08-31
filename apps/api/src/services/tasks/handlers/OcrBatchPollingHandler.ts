import { OCR_BATCH_POLLING_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { createServiceContext } from "~/lib/context/serviceContext";
import { isOutputDeletionPending } from "~/lib/outputs/deletion";
import {
  cleanupOcrBatchProviderResources,
  getOcrBatchProviderCleanupState as getProviderCleanupState,
  MAX_OCR_BATCH_RESULT_BYTES,
  MistralOcrBatchClient,
  type MistralOcrBatchJob,
  type OcrBatchClient,
  withOcrBatchProviderCleanup as withProviderCleanup,
  withoutOcrBatchProviderCleanup as withoutProviderCleanup,
} from "~/lib/providers/capabilities/ocr/batch/MistralOcrBatchClient";
import { StorageService } from "~/lib/storage";
import { RepositoryManager } from "~/repositories";
import { createOutput, getOutputIncludingDeleting, updateOutput } from "~/services/outputs";
import { requireProjectAccess } from "~/services/workspaces/access";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { ResponseBodyTooLargeError } from "~/utils/http";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import type { TaskHandler, TaskResult } from "../TaskHandler";
import type { TaskMessage } from "../TaskService";
import { TaskService } from "../TaskService";
import { getNextPollingSchedule } from "./polling";

const OCR_BATCH_TIMEOUT_MS = 25 * 60 * 60 * 1000;

export interface OcrBatchPollingData {
  outputId: string;
  jobId: string;
  userId: number;
  projectId?: string;
  model: string;
  startedAt: string;
  pollAttempt: number;
}

interface OcrBatchPollingDependencies {
  batchClient?: OcrBatchClient;
}

function readPollingData(message: TaskMessage): OcrBatchPollingData | null {
  const data = message.task_data as Partial<OcrBatchPollingData>;

  if (
    message.task_type !== OCR_BATCH_POLLING_TASK_TYPE ||
    !data.outputId ||
    !data.jobId ||
    !data.userId ||
    !data.model ||
    !data.startedAt ||
    typeof data.pollAttempt !== "number" ||
    !Number.isInteger(data.pollAttempt) ||
    data.pollAttempt < 0 ||
    message.user_id !== data.userId ||
    (message.project_id ?? undefined) !== data.projectId
  ) {
    return null;
  }

  return data as OcrBatchPollingData;
}

function getSourceIds(content: Record<string, unknown>): string[] {
  if (!Array.isArray(content.inputs)) {
    return [];
  }

  return [
    ...new Set(
      content.inputs.flatMap((input) => {
        if (
          input &&
          typeof input === "object" &&
          "type" in input &&
          input.type === "source" &&
          "resourceId" in input &&
          typeof input.resourceId === "string"
        ) {
          return [input.resourceId];
        }

        return [];
      }),
    ),
  ];
}

async function cleanupStoredProviderBatch(
  batchClient: OcrBatchClient,
  env: IEnv,
  user: NonNullable<Awaited<ReturnType<RepositoryManager["users"]["getUserById"]>>>,
  state: NonNullable<ReturnType<typeof getProviderCleanupState>>,
): Promise<void> {
  await cleanupOcrBatchProviderResources(
    batchClient,
    { env, user },
    {
      id: state.jobId,
      output_file: state.outputFileId,
      error_file: state.errorFileId,
    },
  );
}

async function enqueueOcrBatchReconciliation(
  taskService: TaskService,
  data: OcrBatchPollingData,
  priority = 5,
): Promise<void> {
  const polling = getNextPollingSchedule(data.pollAttempt);

  await taskService.enqueueTask({
    id: `ocr-batch:${data.outputId}:reconcile:${generateId()}`,
    task_type: OCR_BATCH_POLLING_TASK_TYPE,
    user_id: data.userId,
    project_id: data.projectId,
    task_data: { ...data, pollAttempt: polling.pollAttempt },
    schedule_type: "scheduled",
    scheduled_at: polling.scheduledAt,
    priority,
  });
}

export class OcrBatchPollingHandler implements TaskHandler {
  constructor(private readonly dependencies: OcrBatchPollingDependencies = {}) {}

  async handle(message: TaskMessage, env: IEnv): Promise<TaskResult> {
    const data = readPollingData(message);

    if (!data) {
      return { status: "error", message: "Invalid OCR batch polling task" };
    }

    const repositories = new RepositoryManager(env);
    const user = await repositories.users.getUserById(data.userId);

    if (!user) {
      return { status: "error", message: "OCR batch user no longer exists" };
    }

    const context = createServiceContext({ env, user });

    if (data.projectId) {
      await requireProjectAccess(context, data.projectId);
    }

    const output = await getOutputIncludingDeleting(context, user.id, data.outputId);

    if (
      output.capabilityId !== "ocr" ||
      output.kind !== "ocr_batch" ||
      output.createdByUserId !== data.userId ||
      (output.projectId ?? undefined) !== data.projectId ||
      output.content.providerJobId !== data.jobId
    ) {
      return {
        status: "skipped",
        message: "OCR batch is no longer pending",
        data: { outputId: data.outputId },
      };
    }

    const batchClient = this.dependencies.batchClient ?? new MistralOcrBatchClient();
    const cleanupState = getProviderCleanupState(output.content);

    if (cleanupState) {
      if (cleanupState.jobId !== data.jobId) {
        return { status: "error", message: "OCR batch cleanup job does not match its Output" };
      }

      await cleanupStoredProviderBatch(batchClient, env, user, cleanupState);
      await updateOutput(context, user.id, output.id, {
        status: output.status,
        expectedRevision: output.revision,
        content: withoutProviderCleanup(output.content),
      });

      return {
        status: "success",
        message: "OCR batch provider cleanup completed",
        data: { outputId: output.id },
      };
    }

    if (output.status !== "pending") {
      return {
        status: "skipped",
        message: "OCR batch is no longer pending",
        data: { outputId: data.outputId },
      };
    }

    const startedAt = Date.parse(data.startedAt);

    if (!Number.isFinite(startedAt) || Date.now() - startedAt > OCR_BATCH_TIMEOUT_MS) {
      const cancelledJob = await batchClient.cancel({ env, user, jobId: data.jobId });

      if (["QUEUED", "RUNNING", "CANCELLATION_REQUESTED"].includes(cancelledJob.status)) {
        const pendingOutput = await updateOutput(context, user.id, output.id, {
          status: "pending",
          expectedRevision: output.revision,
          content: {
            ...output.content,
            batchStatus: "cleanup_pending",
            error: "OCR batch exceeded its 25-hour polling window",
          },
        });
        const polling = getNextPollingSchedule(data.pollAttempt);
        const taskService = new TaskService(env, context.repositories.tasks);

        await taskService.enqueueTask({
          id: `ocr-batch:${data.outputId}:cleanup:${pendingOutput.revision}`,
          task_type: OCR_BATCH_POLLING_TASK_TYPE,
          user_id: data.userId,
          project_id: data.projectId,
          task_data: { ...data, pollAttempt: polling.pollAttempt },
          schedule_type: "scheduled",
          scheduled_at: polling.scheduledAt,
          priority: message.priority || 5,
        });

        return {
          status: "success",
          message: "OCR batch timeout cancellation is pending",
          data: { outputId: output.id },
        };
      }

      const terminalOutput = await updateOutput(context, user.id, output.id, {
        status: "failed",
        expectedRevision: output.revision,
        content: withProviderCleanup(
          {
            ...output.content,
            batchStatus: "timeout",
            error: "OCR batch exceeded its 25-hour polling window",
            completedAt: new Date().toISOString(),
          },
          cancelledJob,
        ),
      });
      const terminalCleanup = getProviderCleanupState(terminalOutput.content);

      if (!terminalCleanup) {
        throw new AssistantError("OCR batch cleanup state is missing", ErrorType.INTERNAL_ERROR);
      }

      await cleanupStoredProviderBatch(batchClient, env, user, terminalCleanup);
      await updateOutput(context, user.id, terminalOutput.id, {
        status: terminalOutput.status,
        expectedRevision: terminalOutput.revision,
        content: withoutProviderCleanup(terminalOutput.content),
      });

      return { status: "success", message: "OCR batch timed out", data: { outputId: output.id } };
    }

    let job = await batchClient.get({ env, user, jobId: data.jobId });
    const cancellationDesired = [
      "cancellation_requested",
      "cleanup_pending",
      "deletion_pending",
    ].includes(typeof output.content.batchStatus === "string" ? output.content.batchStatus : "");

    if (cancellationDesired && ["QUEUED", "RUNNING"].includes(job.status)) {
      job = await batchClient.cancel({ env, user, jobId: data.jobId });
    }

    if (
      cancellationDesired &&
      !["QUEUED", "RUNNING", "CANCELLATION_REQUESTED"].includes(job.status)
    ) {
      const terminalOutput = await updateOutput(context, user.id, output.id, {
        status: "failed",
        expectedRevision: output.revision,
        content: withProviderCleanup(
          {
            ...output.content,
            batchStatus:
              output.content.batchStatus === "cleanup_pending"
                ? "failed"
                : output.content.batchStatus === "deletion_pending"
                  ? "deletion_pending"
                  : "cancelled",
            completedAt: new Date().toISOString(),
          },
          job,
        ),
      });
      const terminalCleanup = getProviderCleanupState(terminalOutput.content);

      if (!terminalCleanup) {
        throw new AssistantError("OCR batch cleanup state is missing", ErrorType.INTERNAL_ERROR);
      }

      await cleanupStoredProviderBatch(batchClient, env, user, terminalCleanup);
      await updateOutput(context, user.id, terminalOutput.id, {
        status: terminalOutput.status,
        expectedRevision: terminalOutput.revision,
        content: withoutProviderCleanup(terminalOutput.content),
      });

      return {
        status: "success",
        message: "OCR batch cancellation reconciled",
        data: { outputId: output.id, providerStatus: job.status },
      };
    }

    if (
      job.status === "QUEUED" ||
      job.status === "RUNNING" ||
      job.status === "CANCELLATION_REQUESTED"
    ) {
      await updateOutput(context, user.id, output.id, {
        status: "pending",
        expectedRevision: output.revision,
        content: {
          ...output.content,
          batchStatus: job.status.toLowerCase(),
          progress: {
            total: job.total_requests,
            completed: job.completed_requests,
            succeeded: job.succeeded_requests,
            failed: job.failed_requests,
          },
        },
      });
      const polling = getNextPollingSchedule(data.pollAttempt);
      const taskService = new TaskService(env, context.repositories.tasks);

      await taskService.enqueueTask({
        id: `ocr-batch:${data.outputId}:${polling.pollAttempt}`,
        task_type: OCR_BATCH_POLLING_TASK_TYPE,
        user_id: data.userId,
        project_id: data.projectId,
        task_data: { ...data, pollAttempt: polling.pollAttempt },
        schedule_type: "scheduled",
        scheduled_at: polling.scheduledAt,
        priority: message.priority || 5,
      });

      return {
        status: "success",
        message: "OCR batch still in progress",
        data: { outputId: data.outputId, providerStatus: job.status },
      };
    }

    if (job.status === "SUCCESS") {
      const claimedOutput =
        output.content.batchStatus === "persisting"
          ? output
          : await updateOutput(context, user.id, output.id, {
              status: "pending",
              expectedRevision: output.revision,
              content: { ...output.content, batchStatus: "persisting" },
            });

      return this.persistCompletedBatch({
        batchClient,
        context,
        data,
        job,
        output: claimedOutput,
        user,
      });
    }

    const batchStatus = job.status === "CANCELLED" ? "cancelled" : "failed";

    const terminalOutput = await updateOutput(context, user.id, output.id, {
      status: "failed",
      expectedRevision: output.revision,
      content: withProviderCleanup(
        {
          ...output.content,
          batchStatus,
          error: "Mistral OCR batch did not complete successfully",
          completedAt: new Date().toISOString(),
          progress: {
            total: job.total_requests,
            completed: job.completed_requests,
            succeeded: job.succeeded_requests,
            failed: job.failed_requests,
          },
        },
        job,
      ),
    });
    const terminalCleanup = getProviderCleanupState(terminalOutput.content);

    if (!terminalCleanup) {
      throw new AssistantError("OCR batch cleanup state is missing", ErrorType.INTERNAL_ERROR);
    }

    await cleanupStoredProviderBatch(batchClient, env, user, terminalCleanup);
    await updateOutput(context, user.id, terminalOutput.id, {
      status: terminalOutput.status,
      expectedRevision: terminalOutput.revision,
      content: withoutProviderCleanup(terminalOutput.content),
    });

    return {
      status: "success",
      message: `OCR batch ${batchStatus}`,
      data: { outputId: output.id, providerStatus: job.status },
    };
  }

  async onFinalFailure(message: TaskMessage, env: IEnv, error: Error): Promise<void> {
    const data = readPollingData(message);

    if (!data) {
      return;
    }

    const repositories = new RepositoryManager(env);
    const [user, output] = await Promise.all([
      repositories.users.getUserById(data.userId),
      repositories.outputs.getOutputIncludingDeleting(data.outputId),
    ]);
    const content = output ? (safeParseJson<Record<string, unknown>>(output.content) ?? {}) : {};
    const existingCleanup = getProviderCleanupState(content);

    if (
      !user ||
      !output ||
      output.capability_id !== "ocr" ||
      output.kind !== "ocr_batch" ||
      output.created_by_user_id !== data.userId ||
      (output.project_id ?? undefined) !== data.projectId ||
      (output.status !== "pending" && !existingCleanup)
    ) {
      return;
    }

    if (content.providerJobId !== data.jobId) {
      return;
    }

    const batchClient = this.dependencies.batchClient ?? new MistralOcrBatchClient();
    const taskService = new TaskService(env, repositories.tasks);

    if (existingCleanup) {
      await enqueueOcrBatchReconciliation(taskService, data, message.priority || 5);
      await cleanupStoredProviderBatch(batchClient, env, user, existingCleanup);
      await repositories.outputs.updateOutput(output.id, {
        status: output.status,
        expectedRevision: output.revision,
        updatedByUserId: user.id,
        content: withoutProviderCleanup(content),
      });

      return;
    }

    const cancelledJob = await batchClient
      .cancel({ env, user, jobId: data.jobId })
      .catch(() => null);

    if (
      !cancelledJob ||
      ["QUEUED", "RUNNING", "CANCELLATION_REQUESTED"].includes(cancelledJob.status)
    ) {
      await repositories.outputs.updateOutput(output.id, {
        status: "pending",
        expectedRevision: output.revision,
        updatedByUserId: user.id,
        content: {
          ...content,
          batchStatus: "cleanup_pending",
          error: "OCR batch polling failed after its final retry",
          failureReason: error.name,
        },
      });

      await enqueueOcrBatchReconciliation(
        taskService,
        { ...data, pollAttempt: data.pollAttempt + 1 },
        message.priority || 5,
      );

      if (!cancelledJob) {
        throw new AssistantError(
          "OCR batch cancellation could not be confirmed",
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      return;
    }

    const terminalOutput = await repositories.outputs.updateOutput(output.id, {
      status: "failed",
      expectedRevision: output.revision,
      updatedByUserId: user.id,
      content: withProviderCleanup(
        {
          ...content,
          batchStatus: "failed",
          error: "OCR batch polling failed after its final retry",
          failureReason: error.name,
          completedAt: new Date().toISOString(),
        },
        cancelledJob,
      ),
    });
    const terminalCleanup = getProviderCleanupState(
      safeParseJson<Record<string, unknown>>(terminalOutput.content) ?? {},
    );

    if (!terminalCleanup) {
      throw new AssistantError("OCR batch cleanup state is missing", ErrorType.INTERNAL_ERROR);
    }

    await enqueueOcrBatchReconciliation(taskService, data, message.priority || 5);
    await cleanupStoredProviderBatch(batchClient, env, user, terminalCleanup);
    await repositories.outputs.updateOutput(terminalOutput.id, {
      status: terminalOutput.status,
      expectedRevision: terminalOutput.revision,
      updatedByUserId: user.id,
      content: withoutProviderCleanup(
        safeParseJson<Record<string, unknown>>(terminalOutput.content) ?? {},
      ),
    });
  }

  private async persistCompletedBatch(params: {
    batchClient: OcrBatchClient;
    context: ReturnType<typeof createServiceContext>;
    data: OcrBatchPollingData;
    job: MistralOcrBatchJob;
    output: Awaited<ReturnType<typeof getOutputIncludingDeleting>>;
    user: NonNullable<Awaited<ReturnType<RepositoryManager["users"]["getUserById"]>>>;
  }): Promise<TaskResult> {
    const { batchClient, context, data, job, output, user } = params;
    let outputData: string;
    let errorData: string;

    try {
      outputData = job.outputs?.length
        ? job.outputs.map((result) => JSON.stringify(result)).join("\n")
        : job.output_file
          ? await batchClient.downloadFile({
              env: context.env,
              user,
              fileId: job.output_file,
              maxBytes: MAX_OCR_BATCH_RESULT_BYTES,
            })
          : "";
      const outputBytes = new TextEncoder().encode(outputData).byteLength;
      const separatorBytes = outputData && job.error_file ? 1 : 0;
      const remainingBytes = Math.max(0, MAX_OCR_BATCH_RESULT_BYTES - outputBytes - separatorBytes);

      errorData = job.error_file
        ? await batchClient.downloadFile({
            env: context.env,
            user,
            fileId: job.error_file,
            maxBytes: remainingBytes,
          })
        : "";
    } catch (error) {
      if (!(error instanceof ResponseBodyTooLargeError)) {
        throw error;
      }

      return this.completeOversizedBatch({ batchClient, context, job, output, user });
    }

    const resultData = [outputData, errorData].filter(Boolean).join("\n");
    const resultBytes = new TextEncoder().encode(resultData).byteLength;

    if (resultBytes > MAX_OCR_BATCH_RESULT_BYTES) {
      return this.completeOversizedBatch({ batchClient, context, job, output, user });
    }

    const scope = output.projectId
      ? `projects/${encodeURIComponent(output.projectId)}`
      : `users/${user.id}`;
    const key = `ocr/${scope}/${encodeURIComponent(output.id)}/results.jsonl`;
    const storage = StorageService.forPrivateAssets(context);
    const resultOutputId = `ocr-batch-result:${output.id}`;
    const isExpectedResult = (
      record: Awaited<ReturnType<typeof context.repositories.outputs.getOutputIncludingDeleting>>,
    ): boolean =>
      record !== null &&
      !isOutputDeletionPending(record) &&
      record.id === resultOutputId &&
      record.capability_id === "ocr" &&
      record.kind === "ocr_batch_result" &&
      record.parent_output_id === output.id &&
      record.created_by_user_id === user.id &&
      record.project_id === (output.projectId ?? null) &&
      record.storage_key === key;
    const existingResult =
      await context.repositories.outputs.getOutputIncludingDeleting(resultOutputId);

    if (existingResult && !isExpectedResult(existingResult)) {
      throw new AssistantError(
        "OCR batch result identity conflicts with another Output",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    if (!existingResult) {
      await storage.uploadObject(key, resultData, {
        httpMetadata: { contentType: "application/x-ndjson" },
      });

      try {
        await createOutput(
          context,
          user.id,
          {
            projectId: output.projectId,
            conversationId: output.conversationId,
            parentOutputId: output.id,
            capabilityId: "ocr",
            groupId: output.id,
            kind: "ocr_batch_result",
            title: `${output.title} results`,
            status: "ready",
            content: {
              providerJobId: data.jobId,
              total: job.total_requests,
              succeeded: job.succeeded_requests,
              failed: job.failed_requests,
            },
            file: {
              key,
              mimeType: "application/x-ndjson",
              filename: "ocr-results.jsonl",
              byteSize: resultBytes,
            },
          },
          { id: resultOutputId },
        );
      } catch (error) {
        const racedResult =
          await context.repositories.outputs.getOutputIncludingDeleting(resultOutputId);

        if (!isExpectedResult(racedResult)) {
          if (racedResult?.storage_key !== key) {
            await storage.deleteObject(key).catch(() => undefined);
          }

          throw error;
        }
      }
    } else {
      const storedResult = await storage.getObjectBody(key);

      if (!storedResult) {
        await storage.uploadObject(key, resultData, {
          httpMetadata: { contentType: "application/x-ndjson" },
        });
      }
    }

    const sourceIds = getSourceIds(output.content);

    if (sourceIds.length > 0) {
      await context.repositories.outputs.attachSources(resultOutputId, sourceIds);
    }

    const batchStatus = job.failed_requests > 0 ? "partial" : "completed";

    const terminalOutput = await updateOutput(context, user.id, output.id, {
      status: job.succeeded_requests > 0 ? "ready" : "failed",
      expectedRevision: output.revision,
      content: withProviderCleanup(
        {
          ...output.content,
          batchStatus: job.succeeded_requests > 0 ? batchStatus : "failed",
          resultOutputId,
          completedAt: new Date().toISOString(),
          progress: {
            total: job.total_requests,
            completed: job.completed_requests,
            succeeded: job.succeeded_requests,
            failed: job.failed_requests,
          },
        },
        job,
      ),
    });
    const terminalCleanup = getProviderCleanupState(terminalOutput.content);

    if (!terminalCleanup) {
      throw new AssistantError("OCR batch cleanup state is missing", ErrorType.INTERNAL_ERROR);
    }

    await cleanupStoredProviderBatch(batchClient, context.env, user, terminalCleanup);
    await updateOutput(context, user.id, terminalOutput.id, {
      status: terminalOutput.status,
      expectedRevision: terminalOutput.revision,
      content: withoutProviderCleanup(terminalOutput.content),
    });

    return {
      status: "success",
      message: `OCR batch ${batchStatus}`,
      data: { outputId: output.id, resultOutputId },
    };
  }

  private async completeOversizedBatch(params: {
    batchClient: OcrBatchClient;
    context: ReturnType<typeof createServiceContext>;
    job: MistralOcrBatchJob;
    output: Awaited<ReturnType<typeof getOutputIncludingDeleting>>;
    user: NonNullable<Awaited<ReturnType<RepositoryManager["users"]["getUserById"]>>>;
  }): Promise<TaskResult> {
    const { batchClient, context, job, output, user } = params;
    const terminalOutput = await updateOutput(context, user.id, output.id, {
      status: "failed",
      expectedRevision: output.revision,
      content: withProviderCleanup(
        {
          ...output.content,
          batchStatus: "failed",
          error: "OCR batch result exceeded the 20 MiB ingestion limit",
          completedAt: new Date().toISOString(),
        },
        job,
      ),
    });
    const terminalCleanup = getProviderCleanupState(terminalOutput.content);

    if (!terminalCleanup) {
      throw new AssistantError("OCR batch cleanup state is missing", ErrorType.INTERNAL_ERROR);
    }

    await cleanupStoredProviderBatch(batchClient, context.env, user, terminalCleanup);
    await updateOutput(context, user.id, terminalOutput.id, {
      status: terminalOutput.status,
      expectedRevision: terminalOutput.revision,
      content: withoutProviderCleanup(terminalOutput.content),
    });

    return { status: "success", message: "OCR batch result was too large" };
  }
}
