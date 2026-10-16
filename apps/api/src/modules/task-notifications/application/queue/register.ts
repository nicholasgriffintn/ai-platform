import { TASK_NOTIFICATION_DELIVERY_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import {
  schedulePendingTaskNotificationDeliveries,
  TaskNotificationDeliveryHandler,
} from "~/modules/task-notifications/application/delivery";

export function registerTaskNotificationsQueue(workflows: AppWorkflows): void {
  workflows.register(TASK_NOTIFICATION_DELIVERY_TASK_TYPE, new TaskNotificationDeliveryHandler());

  workflows.always(
    defineSchedule({
      name: "notification-recovery",
      run: async ({ env }) => {
        await schedulePendingTaskNotificationDeliveries(env);
      },
    }),
  );
}
