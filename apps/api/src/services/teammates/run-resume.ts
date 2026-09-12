import {
  teammateRunConfigurationSchema,
  type ChatRun,
  type TeammateRunConfiguration,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CoreChatOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

import { hydrateChatRunUsage } from "../chat-runs/usage";

export interface TeammateRunResumeState {
  configuration: TeammateRunConfiguration;
  maxSteps: number;
  durableExecution?: CoreChatOptions["durable_execution"];
}

export async function prepareTeammateRunResume(params: {
  context: ServiceContext;
  run: ChatRun | null;
  teammateId?: string;
}): Promise<TeammateRunResumeState> {
  const parsedConfiguration = teammateRunConfigurationSchema.safeParse(
    params.run?.resolvedConfiguration,
  );

  if (
    !params.run ||
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
  const usedSteps = configuration.usedSteps + (params.run.context?.step ?? 0);
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
    const [hydratedRun] = await hydrateChatRunUsage(params.context.repositories, [params.run]);
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
      usedSteps,
    },
    maxSteps: remainingSteps,
    ...(remainingCreditMicros !== undefined
      ? { durableExecution: { kind: "delegation", maxCreditMicros: remainingCreditMicros } }
      : {}),
  };
}
