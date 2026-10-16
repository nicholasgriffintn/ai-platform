import { SCHEDULES } from "~/config/schedules";
import { reapComposioConnectorSessions } from "~/modules/connectors/application/composio-cleanup";
import { deleteExpiredConnectorOperationApprovals } from "~/modules/connectors/application/connector-approval-cleanup";
import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";

export function registerConnectorsQueue(workflows: AppWorkflows): void {
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
}
