import type { SearchResult, SearchResultKind } from "@ngriffin_uk/polychat-component-navigation";
import type { Conversation } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type {
  AssistantActionItem,
  GlobalSearchResponse,
  ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";

import { getCapabilityOpenPath, PERSONAL_SURFACE } from "~/lib/capability-surfaces";
import { getPersonalConversationPath } from "~/lib/conversation-route";

export type GlobalSearchResultKind = SearchResultKind;

export interface GlobalSearchResult extends SearchResult {
  searchText: string;
  updatedAt?: string | null;
}

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function searchScore(item: GlobalSearchResult, query: string): number {
  const title = normalise(item.title);
  const searchText = normalise(item.searchText);

  if (title === query) {
    return 100;
  }

  if (title.startsWith(query)) {
    return 80;
  }

  if (title.includes(query)) {
    return 60;
  }

  if (searchText.includes(query)) {
    return 30;
  }

  return 0;
}

function resultTimestamp(item: GlobalSearchResult): number {
  if (!item.updatedAt) {
    return 0;
  }

  const timestamp = Date.parse(item.updatedAt);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function capabilityDescription(item: AssistantActionItem): string {
  if (item.kind === "recipe" || item.kind === "installed_recipe") {
    return "Recipe";
  }

  if (item.kind === "tool") {
    return "Tool";
  }

  return "Experience";
}

export function buildGlobalSearchResults({
  capabilities,
  experiences,
  localConversations,
  remote,
}: {
  capabilities: AssistantActionItem[];
  experiences: ProjectExperienceDefinition[];
  localConversations: Conversation[];
  remote?: GlobalSearchResponse;
}): GlobalSearchResult[] {
  const remoteConversationIds = new Set(remote?.conversations.map((item) => item.id) ?? []);
  const remoteResults: GlobalSearchResult[] = remote
    ? [
        ...remote.conversations.map((conversation) => ({
          id: `conversation:${conversation.id}`,
          kind: "conversation" as const,
          title: conversation.title || "Untitled conversation",
          description: conversation.project
            ? `${conversation.project.name} · ${conversation.project.workspaceName}${conversation.isUnread ? " · Unread" : ""}${conversation.snooze ? " · Snoozed" : ""}`
            : `Personal chat${conversation.isUnread ? " · Unread" : ""}${conversation.snooze ? " · Snoozed" : ""}`,
          href: conversation.project
            ? `/work/${conversation.project.workspaceId}/projects/${conversation.project.id}/chat?completion_id=${encodeURIComponent(conversation.id)}`
            : getPersonalConversationPath(conversation.id),
          searchText: `${conversation.title ?? ""} ${conversation.project?.name ?? ""} ${conversation.project?.workspaceName ?? ""} ${conversation.labels.map((label) => label.name).join(" ")}`,
          updatedAt: conversation.updatedAt,
        })),
        ...remote.projects.map((project) => ({
          id: `project:${project.id}`,
          kind: "project" as const,
          title: project.name,
          description: `Project · ${project.workspaceName}`,
          href: `/work/${project.workspaceId}/projects/${project.id}`,
          searchText: `${project.name} ${project.description} ${project.workspaceName}`,
          updatedAt: project.updatedAt,
        })),
        ...remote.workspaces.map((workspace) => ({
          id: `workspace:${workspace.id}`,
          kind: "workspace" as const,
          title: workspace.name,
          description: "Workspace",
          href: `/work/${workspace.id}`,
          searchText: `${workspace.name} ${workspace.description}`,
          updatedAt: workspace.updatedAt,
        })),
      ]
    : [];

  const localResults: GlobalSearchResult[] = localConversations
    .filter((conversation) => conversation.id && !remoteConversationIds.has(conversation.id))
    .map((conversation) => ({
      id: `conversation:${conversation.id}`,
      kind: "conversation",
      title: conversation.title || "Untitled conversation",
      description: conversation.isLocalOnly ? "Local chat" : "Personal chat",
      href: getPersonalConversationPath(conversation.id!),
      searchText: conversation.title ?? "",
      updatedAt:
        conversation.updated_at ?? conversation.last_message_at ?? conversation.created_at ?? null,
    }));

  const capabilityResults: GlobalSearchResult[] = capabilities.map((capability) => ({
    id: `capability:${capability.kind}:${capability.capability.id}`,
    kind: "capability",
    title: capability.label,
    description: capabilityDescription(capability),
    href: getCapabilityOpenPath(capability, PERSONAL_SURFACE, experiences) ?? "/chat/capabilities",
    searchText: [
      capability.label,
      capability.description,
      capability.metadata?.category,
      ...capability.searchText,
    ]
      .filter(Boolean)
      .join(" "),
  }));

  return [...remoteResults, ...localResults, ...capabilityResults];
}

export function rankGlobalSearchResults(
  items: GlobalSearchResult[],
  query: string,
  limit = 30,
): GlobalSearchResult[] {
  const normalisedQuery = normalise(query);

  if (!normalisedQuery) {
    return items
      .filter((item) => item.kind !== "capability")
      .sort((left, right) => resultTimestamp(right) - resultTimestamp(left))
      .slice(0, limit);
  }

  return items
    .map((item) => ({ item, score: searchScore(item, normalisedQuery) }))
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score || resultTimestamp(right.item) - resultTimestamp(left.item),
    )
    .slice(0, limit)
    .map(({ item }) => item);
}
