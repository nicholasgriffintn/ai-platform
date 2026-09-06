import {
  META_NAVIGATION_DATA_KEY,
  TEAMMATE_PERMISSIONS_SENTENCE,
  type MetaFoundConversation,
  type MetaNavigationTarget,
} from "@ngriffin_uk/polychat-schemas";
import type z from "zod/v4";

import { isMetaConversationType } from "~/lib/chat/policy/meta-assistant";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ToolExecutionContext } from "~/lib/tools/ToolExecutionContext";
import { listWorkAttention } from "~/services/attention";
import { handleUpdateChatCompletion } from "~/services/completions/updateChatCompletion";
import {
  getConversationOrganisation,
  updateConversationOrganisation,
} from "~/services/conversation-organisation";
import { requireConversationAccess } from "~/services/conversations/access";
import { searchPolychat } from "~/services/global-search";
import { hireTeammate as hireTeammateService } from "~/services/teammates";
import { requireTeammateAccess } from "~/services/teammates/access";
import { requireProjectAccess, requireWorkspaceAccess } from "~/services/workspaces/access";
import type { IFunctionResponse, IUser } from "~/types";
import type { ApiToolDefinition } from "~/types/functions";
import { isConversationUnread } from "~/utils/conversation-organisation";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import {
  find_places as findPlacesDescriptor,
  type findPlacesInputSchema,
  hire_teammate as hireTeammateDescriptor,
  type hireTeammateInputSchema,
  list_attention as listAttentionDescriptor,
  type listAttentionInputSchema,
  MAX_META_ATTENTION_LIMIT,
  MAX_META_READ_MESSAGES,
  open_place as openPlaceDescriptor,
  type openPlaceInputSchema,
  organise_conversation as organiseConversationDescriptor,
  type organiseConversationInputSchema,
  read_conversation as readConversationDescriptor,
  type readConversationInputSchema,
  start_conversation as startConversationDescriptor,
  type startConversationInputSchema,
} from "./definitions/meta";

const DEFAULT_ATTENTION_LIMIT = 10;
const DEFAULT_FIND_LIMIT = 8;
const DEFAULT_READ_MESSAGES = 30;
const MAX_TRANSCRIPT_CHARACTERS = 12_000;
const MAX_MESSAGE_CHARACTERS = 1_200;

interface MetaToolScope {
  context: ServiceContext;
  user: IUser;
}

function requireMetaScope(toolContext: ToolExecutionContext, toolName: string): MetaToolScope {
  const request = toolContext.request;

  if (!isMetaConversationType(request.request?.conversation_type)) {
    throw new AssistantError(
      `${toolName} is only available to the meta assistant`,
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (!request.context || !request.user?.id) {
    throw new AssistantError(
      "The meta assistant needs a signed-in user",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  return { context: request.context, user: request.user };
}

function describeConversation(conversation: MetaFoundConversation): string {
  const title = conversation.title?.trim() || "Untitled conversation";
  const place = conversation.project
    ? `${conversation.project.name} · ${conversation.project.workspaceName}`
    : "Personal chat";
  const flags = [
    conversation.isArchived ? "archived" : null,
    conversation.isPinned ? "pinned" : null,
    conversation.isUnread ? "unread" : null,
  ].filter(Boolean);

  return `- ${title} (${conversation.id}) · ${place}${flags.length ? ` · ${flags.join(", ")}` : ""}`;
}

function toFoundConversation(row: Record<string, unknown>): MetaFoundConversation {
  return {
    id: String(row.id),
    title: typeof row.title === "string" ? row.title : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    isArchived: row.is_archived === 1 || row.is_archived === true,
    isPinned: row.is_pinned === 1 || row.is_pinned === true,
    isUnread: isConversationUnread({
      is_unread: typeof row.is_unread === "number" ? row.is_unread : row.is_unread ? 1 : 0,
    }),
    project: null,
  };
}

async function listRecentConversations(
  scope: MetaToolScope,
  limit: number,
): Promise<MetaFoundConversation[]> {
  const result = await scope.context.repositories.conversations.getUserConversations(
    scope.user.id,
    {
      archiveFilter: "active",
      limit,
      page: 1,
      sortBy: "updated",
    },
  );

  return result.conversations.map(toFoundConversation);
}

function extractMessageText(row: Record<string, unknown>): string {
  const raw = row.content;
  const parsed = typeof raw === "string" ? (safeParseJson<unknown>(raw) ?? raw) : raw;

  if (typeof parsed === "string") {
    return parsed;
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) =>
        item && typeof item === "object" && "text" in item && typeof item.text === "string"
          ? item.text
          : "",
      )
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function truncate(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

async function resolveNavigationTarget(
  scope: MetaToolScope,
  target: MetaNavigationTarget,
): Promise<{ target: MetaNavigationTarget; label: string }> {
  switch (target.kind) {
    case "conversation": {
      const conversation = await requireConversationAccess(scope.context, target.conversationId);
      const projectId =
        typeof conversation.project_id === "string" ? conversation.project_id : undefined;
      const title =
        typeof conversation.title === "string" && conversation.title.trim()
          ? conversation.title
          : "the conversation";

      if (!projectId) {
        return {
          target: { kind: "conversation", conversationId: target.conversationId },
          label: title,
        };
      }

      const { project } = await requireProjectAccess(scope.context, projectId);

      return {
        target: {
          kind: "conversation",
          conversationId: target.conversationId,
          projectId,
          workspaceId: project.workspace_id,
        },
        label: title,
      };
    }

    case "project": {
      const { project } = await requireProjectAccess(scope.context, target.projectId);

      return {
        target: { kind: "project", projectId: project.id, workspaceId: project.workspace_id },
        label: project.name,
      };
    }

    case "workspace": {
      const { workspace } = await requireWorkspaceAccess(scope.context, target.workspaceId);

      return { target: { kind: "workspace", workspaceId: workspace.id }, label: workspace.name };
    }

    case "place":
      return { target, label: target.place };
  }
}

export const find_places: ApiToolDefinition = {
  ...findPlacesDescriptor,
  execute: async (args: z.infer<typeof findPlacesInputSchema>, toolContext) => {
    const scope = requireMetaScope(toolContext, findPlacesDescriptor.name);
    const limit = args.limit ?? DEFAULT_FIND_LIMIT;
    const query = args.query?.trim();

    if (!query) {
      const conversations = await listRecentConversations(scope, limit);

      return {
        status: "success",
        name: findPlacesDescriptor.name,
        content: conversations.length
          ? `Recent conversations:\n${conversations.map(describeConversation).join("\n")}`
          : "There are no recent conversations.",
        data: { conversations, projects: [], workspaces: [] },
      } satisfies IFunctionResponse;
    }

    const results = await searchPolychat(scope.context, { query, limit });
    const conversations: MetaFoundConversation[] = results.conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      isArchived: false,
      isPinned: conversation.isPinned,
      isUnread: conversation.isUnread,
      project: conversation.project,
    }));
    const sections = [
      conversations.length
        ? `Conversations:\n${conversations.map(describeConversation).join("\n")}`
        : null,
      results.projects.length
        ? `Projects:\n${results.projects
            .map((project) => `- ${project.name} (${project.id}) · ${project.workspaceName}`)
            .join("\n")}`
        : null,
      results.workspaces.length
        ? `Workspaces:\n${results.workspaces
            .map((workspace) => `- ${workspace.name} (${workspace.id})`)
            .join("\n")}`
        : null,
    ].filter(Boolean);

    return {
      status: "success",
      name: findPlacesDescriptor.name,
      content: sections.length ? sections.join("\n\n") : `Nothing matched "${query}".`,
      data: { conversations, projects: results.projects, workspaces: results.workspaces },
    } satisfies IFunctionResponse;
  },
};

export const open_place: ApiToolDefinition = {
  ...openPlaceDescriptor,
  execute: async (args: z.infer<typeof openPlaceInputSchema>, toolContext) => {
    const scope = requireMetaScope(toolContext, openPlaceDescriptor.name);
    const resolved = await resolveNavigationTarget(scope, args.target);

    return {
      status: "success",
      name: openPlaceDescriptor.name,
      content: `Opening ${resolved.label}.`,
      data: { [META_NAVIGATION_DATA_KEY]: resolved.target, label: resolved.label },
    } satisfies IFunctionResponse;
  },
};

export const organise_conversation: ApiToolDefinition = {
  ...organiseConversationDescriptor,
  execute: async (args: z.infer<typeof organiseConversationInputSchema>, toolContext) => {
    const scope = requireMetaScope(toolContext, organiseConversationDescriptor.name);
    const conversation = await requireConversationAccess(scope.context, args.conversationId);
    const title =
      typeof conversation.title === "string" && conversation.title.trim()
        ? conversation.title
        : "the conversation";
    const respond = (content: string): IFunctionResponse => ({
      status: "success",
      name: organiseConversationDescriptor.name,
      content,
      data: { conversationId: args.conversationId, action: args.action },
    });

    switch (args.action) {
      case "archive":
      case "unarchive": {
        await handleUpdateChatCompletion(scope.context, args.conversationId, {
          archived: args.action === "archive",
        });

        return respond(`${args.action === "archive" ? "Archived" : "Restored"} ${title}.`);
      }

      case "rename": {
        await handleUpdateChatCompletion(scope.context, args.conversationId, {
          title: args.title,
        });

        return respond(`Renamed ${title} to ${args.title}.`);
      }

      default: {
        const current = await getConversationOrganisation(scope.context, args.conversationId);
        const update =
          args.action === "pin" || args.action === "unpin"
            ? { isPinned: args.action === "pin" }
            : args.action === "mark_read" || args.action === "mark_unread"
              ? { isUnread: args.action === "mark_unread" }
              : args.action === "snooze_until"
                ? { snooze: { kind: "until" as const, until: args.until } }
                : args.action === "snooze_next_response"
                  ? { snooze: { kind: "next_response" as const } }
                  : { snooze: null };

        await updateConversationOrganisation(scope.context, args.conversationId, {
          expectedRevision: current.revision,
          ...update,
        });

        return respond(`Updated ${title}: ${args.action.replace(/_/g, " ")}.`);
      }
    }
  },
};

export const read_conversation: ApiToolDefinition = {
  ...readConversationDescriptor,
  execute: async (args: z.infer<typeof readConversationInputSchema>, toolContext) => {
    const scope = requireMetaScope(toolContext, readConversationDescriptor.name);
    const conversation = await requireConversationAccess(scope.context, args.conversationId);
    const limit = Math.min(args.maxMessages ?? DEFAULT_READ_MESSAGES, MAX_META_READ_MESSAGES);
    const rows = await scope.context.repositories.messages.getConversationMessages(
      args.conversationId,
      limit,
    );
    const lines: string[] = [];
    let used = 0;

    for (const row of rows) {
      const role = typeof row.role === "string" ? row.role : "unknown";

      if (role !== "user" && role !== "assistant") {
        continue;
      }

      const text = truncate(extractMessageText(row).trim(), MAX_MESSAGE_CHARACTERS);

      if (!text) {
        continue;
      }

      const line = `${role}: ${text}`;

      if (used + line.length > MAX_TRANSCRIPT_CHARACTERS) {
        lines.push("… transcript truncated");
        break;
      }

      lines.push(line);
      used += line.length;
    }

    const title =
      typeof conversation.title === "string" && conversation.title.trim()
        ? conversation.title
        : "Untitled conversation";

    return {
      status: "success",
      name: readConversationDescriptor.name,
      content: lines.length
        ? `Transcript of ${title}:\n${lines.join("\n")}`
        : `${title} has no readable messages yet.`,
      data: { conversationId: args.conversationId, title, messageCount: lines.length },
    } satisfies IFunctionResponse;
  },
};

export const start_conversation: ApiToolDefinition = {
  ...startConversationDescriptor,
  execute: async (args: z.infer<typeof startConversationInputSchema>, toolContext) => {
    const scope = requireMetaScope(toolContext, startConversationDescriptor.name);
    const projectId = args.scope === "project" ? args.projectId : undefined;
    const project = projectId
      ? (await requireProjectAccess(scope.context, projectId)).project
      : null;

    if (args.teammateId) {
      await requireTeammateAccess(scope.context, args.teammateId, "read", scope.user.id);
    }

    const conversationId = generateId();

    await scope.context.repositories.conversations.createConversation(
      conversationId,
      scope.user.id,
      args.title,
      project ? { project_id: project.id } : {},
    );

    const target: MetaNavigationTarget = {
      kind: "conversation",
      conversationId,
      ...(project ? { projectId: project.id, workspaceId: project.workspace_id } : {}),
      ...(args.openingMessage ? { openingMessage: args.openingMessage } : {}),
      ...(args.teammateId ? { teammateId: args.teammateId } : {}),
    };
    const place = project ? `${project.name}` : "your personal chat";

    return {
      status: "success",
      name: startConversationDescriptor.name,
      content: `Started a conversation in ${place}.${
        args.openingMessage ? " The first message is waiting in the composer." : ""
      }`,
      data: { [META_NAVIGATION_DATA_KEY]: target, conversationId },
    } satisfies IFunctionResponse;
  },
};

export const hire_teammate: ApiToolDefinition = {
  ...hireTeammateDescriptor,
  execute: async (args: z.infer<typeof hireTeammateInputSchema>, toolContext) => {
    const scope = requireMetaScope(toolContext, hireTeammateDescriptor.name);
    const hired = await hireTeammateService(
      scope.context,
      {
        ...(args.roleSlug ? { role_slug: args.roleSlug } : {}),
        ...(args.jobDescription ? { job_description: args.jobDescription } : {}),
        ...(args.name ? { name: args.name } : {}),
        ...(args.workspaceId ? { workspace_id: args.workspaceId } : {}),
      },
      scope.user,
    );

    return {
      status: "success",
      name: hireTeammateDescriptor.name,
      content: `Hired ${hired.name}. ${TEAMMATE_PERMISSIONS_SENTENCE}`,
      data: { teammateId: hired.id, name: hired.name, kind: hired.kind },
    } satisfies IFunctionResponse;
  },
};

export const list_attention: ApiToolDefinition = {
  ...listAttentionDescriptor,
  execute: async (args: z.infer<typeof listAttentionInputSchema>, toolContext) => {
    const scope = requireMetaScope(toolContext, listAttentionDescriptor.name);
    const limit = Math.min(args.limit ?? DEFAULT_ATTENTION_LIMIT, MAX_META_ATTENTION_LIMIT);
    const { items, total } = await listWorkAttention(scope.context, {
      ...(args.kind ? { kind: args.kind } : {}),
      ...(args.projectId ? { projectId: args.projectId } : {}),
      limit,
      offset: 0,
    });

    if (items.length === 0) {
      return {
        status: "success",
        name: listAttentionDescriptor.name,
        content: "Nothing is waiting on the user right now.",
        data: { items, total },
      } satisfies IFunctionResponse;
    }

    const lines = items.map(
      (item) =>
        `- ${item.title} (${item.kind}) · ${item.projectName} · ${item.workspaceName}${
          item.detail ? ` · ${item.detail}` : ""
        }`,
    );

    return {
      status: "success",
      name: listAttentionDescriptor.name,
      content: `Waiting on the user (${total} in total):\n${lines.join("\n")}`,
      data: { items, total },
    } satisfies IFunctionResponse;
  },
};

export const metaTools: ApiToolDefinition[] = [
  find_places,
  open_place,
  organise_conversation,
  read_conversation,
  start_conversation,
  hire_teammate,
  list_attention,
];
