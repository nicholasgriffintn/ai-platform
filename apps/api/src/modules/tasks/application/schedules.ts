import { SCHEDULES } from "~/config/schedules";
import { reapComposioConnectorSessions } from "~/modules/apps/application/connectors/composio-cleanup";
import { deleteExpiredConnectorOperationApprovals } from "~/modules/apps/application/connectors/connector-approval-cleanup";
import { releaseExpiredChatRunReservations } from "~/modules/chat-runs/application/reservation-maintenance";
import { evaluateServerFlag, taskFlags } from "~/modules/experiments/application";
import { schedulePendingTaskNotificationDeliveries } from "~/modules/task-notifications/application/delivery";

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
    enabledWhen: (env) => evaluateServerFlag(env, taskFlags(env).memory_synthesis),
    run: ({ env }) => scheduleDailySynthesis(env),
  }),
);

workflows.every(
  SCHEDULES.TRAINING_QUALITY_SCORING,
  defineSchedule({
    name: "training-quality-scoring",
    enabledWhen: (env) => evaluateServerFlag(env, taskFlags(env).training_quality_scoring),
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
