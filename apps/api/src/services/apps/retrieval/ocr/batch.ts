import {
  OCR_BATCH_POLLING_TASK_TYPE,
  type OcrBatchRequestItem,
  type OcrBatchStartRequest,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { requireOcrAccess } from "~/lib/providers/capabilities/ocr/access";
import {
  cleanupOcrBatchProviderResources,
  MAX_OCR_BATCH_PAYLOAD_BYTES,
  MistralOcrBatchClient,
  type MistralOcrBatchRequest,
  type OcrBatchClient,
  withOcrBatchProviderCleanup,
  withoutOcrBatchProviderCleanup,
} from "~/lib/providers/capabilities/ocr/batch/MistralOcrBatchClient";
import type { OcrDocument } from "~/lib/providers/capabilities/ocr/types";
import { readPrivateFile } from "~/lib/storage/read-resource";
import { createOutput, getOutput, updateOutput } from "~/services/outputs";
import { requireOutputAccess } from "~/services/outputs/access";
import { TaskService } from "~/services/tasks/TaskService";
import { requireProjectAccess } from "~/services/workspaces/access";
import type { IUser } from "~/types";
import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getUtf8ByteLength } from "~/utils/strings";

import { getOcrInputKind, MAX_OCR_DOCUMENT_BYTES, MAX_OCR_IMAGE_BYTES } from "./input";

interface OcrBatchDependencies {
  batchClient?: OcrBatchClient;
  projectId?: string;
}

function requireBatchOutput(output: Awaited<ReturnType<typeof getOutput>>): void {
  if (output.capabilityId !== "ocr" || output.kind !== "ocr_batch") {
    throw new AssistantError("OCR batch not found", ErrorType.NOT_FOUND, 404);
  }
}

interface ResolvedBatchRequest {
  request: MistralOcrBatchRequest;
  payloadBytes: number;
  sourceId?: string;
  input: Record<string, string>;
}

async function buildBatchRequest(
  context: ServiceContext,
  userId: number,
  item: OcrBatchRequestItem,
  projectId?: string,
  remainingPayloadBytes = MAX_OCR_BATCH_PAYLOAD_BYTES,
): Promise<ResolvedBatchRequest> {
  const { document, ...options } = item;

  if (document.type !== "source" && document.type !== "output") {
    const request = {
      customId: generateId(),
      body: { document, ...options },
    };

    return {
      request,
      payloadBytes: getUtf8ByteLength(JSON.stringify(request)),
      input: { type: document.type },
    };
  }

  const kind = document.type;
  const resourceId = kind === "source" ? document.source_id : document.output_id;
  const file = await readPrivateFile({ context, kind, resourceId, userId });

  if ((file.record.project_id ?? undefined) !== projectId) {
    throw new AssistantError(
      "OCR input is outside the requested scope",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (!projectId && file.record.created_by_user_id !== userId) {
    throw new AssistantError(
      "OCR input must be owned by the current user",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const mimeType = file.record.mime_type?.toLowerCase();

  if (!mimeType) {
    throw new AssistantError("OCR input has no media type", ErrorType.PARAMS_ERROR, 400);
  }

  const inputKind = getOcrInputKind(mimeType);

  if (!inputKind) {
    throw new AssistantError(
      `Unsupported OCR input type: ${mimeType}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const maxBytes = inputKind === "image" ? MAX_OCR_IMAGE_BYTES : MAX_OCR_DOCUMENT_BYTES;
  const storedBytes = typeof file.object.size === "number" ? file.object.size : undefined;

  if (storedBytes !== undefined && storedBytes > maxBytes) {
    throw new AssistantError(
      `OCR input must be ${maxBytes} bytes or smaller`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  if (storedBytes !== undefined && 4 * Math.ceil(storedBytes / 3) + 1_024 > remainingPayloadBytes) {
    throw new AssistantError(
      `OCR batch payload must be ${MAX_OCR_BATCH_PAYLOAD_BYTES} bytes or smaller`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const bytes = await file.object.arrayBuffer();

  if (bytes.byteLength > maxBytes) {
    throw new AssistantError(
      `OCR input must be ${maxBytes} bytes or smaller`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const dataUrl = `data:${mimeType};base64,${bufferToBase64(bytes)}`;
  const resolvedDocument: OcrDocument =
    inputKind === "image"
      ? { type: "image_url", image_url: dataUrl }
      : {
          type: "document_url",
          document_url: dataUrl,
          ...(file.record.filename ? { document_name: file.record.filename } : {}),
        };

  const request = {
    customId: generateId(),
    body: { document: resolvedDocument, ...options },
  };

  return {
    request,
    payloadBytes: getUtf8ByteLength(JSON.stringify(request)),
    ...(kind === "source" ? { sourceId: resourceId } : {}),
    input: { type: kind, resourceId },
  };
}

export async function startOcrBatch(
  context: ServiceContext,
  user: IUser,
  input: OcrBatchStartRequest,
  options: OcrBatchDependencies = {},
): Promise<{ outputId: string; status: "pending" }> {
  if (options.projectId) {
    await requireProjectAccess(context, options.projectId);
  }

  await requireOcrAccess({ env: context.env, user, providerName: "mistral" });
  const startedAt = new Date().toISOString();
  const resolvedRequests: ResolvedBatchRequest[] = [];
  let payloadBytes = 4_096;

  for (const item of input.requests) {
    // Resolve sequentially so one batch cannot materialise every private file in memory at once.
    // eslint-disable-next-line no-await-in-loop
    const resolved = await buildBatchRequest(
      context,
      user.id,
      item,
      options.projectId,
      MAX_OCR_BATCH_PAYLOAD_BYTES - payloadBytes,
    );

    payloadBytes += resolved.payloadBytes;
    if (payloadBytes > MAX_OCR_BATCH_PAYLOAD_BYTES) {
      throw new AssistantError(
        `OCR batch payload must be ${MAX_OCR_BATCH_PAYLOAD_BYTES} bytes or smaller`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    resolvedRequests.push(resolved);
  }

  const requests = resolvedRequests.map((item) => item.request);
  const created = await createOutput(context, user.id, {
    projectId: options.projectId,
    capabilityId: "ocr",
    kind: "ocr_batch",
    title: input.title,
    status: "pending",
    content: {
      batchStatus: "submitting",
      model: input.model,
      inputCount: requests.length,
      startedAt,
      inputs: resolvedRequests.map(({ input: resolvedInput, request }) => ({
        customId: request.customId,
        ...resolvedInput,
      })),
    },
  });
  const sourceIds = resolvedRequests.flatMap((request) =>
    request.sourceId ? [request.sourceId] : [],
  );
  const batchClient = options.batchClient ?? new MistralOcrBatchClient();
  let providerJobId: string | undefined;

  try {
    if (sourceIds.length > 0) {
      await context.repositories.outputs.attachSources(created.id, sourceIds);
    }

    const job = await batchClient.start({
      env: context.env,
      user,
      model: input.model,
      requests,
      metadata: { outputId: created.id },
    });

    providerJobId = job.id;
    await updateOutput(context, user.id, created.id, {
      status: "pending",
      expectedRevision: created.revision,
      content: {
        ...created.content,
        batchStatus: job.status.toLowerCase(),
        providerJobId: job.id,
        progress: {
          total: job.total_requests,
          completed: job.completed_requests,
          succeeded: job.succeeded_requests,
          failed: job.failed_requests,
        },
      },
    });

    const taskService = new TaskService(context.env, context.repositories.tasks);

    await taskService.enqueueTask({
      id: `ocr-batch:${created.id}:0`,
      task_type: OCR_BATCH_POLLING_TASK_TYPE,
      user_id: user.id,
      project_id: options.projectId,
      task_data: {
        outputId: created.id,
        jobId: job.id,
        userId: user.id,
        projectId: options.projectId,
        model: input.model,
        startedAt,
        pollAttempt: 0,
      },
      priority: 5,
    });
  } catch (error) {
    if (!providerJobId) {
      const current = await getOutput(context, user.id, created.id);

      await updateOutput(context, user.id, created.id, {
        status: "failed",
        expectedRevision: current.revision,
        content: {
          ...current.content,
          batchStatus: "failed",
          error: "OCR batch could not be started",
          completedAt: new Date().toISOString(),
        },
      });

      throw error;
    }

    const cancelledJob = await batchClient
      .cancel({ env: context.env, user, jobId: providerJobId })
      .catch(() => null);
    const cancellationPending =
      !cancelledJob ||
      ["QUEUED", "RUNNING", "CANCELLATION_REQUESTED"].includes(cancelledJob.status);
    let cleanupOutput: Awaited<ReturnType<typeof updateOutput>> | null = null;

    try {
      const current = await getOutput(context, user.id, created.id);
      const compensationContent = {
        ...current.content,
        providerJobId,
        batchStatus: "cleanup_pending",
        error: "OCR batch could not be started",
      };

      cleanupOutput = await updateOutput(context, user.id, created.id, {
        status: "pending",
        expectedRevision: current.revision,
        content:
          cancelledJob && !cancellationPending
            ? withOcrBatchProviderCleanup(compensationContent, cancelledJob)
            : compensationContent,
      });
    } catch {
      // The reconciliation task below re-reads the current revision before touching the provider.
    }

    if (cancelledJob && !cancellationPending && cleanupOutput) {
      try {
        await cleanupOcrBatchProviderResources(
          batchClient,
          { env: context.env, user },
          cancelledJob,
        );
        await updateOutput(context, user.id, created.id, {
          status: "failed",
          expectedRevision: cleanupOutput.revision,
          content: {
            ...withoutOcrBatchProviderCleanup(cleanupOutput.content),
            batchStatus: "failed",
            completedAt: new Date().toISOString(),
          },
        });
      } catch {
        // Persisted cleanup state makes provider deletion safe to retry.
      }
    }

    const taskService = new TaskService(context.env, context.repositories.tasks);

    await taskService.enqueueTask({
      id: `ocr-batch:${created.id}:reconcile`,
      task_type: OCR_BATCH_POLLING_TASK_TYPE,
      user_id: user.id,
      project_id: options.projectId,
      task_data: {
        outputId: created.id,
        jobId: providerJobId,
        userId: user.id,
        projectId: options.projectId,
        model: input.model,
        startedAt,
        pollAttempt: 0,
      },
      priority: 5,
    });

    throw error;
  }

  return { outputId: created.id, status: "pending" };
}

export async function getOcrBatchStatus(context: ServiceContext, userId: number, outputId: string) {
  const output = await getOutput(context, userId, outputId);

  requireBatchOutput(output);

  return output;
}

export async function cancelOcrBatch(
  context: ServiceContext,
  user: IUser,
  outputId: string,
  dependencies: Pick<OcrBatchDependencies, "batchClient"> = {},
): Promise<{ outputId: string; status: "cancellation_requested" | "cancelled" }> {
  await requireOutputAccess(context, user.id, outputId, true);
  const output = await getOutput(context, user.id, outputId);

  requireBatchOutput(output);

  if (output.status !== "pending") {
    throw new AssistantError("OCR batch is already terminal", ErrorType.CONFLICT_ERROR, 409);
  }

  if (output.content.batchStatus === "persisting") {
    throw new AssistantError(
      "OCR batch completion is being persisted",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const providerJobId = output.content.providerJobId;

  if (typeof providerJobId !== "string" || !providerJobId) {
    throw new AssistantError(
      "OCR batch provider job is unavailable",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const batchClient = dependencies.batchClient ?? new MistralOcrBatchClient();
  const cancellationOutput = await updateOutput(context, user.id, outputId, {
    status: "pending",
    expectedRevision: output.revision,
    content: {
      ...output.content,
      batchStatus: "cancellation_requested",
    },
  });
  const job = await batchClient.cancel({ env: context.env, user, jobId: providerJobId });
  const cancellationPending = ["QUEUED", "RUNNING", "CANCELLATION_REQUESTED"].includes(job.status);

  if (cancellationPending) {
    return { outputId, status: "cancellation_requested" };
  }

  const terminalOutput = await updateOutput(context, user.id, outputId, {
    status: "failed",
    expectedRevision: cancellationOutput.revision,
    content: {
      ...cancellationOutput.content,
      batchStatus: "cancelled",
      completedAt: new Date().toISOString(),
      providerCleanup: {
        jobId: job.id,
        ...(job.output_file ? { outputFileId: job.output_file } : {}),
        ...(job.error_file ? { errorFileId: job.error_file } : {}),
      },
    },
  });

  await cleanupOcrBatchProviderResources(batchClient, { env: context.env, user }, job);
  const { providerCleanup: _providerCleanup, ...cleanContent } = terminalOutput.content;

  await updateOutput(context, user.id, outputId, {
    status: terminalOutput.status,
    expectedRevision: terminalOutput.revision,
    content: cleanContent,
  });

  return { outputId, status: "cancelled" };
}
