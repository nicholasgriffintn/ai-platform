import {
  admitTurn,
  anonymousCreditActor,
  estimateTurnCreditMicros,
  isByokTurn,
  userCreditActor,
  type CreditActor,
  type TurnAdmission,
} from "@ngriffin_uk/polychat-ai-billing";
import { estimateMessagesTokens } from "@ngriffin_uk/polychat-ai-providers";
import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { createUsageRuntime } from "~/modules/usage/application/runtime";
import type { AnonymousUser, IEnv, Message, User } from "~/types";

const logger = getLogger({ prefix: "services/conversations/turn-admission" });

export interface TurnAdmissionRequest {
  modelConfig?: ModelConfigItem | null;
  messages: Message[];
  skipCreditAdmission?: boolean;
}

export interface DurableTurnReservation {
  kind: "chat_run";
  refId: string;
  creditMicros?: number;
  expiresAt?: string | null;
}

export interface TurnAdmissionScope {
  env?: IEnv;
  repositories?: RepositoryManager;
  user?: User | null;
  anonymousUser?: AnonymousUser | null;
  provider?: string;
  durableTurnReservation?: DurableTurnReservation;
}

export function resolveCreditActor(scope: TurnAdmissionScope): CreditActor | null {
  if (scope.user?.id) {
    return userCreditActor(scope.user.id);
  }

  if (scope.anonymousUser?.id) {
    return anonymousCreditActor(scope.anonymousUser.id);
  }

  return null;
}

export async function resolveTurnAdmission(
  scope: TurnAdmissionScope,
  params: TurnAdmissionRequest,
): Promise<TurnAdmission | null> {
  if (params.skipCreditAdmission) {
    return null;
  }

  const actor = resolveCreditActor(scope);
  const { repositories, env } = scope;

  if (!actor || !repositories) {
    return null;
  }

  try {
    const userId = scope.user?.id;
    const provider = params.modelConfig?.provider ?? scope.provider;
    const runtime = createUsageRuntime({ env, repositories });

    if (userId && provider && (await isByokTurn(runtime.store, userId, provider))) {
      return null;
    }

    return await admitTurn(runtime, {
      actor,
      planId: scope.user?.plan_id ?? null,
      estimatedCreditMicros:
        scope.durableTurnReservation?.creditMicros ??
        estimateTurnCreditMicros({
          promptTokens: estimateMessagesTokens(params.messages),
          modelConfig: params.modelConfig,
        }),
      ...(scope.durableTurnReservation && userId
        ? { durableReservation: { ...scope.durableTurnReservation, userId } }
        : {}),
    });
  } catch (error) {
    logger.error("Failed to admit the turn against the credit balance", { error, actor });

    throw new AssistantError(
      "Your plan could not be verified, so this reply was not started. Please try again shortly.",
      ErrorType.USAGE_LIMIT_ERROR,
    );
  }
}

export function assertTurnAdmitted(
  admission: TurnAdmission,
): asserts admission is Extract<TurnAdmission, { admitted: true }> {
  if (!admission.admitted) {
    throw new AssistantError(
      "This month's credits are fully spent, so new replies are paused until the balance resets. Enabling overage lifts the pause.",
      ErrorType.USAGE_LIMIT_ERROR,
    );
  }
}
