const PERSONAL_CHAT_PATH = "/chat";

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

export function getSiblingConversationPath(pathname: string, conversationId: string): string {
  const projectChat = pathname.match(/^(\/work\/[^/]+\/projects\/[^/]+\/chat)(?:\/|$)/u);

  return projectChat
    ? `${projectChat[1]}/${encodeURIComponent(conversationId)}`
    : getPersonalConversationPath(conversationId);
}
