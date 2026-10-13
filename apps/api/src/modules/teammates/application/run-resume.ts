import {
  teammateRunConfigurationSchema,
  type ChatRun,
  type TeammateRunConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { hydrateChatRunUsage } from "~/modules/responses/application/runs/usage";
import type { CoreChatOptions } from "~/types";

export interface TeammateRunResumeState {
  configuration: TeammateRunConfiguration;
  maxSteps: number;
  durableExecution?: CoreChatOptions["durable_execution"];
}

export async function prepareTeammateRunResume(params: {
  context: ServiceContext;
  run: ChatRun | null;
  teammateId?: string;
  interactionId?: string;
  resolution?: "approved" | "rejected";
}): Promise<TeammateRunResumeState> {
  const run = params.run;
  const parsedConfiguration = teammateRunConfigurationSchema.safeParse(run?.resolvedConfiguration);

  if (
    !run ||
    !parsedConfiguration.success ||
    (params.teammateId && parsedConfiguration.data.teammateId !== params.teammateId)
  ) {
    throw new AssistantError(
      "The stored teammate run cannot accept this response",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const configuration = parsedConfiguration.data;
  const approvedToolName = await readApprovedPendingToolName({ ...params, run });
  const usedSteps = configuration.usedSteps + (run.context?.step ?? 0);
  const remainingSteps = configuration.maxSteps - usedSteps;

  if (remainingSteps <= 0) {
    throw new AssistantError(
      "The teammate run has exhausted its step budget",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (configuration.deadline && Date.parse(configuration.deadline) <= Date.now()) {
    throw new AssistantError("The teammate run deadline has passed", ErrorType.CONFLICT_ERROR, 409);
  }

  let remainingCreditMicros = configuration.maxCreditMicros;

  if (remainingCreditMicros !== undefined) {
    const [hydratedRun] = await hydrateChatRunUsage(params.context.repositories, [run]);
    const usedCreditMicros = hydratedRun?.usage?.consumption.creditMicros ?? 0;

    remainingCreditMicros = Math.max(0, remainingCreditMicros - usedCreditMicros);

    if (remainingCreditMicros === 0) {
      throw new AssistantError(
        "The teammate run has exhausted its credit budget",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  return {
    configuration: {
      ...configuration,
      enabledTools: approvedToolName
        ? [...new Set([...configuration.enabledTools, approvedToolName])]
        : configuration.enabledTools,
      usedSteps,
    },
    maxSteps: remainingSteps,
    ...(remainingCreditMicros !== undefined
      ? { durableExecution: { kind: "delegation", maxCreditMicros: remainingCreditMicros } }
      : {}),
  };
}

async function readApprovedPendingToolName(params: {
  context: ServiceContext;
  run: ChatRun;
  interactionId?: string;
  resolution?: "approved" | "rejected";
}): Promise<string | undefined> {
  if (
    params.resolution !== "approved" ||
    params.run.status !== "awaiting_approval" ||
    !params.run.lastMessageId ||
    !params.interactionId
  ) {
    return undefined;
  }

  const stored = await params.context.repositories.messages.getMessageById(
    params.run.lastMessageId,
  );
  const message = stored?.message;
  const data = typeof message?.data === "string" ? safeParseJson(message.data) : message?.data;
  const approval = isRecord(data) && isRecord(data.approval) ? data.approval : undefined;
  const toolName = typeof message?.name === "string" ? message.name : undefined;

  if (
    stored?.conversation_id === params.run.conversationId &&
    message?.role === "tool" &&
    message.status === "pending" &&
    message.tool_call_id === params.interactionId &&
    isRecord(data) &&
    data.renderer === "approval_request" &&
    toolName &&
    approval?.toolName === toolName
  ) {
    return toolName;
  }

  return undefined;
}
