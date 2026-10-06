import { CHATS_QUERY_KEY } from "@ngriffin_uk/polychat-library-client";
import type { DeviceSyncEvent, DeviceSyncEventType, PolyHome } from "@ngriffin_uk/polychat-schemas";
import { readOptionalString } from "@ngriffin_uk/polychat-utility-core";
import type { QueryClient } from "@tanstack/react-query";

import { GOAL_QUERY_KEY } from "../chat/useGoal.js";
import { MACHINES_QUERY_KEY } from "../chat/useMachines.js";
import { removeConversationFromChatCaches } from "../conversation-cache.js";
import {
  conversationDelegationsQueryKey,
  conversationHandlesQueryKey,
} from "../hooks/useDelegations.js";
import { conversationBriefQueryKey } from "../hooks/useMemoryDocuments.js";
import { POLY_AGENDA_QUERY_KEY } from "../hooks/usePolyAgenda.js";
import { POLY_HOME_QUERY_KEY } from "../hooks/usePolyHome.js";
import {
  projectTaskDetailQueryPrefix,
  projectTasksQueryKey,
  TASK_ATTENTION_QUERY_KEY,
} from "../hooks/useProjectTasks.js";
import { PROJECT_WORKBENCH_PREVIEW_QUERY_KEY } from "../hooks/useProjectWorkbenchPreview.js";
import { REPLICATE_QUERY_KEY } from "../hooks/useReplicate.js";
import { TASK_QUERY_KEYS } from "../hooks/useTasks.js";
import { teammateContextMemoryQueryPrefix } from "../hooks/useTeammateContextMemory.js";
import { applyUsageChanged } from "./usage.js";

export interface SyncBindingContext {
  queryClient: QueryClient;
  localScope: string;
  invalidate: (queryKey: readonly unknown[]) => void;
}

export interface SyncBinding {
  type: DeviceSyncEventType;
  apply: (context: SyncBindingContext, event: DeviceSyncEvent) => void;
}

const refreshConversationDetail: SyncBinding["apply"] = (context, event) => {
  const conversationId = readOptionalString(event.data.conversationId);

  if (conversationId) {
    context.invalidate([CHATS_QUERY_KEY, conversationId]);
    context.invalidate(conversationBriefQueryKey(conversationId));
  }
};

const refreshPolyAgenda: SyncBinding["apply"] = (context, event) => {
  const conversationId = readOptionalString(event.data.conversationId);
  const home = context.queryClient.getQueryData<PolyHome>(POLY_HOME_QUERY_KEY);

  if (conversationId && conversationId === home?.conversation_id) {
    context.invalidate(POLY_AGENDA_QUERY_KEY);
  }
};

const refreshConversationAndList: SyncBinding["apply"] = (context, event) => {
  refreshConversationDetail(context, event);
  context.invalidate([CHATS_QUERY_KEY, "remote"]);
};

export const SYNC_BINDINGS: SyncBinding[] = [
  { type: "conversation.changed", apply: refreshConversationAndList },
  {
    type: "run.changed",
    apply: (context, event) => {
      refreshConversationAndList(context, event);
      refreshPolyAgenda(context, event);
    },
  },
  { type: "run.event", apply: refreshConversationDetail },
  { type: "message.changed", apply: refreshConversationDetail },
  {
    type: "conversation.unread_changed",
    apply: (context) => context.invalidate([CHATS_QUERY_KEY, "remote"]),
  },
  {
    type: "conversation.deleted",
    apply: (context, event) => {
      const conversationId = readOptionalString(event.data.conversationId);

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
      const conversationId = readOptionalString(event.data.conversationId);

      if (conversationId) {
        context.invalidate(conversationDelegationsQueryKey(conversationId));
      }

      context.invalidate(conversationHandlesQueryKey);
      refreshPolyAgenda(context, event);
    },
  },
  {
    type: "task.changed",
    apply: (context) => {
      context.invalidate(TASK_QUERY_KEYS.tasks);
      context.invalidate(["memory-synthesis"]);
      context.invalidate(["memory-synthesis-history"]);
      context.invalidate(teammateContextMemoryQueryPrefix);
    },
  },
  {
    type: "project_task.changed",
    apply: (context, event) => {
      const projectId = readOptionalString(event.data.projectId);

      if (projectId) {
        context.invalidate(projectTasksQueryKey(projectId));
        context.invalidate(projectTaskDetailQueryPrefix(projectId));
      }

      context.invalidate(TASK_ATTENTION_QUERY_KEY);
    },
  },
  {
    type: "workbench_run.changed",
    apply: (context, event) => {
      const projectId = readOptionalString(event.data.projectId);

      if (projectId) {
        context.invalidate(["project-workbench-runs", projectId]);
      }

      context.invalidate(PROJECT_WORKBENCH_PREVIEW_QUERY_KEY);
    },
  },
  {
    type: "workbench_preview.changed",
    apply: (context) => context.invalidate(PROJECT_WORKBENCH_PREVIEW_QUERY_KEY),
  },
  { type: "machine.changed", apply: (context) => context.invalidate([MACHINES_QUERY_KEY]) },
  { type: "usage.changed", apply: applyUsageChanged },
  {
    type: "workspace_usage.changed",
    apply: (context, event) => {
      const workspaceId = readOptionalString(event.data.workspaceId);

      if (workspaceId) {
        void context.queryClient.invalidateQueries({
          queryKey: ["usage", "workspace", workspaceId],
          refetchType: "none",
        });
      }
    },
  },
  {
    type: "model_platform.changed",
    apply: (context, event) => {
      const workspaceId = readOptionalString(event.data.workspaceId);

      if (workspaceId) {
        context.invalidate(["model-platform", workspaceId]);
      }
    },
  },
  {
    type: "output.changed",
    apply: (context) => {
      context.invalidate(["outputs"]);
      context.invalidate(["canvas"]);
      context.invalidate([REPLICATE_QUERY_KEY]);
    },
  },
  {
    type: "document_comments.changed",
    apply: (context, event) => {
      const outputId = readOptionalString(event.data.outputId);

      if (outputId) {
        context.invalidate(["outputs", "comments", outputId]);
      }
    },
  },
  {
    type: "knowledge_sync.changed",
    apply: (context, event) => {
      const projectId = readOptionalString(event.data.projectId);

      if (projectId) {
        context.invalidate(["knowledge-syncs", projectId]);
        context.invalidate(["sources"]);
      }
    },
  },
  {
    type: "project_review.changed",
    apply: (context, event) => {
      const projectId = readOptionalString(event.data.projectId);

      if (projectId) {
        context.invalidate(["project-pr-reviews", projectId]);
        context.invalidate(["project-task-pr-review", projectId]);
      }
    },
  },
  {
    type: "channel_senders.changed",
    apply: (context) => context.invalidate(["channel-senders"]),
  },
  {
    type: "goal.changed",
    apply: (context, event) => {
      const conversationId = readOptionalString(event.data.conversationId);

      if (conversationId) {
        context.invalidate([GOAL_QUERY_KEY, conversationId]);
      }

      refreshPolyAgenda(context, event);
    },
  },
  { type: "research.changed", apply: (context) => context.invalidate(["research-status"]) },
  { type: "canvas.changed", apply: (context) => context.invalidate(["canvas"]) },
  { type: "replicate.changed", apply: (context) => context.invalidate([REPLICATE_QUERY_KEY]) },
  { type: "connector_approval.changed", apply: refreshConversationDetail },
  { type: "attention.changed", apply: (context) => context.invalidate(TASK_ATTENTION_QUERY_KEY) },
];

const BINDINGS_BY_TYPE = new Map(SYNC_BINDINGS.map((binding) => [binding.type, binding]));

export function applySyncEvent(context: SyncBindingContext, event: DeviceSyncEvent): void {
  BINDINGS_BY_TYPE.get(event.type)?.apply(context, event);
}

export function invalidateSyncQueries(invalidateQuery: SyncBindingContext["invalidate"]): void {
  for (const queryKey of [
    [CHATS_QUERY_KEY],
    ["conversation-brief"],
    ["conversation-delegations"],
    conversationHandlesQueryKey,
    TASK_QUERY_KEYS.tasks,
    ["memory-synthesis"],
    ["memory-synthesis-history"],
    teammateContextMemoryQueryPrefix,
    ["project-tasks"],
    ["project-task"],
    TASK_ATTENTION_QUERY_KEY,
    ["project-workbench-runs"],
    PROJECT_WORKBENCH_PREVIEW_QUERY_KEY,
    [MACHINES_QUERY_KEY],
    ["usage"],
    ["outputs"],
    ["knowledge-syncs"],
    ["sources"],
    ["project-pr-reviews"],
    ["project-task-pr-review"],
    ["channel-senders"],
    ["model-platform"],
    [GOAL_QUERY_KEY],
    POLY_AGENDA_QUERY_KEY,
    ["research-status"],
    ["canvas"],
    [REPLICATE_QUERY_KEY],
  ]) {
    invalidateQuery(queryKey);
  }
}
