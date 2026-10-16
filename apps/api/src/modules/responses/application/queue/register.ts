import { QUEUED_CHAT_MESSAGE_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import { defineSchedule, type AppWorkflows } from "~/modules/queue/application/workflows";
import { sweepInterruptedChatRuns } from "~/modules/responses/application/runs/interrupted-run-sweep";
import { releaseExpiredChatRunReservations } from "~/modules/responses/application/runs/reservation-maintenance";

import { QueuedChatMessageHandler } from "./QueuedChatMessageHandler";

export function registerResponsesQueue(workflows: AppWorkflows): void {
  workflows.register(QUEUED_CHAT_MESSAGE_TASK_TYPE, new QueuedChatMessageHandler());

  workflows.always(
    defineSchedule({
      name: "expired-chat-run-reservations",
      run: async ({ env }) => {
        await releaseExpiredChatRunReservations(env);
      },
    }),
  );

  workflows.always(
    defineSchedule({
      name: "interrupted-chat-runs",
      run: async ({ env }) => {
        await sweepInterruptedChatRuns(env);
      },
    }),
  );
}
