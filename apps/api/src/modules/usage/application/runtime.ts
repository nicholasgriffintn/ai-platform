import type {
  UsageEventPublisher,
  UsageRollupPayload,
  UsageRuntime,
  UsageStore,
} from "@ngriffin_uk/polychat-ai-billing";
import { USAGE_ROLLUP_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import { getModelConfig } from "~/modules/models/application/resolve";
import { publishUserEvent } from "~/modules/sync/application/conversation-events";
import type { SyncPublisher } from "~/modules/sync/application/publish";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IEnv } from "~/types";

export function createUsageStore(repositories: RepositoryManager): UsageStore {
  return {
    getUserBalance: (userId, period) => repositories.usageBalances.getBalance(userId, period),
    applyUserBalanceDeltas: (params) => repositories.usageBalances.applyDeltas(params),
    getAnonymousCreditSpend: (anonymousUserId, period) =>
      repositories.anonymousUsers.getCreditSpend(anonymousUserId, period),
    applyAnonymousCreditDeltas: (anonymousUserId, period, deltas) =>
      repositories.anonymousUsers.applyCreditDeltas(anonymousUserId, period, deltas),
    insertEventAndApplyBalance: (event, seed) =>
      repositories.usageEvents.insertEventAndApplyBalance(event, seed),
    createReservation: (params) => repositories.usageReservations.createReservation(params),
    createUserReservationWithBalance: (params) =>
      repositories.usageReservations.createUserReservationWithBalance(params),
    getReservation: (kind, refId) => repositories.usageReservations.getReservation(kind, refId),
    finishUserReservationWithBalance: (kind, refId, outcome, expectedReservationId) =>
      repositories.usageReservations.finishUserReservationWithBalance(
        kind,
        refId,
        outcome,
        expectedReservationId,
      ),
    transitionHeldReservation: (kind, refId, outcome) =>
      repositories.usageReservations.transitionHeldReservation(kind, refId, outcome),
    getPlanAllowance: (planId) => repositories.plans.getPlanById(planId),
    getUserPlanId: async (userId) => {
      const user = await repositories.users.getUserById(userId);

      return user ? { planId: typeof user.plan_id === "string" ? user.plan_id : null } : null;
    },
    conversationExists: async (conversationId) =>
      Boolean(await repositories.conversations.getConversation(conversationId)),
    getConversationProjectId: async (conversationId) => {
      const conversation = await repositories.conversations.getConversation(conversationId);

      return typeof conversation?.project_id === "string" ? conversation.project_id : null;
    },
    getProjectWorkspaceId: async (projectId) =>
      (await repositories.workspaces.getProject(projectId))?.workspace_id ?? null,
    hasProviderApiKey: (userId, provider) =>
      repositories.userSettings.hasProviderApiKey(userId, provider),
  };
}

export function createUsagePublisher(publisher: SyncPublisher): UsageEventPublisher {
  return {
    usageChanged: (userId, period) =>
      publishUserEvent(publisher, userId, "usage.changed", { period }),
  };
}

export interface CreateUsageRuntimeOptions {
  env: IEnv;
  repositories?: RepositoryManager;
  publisher?: SyncPublisher | null;
}

export function createUsageRuntime(options: CreateUsageRuntimeOptions): UsageRuntime {
  const { env } = options;
  const repositories = options.repositories ?? new RepositoryManager(env);
  const publisher = options.publisher === null ? undefined : (options.publisher ?? { env });

  return {
    store: createUsageStore(repositories),
    publisher: publisher ? createUsagePublisher(publisher) : undefined,
    enqueueRollup: env.TASK_QUEUE
      ? async (payload: UsageRollupPayload, userId) => {
          await new TaskService(env, repositories.tasks).enqueueTask({
            task_type: USAGE_ROLLUP_TASK_TYPE,
            user_id: userId,
            task_data: payload,
            priority: 2,
          });
        }
      : undefined,
    resolveModelConfig: async (model, provider, userId) =>
      (await getModelConfig(model, env, provider, userId)) ?? undefined,
  };
}
