import { CHATS_QUERY_KEY } from "@ngriffin_uk/polychat-library-client";
import type { DeviceSyncEvent, DeviceSyncEventType } from "@ngriffin_uk/polychat-schemas";
import type { QueryClient } from "@tanstack/react-query";

import { GOAL_QUERY_KEY } from "../chat/useGoal.js";
import { MACHINES_QUERY_KEY } from "../chat/useMachines.js";
import { USAGE_QUERY_KEYS } from "../chat/useUsage.js";
import { removeConversationFromChatCaches } from "../conversation-cache.js";
import {
  conversationDelegationsQueryKey,
  conversationHandlesQueryKey,
} from "../hooks/useDelegations.js";
import {
  projectTaskDetailQueryPrefix,
  projectTasksQueryKey,
  TASK_ATTENTION_QUERY_KEY,
} from "../hooks/useProjectTasks.js";
import { projectWorkbenchRunsQueryKey } from "../hooks/useProjectWorkbenchRuns.js";
import { TASK_QUERY_KEYS } from "../hooks/useTasks.js";
import { TRAINING_QUERY_KEYS } from "../hooks/useTraining.js";

export interface SyncBindingContext {
  queryClient: QueryClient;
  localScope: string;
  invalidate: (queryKey: readonly unknown[]) => void;
}

export interface SyncBinding {
  type: DeviceSyncEventType;
  apply: (context: SyncBindingContext, event: DeviceSyncEvent) => void;
}

function readString(event: DeviceSyncEvent, key: string): string | undefined {
  const value = event.data[key];

  return typeof value === "string" ? value : undefined;
}

function invalidate(context: SyncBindingContext, queryKey: readonly unknown[]): void {
  context.invalidate(queryKey);
}

const refreshConversationDetail: SyncBinding["apply"] = (context, event) => {
  const conversationId = readString(event, "conversationId");

  if (conversationId) {
    invalidate(context, [CHATS_QUERY_KEY, conversationId]);
  }
};

const refreshConversationAndList: SyncBinding["apply"] = (context, event) => {
  refreshConversationDetail(context, event);
  invalidate(context, [CHATS_QUERY_KEY, "remote"]);
};

export const SYNC_BINDINGS: SyncBinding[] = [
  { type: "conversation.changed", apply: refreshConversationAndList },
  { type: "run.changed", apply: refreshConversationAndList },
  { type: "run.event", apply: refreshConversationDetail },
  { type: "message.changed", apply: refreshConversationDetail },
  {
    type: "conversation.unread_changed",
    apply: (context) => invalidate(context, [CHATS_QUERY_KEY, "remote"]),
  },
  {
    type: "conversation.deleted",
    apply: (context, event) => {
      const conversationId = readString(event, "conversationId");

      if (conversationId) {
        removeConversationFromChatCaches(
          context.queryClient,
          conversationId,
          CHATS_QUERY_KEY,
          context.localScope,
        );
      }
    },
  },
  {
    type: "delegation.changed",
    apply: (context, event) => {
      const conversationId = readString(event, "conversationId");

      if (conversationId) {
        invalidate(context, conversationDelegationsQueryKey(conversationId));
      }

      invalidate(context, conversationHandlesQueryKey);
    },
  },
  { type: "task.changed", apply: (context) => invalidate(context, TASK_QUERY_KEYS.tasks) },
  {
    type: "project_task.changed",
    apply: (context, event) => {
      const projectId = readString(event, "projectId");

      if (projectId) {
        invalidate(context, projectTasksQueryKey(projectId));
        invalidate(context, projectTaskDetailQueryPrefix(projectId));
      }

      invalidate(context, TASK_ATTENTION_QUERY_KEY);
    },
  },
  {
    type: "workbench_run.changed",
    apply: (context, event) => {
      const projectId = readString(event, "projectId");

      if (projectId) {
        invalidate(
          context,
          projectWorkbenchRunsQueryKey(projectId, readString(event, "conversationId")),
        );
      }
    },
  },
  {
    type: "workbench_preview.changed",
    apply: (context) => invalidate(context, ["project-workbench-preview"]),
  },
  { type: "machine.changed", apply: (context) => invalidate(context, [MACHINES_QUERY_KEY]) },
  { type: "usage.changed", apply: (context) => invalidate(context, USAGE_QUERY_KEYS.balance) },
  {
    type: "goal.changed",
    apply: (context, event) => {
      const conversationId = readString(event, "conversationId");

      if (conversationId) {
        invalidate(context, [GOAL_QUERY_KEY, conversationId]);
      }
    },
  },
  { type: "research.changed", apply: (context) => invalidate(context, ["research-status"]) },
  { type: "training.changed", apply: (context) => invalidate(context, TRAINING_QUERY_KEYS.jobs) },
  { type: "canvas.changed", apply: (context) => invalidate(context, ["canvas"]) },
  { type: "replicate.changed", apply: (context) => invalidate(context, ["replicate-prediction"]) },
  { type: "connector_approval.changed", apply: refreshConversationDetail },
  { type: "attention.changed", apply: (context) => invalidate(context, TASK_ATTENTION_QUERY_KEY) },
];

const BINDINGS_BY_TYPE = new Map(SYNC_BINDINGS.map((binding) => [binding.type, binding]));

export function applySyncEvent(context: SyncBindingContext, event: DeviceSyncEvent): void {
  BINDINGS_BY_TYPE.get(event.type)?.apply(context, event);
}
