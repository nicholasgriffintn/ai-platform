import { SCHEDULES } from "~/constants/schedules";
import { reapComposioConnectorSessions } from "~/services/apps/connectors/composio-cleanup";
import { deleteExpiredConnectorOperationApprovals } from "~/services/apps/connectors/connector-approval-cleanup";
import { releaseExpiredChatRunReservations } from "~/services/chat-runs/reservation-maintenance";
import { schedulePendingTaskNotificationDeliveries } from "~/services/task-notifications/delivery";

import {
  purgeSettledTasks,
  recoverFailedDurableTasks,
  redispatchPendingTasks,
  scheduleDailySynthesis,
  scheduleInfraReconciliation,
  scheduleRecipeExecutions,
  scheduleStripeUsageSync,
  scheduleTrainingQualityScoring,
} from "./scheduledTasks";
import { defineSchedule, workflows } from "./workflows";

workflows.always(
  defineSchedule({
    name: "task-recovery",
    run: async ({ env }) => {
      await recoverFailedDurableTasks(env);
      await redispatchPendingTasks(env);
    },
  }),
);

workflows.always(
  defineSchedule({
    name: "notification-recovery",
    run: async ({ env }) => {
      await schedulePendingTaskNotificationDeliveries(env);
    },
  }),
);

workflows.always(
  defineSchedule({
    name: "expired-chat-run-reservations",
    run: async ({ env }) => {
      await releaseExpiredChatRunReservations(env);
    },
  }),
);

workflows.every(
  SCHEDULES.INFRA_RECONCILIATION,
  defineSchedule({
    name: "infra-reconciliation",
    run: ({ env }) => scheduleInfraReconciliation(env),
  }),
);

workflows.every(
  SCHEDULES.MEMORIES_SYNTHESIS,
  defineSchedule({
    name: "memory-synthesis",
    enabledWhen: (env) => env.MEMORY_SYNTHESIS_ENABLED === "true",
    run: ({ env }) => scheduleDailySynthesis(env),
  }),
);

workflows.every(
  SCHEDULES.TRAINING_QUALITY_SCORING,
  defineSchedule({
    name: "training-quality-scoring",
    enabledWhen: (env) => env.TRAINING_QUALITY_SCORING_ENABLED === "true",
    run: ({ env }) => scheduleTrainingQualityScoring(env),
  }),
);

workflows.every(
  SCHEDULES.RECIPE_EXECUTION,
  defineSchedule({
    name: "stripe-usage-sync",
    run: async ({ env, invokedAt }) => {
      if (invokedAt.getUTCMinutes() === 0) {
        await scheduleStripeUsageSync(env, invokedAt);
      }
    },
  }),
);

workflows.every(
  SCHEDULES.RECIPE_EXECUTION,
  defineSchedule({
    name: "recipe-scheduling",
    run: async ({ env }) => {
      await scheduleRecipeExecutions(env);
    },
  }),
);

workflows.every(
  SCHEDULES.RECIPE_EXECUTION,
  defineSchedule({
    name: "composio-session-reaper",
    run: async ({ env }) => {
      await reapComposioConnectorSessions(env);
    },
  }),
);

workflows.every(
  SCHEDULES.RECIPE_EXECUTION,
  defineSchedule({
    name: "connector-approval-cleanup",
    run: async ({ env }) => {
      await deleteExpiredConnectorOperationApprovals(env);
    },
  }),
);

workflows.every(
  SCHEDULES.RECIPE_EXECUTION,
  defineSchedule({
    name: "settled-task-purge",
    run: async ({ env }) => {
      await purgeSettledTasks(env);
    },
  }),
);
