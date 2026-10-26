const PERSONAL_CHAT_PATH = "/chat";

export function getPersonalConversationPath(conversationId: string): string {
  return `${PERSONAL_CHAT_PATH}/${encodeURIComponent(conversationId)}`;
}

export function getProjectBasePath(workspaceId: string, projectId: string): string {
  return `/work/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(projectId)}`;
}

export function getProjectNewTaskPath(workspaceId: string, projectId: string): string {
  return `${getProjectBasePath(workspaceId, projectId)}?new=1`;
}

export function getProjectConversationPath(
  workspaceId: string,
  projectId: string,
  conversationId?: string,
): string {
  return conversationId
    ? `${getProjectBasePath(workspaceId, projectId)}/chat/${encodeURIComponent(conversationId)}`
    : getProjectNewTaskPath(workspaceId, projectId);
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
