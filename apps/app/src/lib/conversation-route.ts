const PERSONAL_CHAT_PATH = "/chat";

export function getPersonalConversationPath(conversationId: string): string {
  return `${PERSONAL_CHAT_PATH}/${encodeURIComponent(conversationId)}`;
}

export function getProjectConversationPath(
  pathname: string,
  search: string,
  conversationId: string,
): string {
  const params = new URLSearchParams(search);

  params.set("completion_id", conversationId);

  return `${pathname}?${params}`;
}

export function resolvePersonalConversationId(
  pathConversationId: string | undefined,
  search: string,
): string | undefined {
  return pathConversationId ?? new URLSearchParams(search).get("completion_id") ?? undefined;
}
