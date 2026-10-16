import type {
  UsageEventPublisher,
  UsageRollupPayload,
  UsageRuntime,
  UsageStore,
} from "@ngriffin_uk/polychat-ai-billing";
import { USAGE_ROLLUP_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { createRepositories, type Repositories } from "~/infrastructure/database/repositories";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { getModelConfig } from "~/modules/models/application/resolve";
import { PlanRepository } from "~/modules/plans/infrastructure/PlanRepository";
import type { SyncPublisher } from "~/modules/sync/application/publish";
import { TaskService } from "~/modules/tasks/application/TaskService";
import { TaskRepository } from "~/modules/tasks/infrastructure/TaskRepository";
import { UsageBalanceRepository } from "~/modules/usage/infrastructure/UsageBalanceRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import { UsageReservationRepository } from "~/modules/usage/infrastructure/UsageReservationRepository";
import { AnonymousUserRepository } from "~/modules/user/infrastructure/AnonymousUserRepository";
import { UserRepository } from "~/modules/user/infrastructure/UserRepository";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import type { IEnv } from "~/types";

import { publishUsageChanged } from "./events";
import { publishWorkspaceUsageChanged } from "./workspace-events";

export function createUsageStore(repositories: Repositories): UsageStore {
  return {
    getUserBalance: (userId, period) =>
      repositories.get(UsageBalanceRepository).getBalance(userId, period),
    applyUserBalanceDeltas: (params) =>
      repositories.get(UsageBalanceRepository).applyDeltas(params),
    getAnonymousCreditSpend: (anonymousUserId, period) =>
      repositories.get(AnonymousUserRepository).getCreditSpend(anonymousUserId, period),
    applyAnonymousCreditDeltas: (anonymousUserId, period, deltas) =>
      repositories.get(AnonymousUserRepository).applyCreditDeltas(anonymousUserId, period, deltas),
    insertEventAndApplyBalance: (event, seed) =>
      repositories.get(UsageEventRepository).insertEventAndApplyBalance(event, seed),
    createReservation: (params) =>
      repositories.get(UsageReservationRepository).createReservation(params),
    createUserReservationWithBalance: (params) =>
      repositories.get(UsageReservationRepository).createUserReservationWithBalance(params),
    getReservation: (kind, refId) =>
      repositories.get(UsageReservationRepository).getReservation(kind, refId),
    finishUserReservationWithBalance: (kind, refId, outcome, expectedReservationId) =>
      repositories
        .get(UsageReservationRepository)
        .finishUserReservationWithBalance(kind, refId, outcome, expectedReservationId),
    transitionHeldReservation: (kind, refId, outcome) =>
      repositories.get(UsageReservationRepository).transitionHeldReservation(kind, refId, outcome),
    getPlanAllowance: (planId) => repositories.get(PlanRepository).getPlanById(planId),
    getUserPlanId: async (userId) => {
      const user = await repositories.get(UserRepository).getUserById(userId);

      return user ? { planId: typeof user.plan_id === "string" ? user.plan_id : null } : null;
    },
    conversationExists: async (conversationId) =>
      Boolean(await repositories.get(ConversationRepository).getConversation(conversationId)),
    getConversationProjectId: async (conversationId) => {
      const conversation = await repositories
        .get(ConversationRepository)
        .getConversation(conversationId);

      return typeof conversation?.project_id === "string" ? conversation.project_id : null;
    },
    getProjectWorkspaceId: async (projectId) =>
      (await repositories.get(WorkspaceRepository).getProject(projectId))?.workspace_id ?? null,
    hasProviderApiKey: (userId, provider) =>
      repositories.get(UserSettingsRepository).hasProviderApiKey(userId, provider),
  };
}

export function createUsagePublisher(
  publisher: SyncPublisher,
  store: UsageStore,
): UsageEventPublisher {
  return {
    usageChanged: (userId, period) => publishUsageChanged(publisher, store, userId, period),
    workspaceUsageChanged: (workspaceId, period) =>
      publishWorkspaceUsageChanged(publisher, workspaceId, period),
  };
}

export interface CreateUsageRuntimeOptions {
  env: IEnv;
  repositories?: Repositories;
  publisher?: SyncPublisher | null;
}

export function createUsageRuntime(options: CreateUsageRuntimeOptions): UsageRuntime {
  const { env } = options;
  const repositories = options.repositories ?? createRepositories(env);
  const publisher = options.publisher === null ? undefined : (options.publisher ?? { env });

  const store = createUsageStore(repositories);

  return {
    store,
    publisher: publisher ? createUsagePublisher(publisher, store) : undefined,
    enqueueRollup: env.TASK_QUEUE
      ? async (payload: UsageRollupPayload, userId) => {
          await new TaskService(env, repositories.get(TaskRepository)).enqueueTask({
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
