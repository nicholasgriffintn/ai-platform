import type { ServiceContext } from "~/lib/context/serviceContext";
import { ConversationManager } from "~/lib/conversationManager";
import { createExecutionOutputProvenance } from "~/lib/provenance/output";
import type { OutputRecord } from "~/repositories/OutputRepository";
import { handleFunctions } from "~/services/functions";
import type { IRequest } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/functions/run-with-output" });

export const createFunctionOutput = async (
  context: ServiceContext,
  userId: number,
  functionName: string,
  payload: Record<string, unknown>,
  groupId?: string,
  projectId?: string,
  provenance?: Awaited<ReturnType<typeof createExecutionOutputProvenance>>,
): Promise<OutputRecord> =>
  context.repositories.outputs.createOutput({
    createdByUserId: userId,
    projectId,
    capabilityId: functionName,
    groupId,
    kind: "dynamic_app_response",
    title: `App output: ${functionName}`,
    content: payload,
    provenance,
  });

/**
 * Run a function tool outside a conversation and persist its result as an output.
 *
 * Used by surfaces that invoke a named function directly — currently the GitHub webhook
 * sandbox commands — rather than through a model tool call.
 */
export const runFunctionWithOutput = async (
  functionName: string,
  args: Record<string, any>,
  req: IRequest,
  projectId?: string,
): Promise<Record<string, any>> => {
  const { anonymousUser, env, user } = req;
  const context = req.context;

  if (!context) {
    throw new AssistantError(
      "Function execution requires a service context",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const conversationManager = ConversationManager.getInstance({
    database: context.database,
    user,
    anonymousUser,
    store: !!user?.id,
    platform: "tool-run",
    env,
    requestCache: context.requestCache,
    repositories: context.repositories,
  });

  try {
    let functionResult = await handleFunctions({
      completion_id: req.request?.completion_id || "function-execution",
      tool_call_id: generateId(),
      app_url: req.app_url,
      functionName,
      args,
      request: req,
      conversationManager,
    });

    let output_id: string | undefined;

    if (user?.id) {
      const resultData = (functionResult?.data ?? {}) as Record<string, any>;
      const runId =
        (resultData?.run?.run_id as string | undefined) ??
        (resultData?.asyncInvocation?.id as string | undefined);
      const provenance = await createExecutionOutputProvenance(context, {
        runId: req.request?.run_id,
        modelId: req.request?.model,
        provider: req.request?.provider,
      });

      const saved = await createFunctionOutput(
        context,
        user.id,
        functionName,
        { formData: args, result: functionResult },
        runId,
        projectId,
        provenance,
      );

      output_id = saved.id;

      const asyncInvocation = resultData?.asyncInvocation;

      if (asyncInvocation) {
        functionResult = {
          ...functionResult,
          data: {
            ...resultData,
            asyncInvocation: {
              ...asyncInvocation,
              context: { ...asyncInvocation.context, responseId: saved.id },
            },
          },
        };

        await context.repositories.outputs.updateOutput(saved.id, {
          content: { formData: args, result: functionResult },
          expectedRevision: saved.revision,
          updatedByUserId: user.id,
        });
      }
    }

    return {
      success: true,
      output_id,
      data: {
        message: `Successfully executed ${functionName}`,
        timestamp: new Date().toISOString(),
        input: args,
        result: functionResult,
      },
    };
  } catch (error) {
    logger.error(`Error executing function ${functionName}:`, { error });
    throw error;
  }
};
