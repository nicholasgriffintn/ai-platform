const PERSONAL_CHAT_PATH = "/chat";
const LEGACY_CONVERSATION_QUERY_PARAM = "completion_id";

export function getPersonalConversationPath(conversationId: string): string {
  return `${PERSONAL_CHAT_PATH}/${encodeURIComponent(conversationId)}`;
}

export function getProjectBasePath(workspaceId: string, projectId: string): string {
  return `/work/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`;
}

export function getProjectChatPath(workspaceId: string, projectId: string): string {
  return `${getProjectBasePath(workspaceId, projectId)}/chat`;
}

export function getProjectConversationPath(
  workspaceId: string,
  projectId: string,
  conversationId?: string,
): string {
  const chatPath = getProjectChatPath(workspaceId, projectId);

  return conversationId ? `${chatPath}/${encodeURIComponent(conversationId)}` : chatPath;
}

export function isProjectConversationPath(pathname: string): boolean {
  return /^\/work\/[^/]+\/projects\/[^/]+\/chat(\/|$)/.test(pathname);
}

export function readLegacyConversationQuery(search: string): string | undefined {
  return new URLSearchParams(search).get(LEGACY_CONVERSATION_QUERY_PARAM) ?? undefined;
}

export function resolvePersonalConversationId(
  pathConversationId: string | undefined,
  search: string,
): string | undefined {
  return pathConversationId ?? readLegacyConversationQuery(search);
}

export function resolveProjectConversationId(
  pathConversationId: string | undefined,
  search: string,
): string | undefined {
  return pathConversationId ?? readLegacyConversationQuery(search);
}
