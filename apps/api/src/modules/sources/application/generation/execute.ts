import { validateReplicatePayload } from "@ngriffin_uk/polychat-ai-models";
import {
  SOURCE_GENERATION_POLLING_TASK_TYPE,
  type SourceGeneration,
  type SourceStatus,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord, generateId, truncateSingleLine } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getChatProvider } from "~/infrastructure/providers/capabilities/chat";
import { fileKnowledgeSource } from "~/modules/knowledge/application/intake/file";
import { getModelConfigByModel } from "~/modules/models/application/resolve";
import { TaskService } from "~/modules/queue/application/TaskService";
import { TaskRepository } from "~/modules/queue/infrastructure/TaskRepository";
import {
  SourceRepository,
  type SourceRecord,
} from "~/modules/sources/infrastructure/SourceRepository";

import { finaliseSourceGeneration } from "./finalise";

export interface StartModelGenerationRequest {
  context: ServiceContext;
  projectId?: string | null;
  modelId: string;
  input: Record<string, unknown>;
  generation: Pick<SourceGeneration, "type" | "mode" | "prompt">;
  providerWaitSeconds?: number;
}

function extractAsyncInvocation(
  providerResponse: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const data = providerResponse.data;

  return isRecord(data) && isRecord(data.asyncInvocation) ? data.asyncInvocation : undefined;
}

function resolveStatus(providerResponse: Record<string, unknown>): SourceStatus {
  const rawStatus =
    typeof providerResponse.status === "string" ? providerResponse.status.toLowerCase() : "";

  if (["failed", "error", "canceled", "cancelled"].includes(rawStatus)) {
    return "failed";
  }

  if (
    ["in_progress", "processing", "queued", "starting"].includes(rawStatus) ||
    extractAsyncInvocation(providerResponse)
  ) {
    return "processing";
  }

  return "available";
}

function titleFor(prompt: string | undefined, modelName: string): string {
  return truncateSingleLine(prompt?.trim() || `${modelName} generation`, 200);
}

export async function startModelGeneration(
  request: StartModelGenerationRequest,
): Promise<SourceRecord> {
  const { context, generation, input, modelId, projectId } = request;
  const user = context.requireUser();
  const modelConfig = await getModelConfigByModel(modelId);

  if (!modelConfig) {
    throw new AssistantError(
      `Model configuration not found for ${modelId}`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  validateReplicatePayload({
    payload: input,
    schema: modelConfig.inputSchema,
    modelName: modelConfig.name || modelId,
  });

  const provider = getChatProvider(modelConfig.provider || "replicate", {
    env: context.env,
    user,
  });
  const result = await provider.getResponse({
    completion_id: generateId(),
    model: modelConfig.matchingModel,
    messages: [{ role: "user", content: typeof input.prompt === "string" ? input.prompt : "" }],
    body: { input },
    replicate_wait_seconds: request.providerWaitSeconds,
    env: context.env,
    context,
    store: false,
  });
  const providerResponse = isRecord(result) ? result : {};
  const status = resolveStatus(providerResponse);
  const asyncInvocation = extractAsyncInvocation(providerResponse);

  if (status === "processing" && !asyncInvocation) {
    throw new AssistantError(
      "Provider response is async but missing async invocation metadata",
      ErrorType.PROVIDER_ERROR,
    );
  }

  const producesText =
    (modelConfig.modalities?.output ?? []).every((modality) => modality === "text") &&
    (modelConfig.modalities?.output?.length ?? 0) > 0;
  const error = typeof providerResponse.error === "string" ? providerResponse.error : undefined;
  const created = await fileKnowledgeSource(context, {
    origin: "generated",
    projectId: projectId ?? null,
    provider: null,
    content: undefined,
    kind: producesText ? "text" : "file",
    title: titleFor(generation.prompt, modelConfig.name || modelId),
    status: status === "available" ? "processing" : status,
    metadata: {
      generation: {
        ...generation,
        modelId,
        modelName: modelConfig.name,
        provider: modelConfig.provider,
        input,
        ...(error ? { error } : {}),
      } satisfies SourceGeneration,
      ...(asyncInvocation ? { pending: { asyncInvocation } } : {}),
    },
  });
  const source = await context.repositories.get(SourceRepository).getSource(created.id);

  if (!source) {
    throw new AssistantError("Failed to store generation", ErrorType.STORAGE_ERROR);
  }

  if (status === "available") {
    return finaliseSourceGeneration(context, source, providerResponse);
  }

  if (status === "processing") {
    await new TaskService(context.env, new TaskRepository(context.env)).enqueueTask({
      task_type: SOURCE_GENERATION_POLLING_TASK_TYPE,
      user_id: user.id,
      project_id: source.project_id ?? undefined,
      task_data: { sourceId: source.id, userId: user.id, modelId, pollAttempt: 0 },
      priority: 6,
    });
  }

  return source;
}
