import type {
  ProjectCapability,
  ProjectConversation,
  ProjectDetail,
  ProjectFlow,
  ProjectSummary,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceSummary,
} from "@ngriffin_uk/polychat-schemas";
import {
  projectCodingEnvironmentSchema,
  projectFlowSchema,
  resolveSandboxDeliveryPolicy,
  sandboxEnvironmentCacheRecordSchema,
  toSandboxEnvironmentCacheSummary,
} from "@ngriffin_uk/polychat-schemas";

import type {
  ProjectCapabilityRow,
  ProjectConversationRow,
  ProjectRow,
  WorkspaceInvitationRow,
  WorkspaceMemberRow,
  WorkspaceSummaryRow,
} from "~/repositories/WorkspaceRepository";
import { isConversationUnread } from "~/utils/conversation-organisation";
import { safeParseJson } from "~/utils/json";

export function formatWorkspaceSummary(row: WorkspaceSummaryRow): WorkspaceSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    colour: row.colour,
    role: row.role,
    memberCount: Number(row.member_count),
    projectCount: Number(row.project_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function formatWorkspaceMember(row: WorkspaceMemberRow): WorkspaceMember {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

export function formatWorkspaceInvitation(row: WorkspaceInvitationRow): WorkspaceInvitation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    status:
      row.status === "pending" && new Date(row.expires_at).getTime() <= Date.now()
        ? "expired"
        : row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function formatProjectSummary(row: ProjectRow): ProjectSummary {
  const codingEnvironment = projectCodingEnvironmentSchema.safeParse({
    installationId: row.coding_installation_id,
    repository: row.coding_repository,
    promptStrategy: row.coding_prompt_strategy,
    deliveryPolicy: resolveSandboxDeliveryPolicy(
      row.coding_delivery_policy ? safeParseJson(row.coding_delivery_policy) : null,
      Boolean(row.coding_should_commit),
    ),
    environmentSetup: row.coding_environment_setup
      ? safeParseJson(row.coding_environment_setup)
      : undefined,
    timeoutSeconds: row.coding_timeout_seconds,
  });
  const environmentCache = sandboxEnvironmentCacheRecordSchema.safeParse(
    row.coding_environment_cache ? safeParseJson(row.coding_environment_cache) : null,
  );

  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    colour: row.colour,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    conversationCount: Number(row.conversation_count),
    capabilityCount: Number(row.capability_count),
    defaultRouterMode: row.default_router_mode ?? "auto",
    codingEnvironment:
      row.coding_enabled === 1 && codingEnvironment.success ? codingEnvironment.data : null,
    environmentCache: environmentCache.success
      ? toSandboxEnvironmentCacheSummary(environmentCache.data)
      : null,
  };
}

export function formatProjectCapability(row: ProjectCapabilityRow): ProjectCapability {
  const configuration =
    typeof row.configuration === "string"
      ? (safeParseJson<Record<string, unknown>>(row.configuration) ?? {})
      : (row.configuration ?? {});

  return {
    id: row.id,
    projectId: row.project_id,
    kind: row.kind,
    capabilityId: row.capability_id,
    configuration,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export function formatProjectConversation(row: ProjectConversationRow): ProjectConversation {
  const group = row.group ? safeParseJson<ProjectConversation["group"]>(row.group) : null;
  const snooze =
    row.snoozed_until && Date.parse(row.snoozed_until) > Date.now()
      ? ({ kind: "until", until: row.snoozed_until } as const)
      : row.snoozed_next_response_at && row.next_response_arrived !== 1
        ? ({ kind: "next_response" } as const)
        : null;

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    messageCount: Number(row.message_count ?? 0),
    isPinned: row.is_pinned === 1,
    isUnread: isConversationUnread(row),
    snooze,
    group,
    createdBy: {
      id: row.created_by,
      name: row.created_by_name,
      avatarUrl: row.created_by_avatar_url,
    },
  };
}

export function parseProjectFlow(raw: string | null | undefined): ProjectFlow | null {
  if (!raw) {
    return null;
  }

  const parsed = projectFlowSchema.safeParse(
    typeof raw === "string" ? safeParseJson<unknown>(raw) : raw,
  );

  return parsed.success ? parsed.data : null;
}

export function formatProjectDetail(params: {
  project: ProjectRow;
  capabilities: ProjectCapabilityRow[];
  conversations: ProjectConversationRow[];
}): ProjectDetail {
  return {
    ...formatProjectSummary(params.project),
    capabilities: params.capabilities.map(formatProjectCapability),
    conversations: params.conversations.map(formatProjectConversation),
    flow: parseProjectFlow(params.project.flow),
  };
}
