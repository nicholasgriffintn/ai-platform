import type { AsyncInvocationMetadata } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { PENDING } from "@ngriffin_uk/polychat-ai-workflows";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { z } from "zod/v4";

import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { OutputRepository } from "~/repositories/OutputRepository";
import { UserRepository } from "~/repositories/UserRepository";
import { resolveExecutableModelForRequest } from "~/services/chat/policy/model-access";
import { publishUserEvent } from "~/services/sync/conversation-events";

import { definePoll } from "../workflows";

const logger = getLogger({ prefix: "services/tasks/replicate-polling" });

export const replicatePolling = definePoll({
  payload: z.object({
    predictionId: z.string().min(1),
    userId: z.number(),
    modelId: z.string().optional(),
    startedAt: z.string().optional(),
    pollAttempt: z.number().optional(),
  }),
  check: async (data, { env }) => {
    const outputRepo = new OutputRepository(env);
    const prediction = await outputRepo.getOutput(data.predictionId);

    if (!prediction) {
      return {
        status: "error",
        message: `Prediction ${data.predictionId} not found`,
      };
    }

    if (prediction.created_by_user_id !== data.userId) {
      return {
        status: "error",
        message: "Unauthorized access to prediction",
      };
    }

    const predictionData = safeParseJson<Record<string, any>>(prediction.content);

    if (!predictionData) {
      return {
        status: "error",
        message: "Invalid prediction data",
      };
    }

    const asyncInvocation = predictionData.predictionData?.data?.asyncInvocation as
      | AsyncInvocationMetadata
      | undefined;

    if (!asyncInvocation || predictionData.status !== "processing") {
      logger.info(`Prediction ${data.predictionId} not in processing state`);

      return {
        status: "success",
        message: "Prediction not in processing state",
        data: {
          predictionId: data.predictionId,
          status: predictionData.status,
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

    const user = await new UserRepository(env).getUserById(data.userId);

    if (!user) {
      return {
        status: "error",
        message: `User ${data.userId} not found`,
      };
    }

    const resolvedModel = await resolveExecutableModelForRequest({
      env,
      user,
      model: data.modelId || asyncInvocation.context?.version || "",
      provider: asyncInvocation.provider || "replicate",
    });

    const result = await provider.getAsyncInvocationStatus(
      asyncInvocation,
      {
        model: asyncInvocation.context?.version || "",
        env,
        messages: [],
        completion_id: data.predictionId,
        credentialAuthority: resolvedModel.credentialAuthority,
      },
      data.userId,
    );

    if (result.status === "completed" && result.result) {
      logger.info(`Prediction ${data.predictionId} completed`);

      predictionData.status = "succeeded";
      predictionData.predictionData = result.result;
      predictionData.output = result.result.response;

      await outputRepo.updateOutput(data.predictionId, {
        status: "ready",
        content: predictionData,
        expectedRevision: prediction.revision,
        updatedByUserId: data.userId,
      });
      publishUserEvent({ env }, data.userId, "replicate.changed", {
        predictionId: data.predictionId,
        status: "succeeded",
      });

      return {
        status: "success",
        message: "Prediction completed",
        data: {
          predictionId: data.predictionId,
          output: result.result.response,
        },
      };
    }

    if (result.status === "failed") {
      logger.warn(`Prediction ${data.predictionId} failed`);

      predictionData.status = "failed";
      predictionData.error = result.raw?.error || "Generation failed";

      await outputRepo.updateOutput(data.predictionId, {
        status: "failed",
        content: predictionData,
        expectedRevision: prediction.revision,
        updatedByUserId: data.userId,
      });
      publishUserEvent({ env }, data.userId, "replicate.changed", {
        predictionId: data.predictionId,
        status: "failed",
      });

      return {
        status: "success",
        message: "Prediction failed",
        data: {
          predictionId: data.predictionId,
          error: predictionData.error,
        },
      };
    }

    logger.info(`Prediction ${data.predictionId} still in progress, re-queuing`);

    return PENDING;
  },
});
