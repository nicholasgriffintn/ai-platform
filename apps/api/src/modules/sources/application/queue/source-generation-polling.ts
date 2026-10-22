import type { AsyncInvocationMetadata } from "@ngriffin_uk/polychat-ai-providers";
import { PENDING } from "@ngriffin_uk/polychat-ai-workflows";
import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { z } from "zod/v4";

import { getChatProvider } from "~/infrastructure/providers/capabilities/chat";
import { resolveExecutableModelForRequest } from "~/modules/models/application/access";
import { definePoll } from "~/modules/queue/application/workflows";
import {
  failSourceGeneration,
  finaliseSourceGeneration,
} from "~/modules/sources/application/generation/finalise";
import { readSourcePending } from "~/modules/sources/application/media/metadata";
import { SourceRepository } from "~/modules/sources/infrastructure/SourceRepository";

import { loadUserContext } from "./user-context";

export const sourceGenerationPolling = definePoll({
  payload: z.object({
    sourceId: z.string().min(1),
    userId: z.number(),
    modelId: z.string().optional(),
    pollAttempt: z.number().optional(),
  }),
  check: async (data, { env }) => {
    const context = await loadUserContext(env, data.userId);

    if (!context) {
      return { status: "error", message: `User ${data.userId} not found` };
    }

    const source = await context.repositories.get(SourceRepository).getSource(data.sourceId);

    if (!source || !ownsResource(data.userId, source.created_by_user_id)) {
      return { status: "error", message: `Source ${data.sourceId} not found` };
    }

    const asyncInvocation = readSourcePending(source)?.asyncInvocation as
      | AsyncInvocationMetadata
      | undefined;

    if (source.status !== "processing" || !asyncInvocation) {
      return { status: "success", message: "Generation is not pending" };
    }

    const provider = getChatProvider(asyncInvocation.provider || "replicate", {
      env,
      user: undefined,
    });

    if (!provider?.getAsyncInvocationStatus) {
      await failSourceGeneration(context, source, "The provider cannot report progress");

      return { status: "error", message: "Provider does not support async invocation status" };
    }

    const resolvedModel = await resolveExecutableModelForRequest({
      env,
      user: context.requireUser(),
      model: data.modelId || asyncInvocation.context?.version || "",
      provider: asyncInvocation.provider || "replicate",
    });
    const result = await provider.getAsyncInvocationStatus(
      asyncInvocation,
      {
        model: asyncInvocation.context?.version || "",
        env,
        messages: [],
        completion_id: data.sourceId,
        credentialAuthority: resolvedModel.credentialAuthority,
      },
      data.userId,
    );

    if (result.status === "completed" && isRecord(result.result)) {
      await finaliseSourceGeneration(context, source, result.result);

      return { status: "success", message: "Generation completed" };
    }

    if (result.status === "failed") {
      const error = result.raw?.error;

      await failSourceGeneration(
        context,
        source,
        typeof error === "string" && error ? error : "Generation failed",
      );

      return { status: "success", message: "Generation failed" };
    }

    return PENDING;
  },
  onExhausted: async (data, { env }) => {
    const context = await loadUserContext(env, data.userId);
    const source = context
      ? await context.repositories.get(SourceRepository).getSource(data.sourceId)
      : null;

    if (context && source?.status === "processing") {
      await failSourceGeneration(context, source, "Generation timed out");
    }
  },
});
