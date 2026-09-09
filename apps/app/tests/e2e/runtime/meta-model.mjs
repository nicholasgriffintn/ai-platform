export function resolveMetaModelTool(body, prompt) {
  const system = [
    body.instructions ?? "",
    ...(body.messages ?? [])
      .filter((message) => message.role === "system" || message.role === "developer")
      .map((message) =>
        typeof message.content === "string"
          ? message.content
          : (message.content ?? []).map((part) => part.text ?? "").join("\n"),
      ),
  ].join("\n");
  const mode = system.includes("<mode>Work</mode>") ? "work" : "chat";
  let name;
  let args;

  if (prompt === "Find the release navigation conversation") {
    name = "find_places";
    args = { query: "Release navigation evidence" };
  } else if (prompt === "Open the release conversation you found") {
    const found = (body.messages ?? []).findLast(
      (message) =>
        message.role === "tool" &&
        typeof message.content === "string" &&
        message.content.includes("Release navigation evidence"),
    );
    const conversationId = found?.content.match(/Release navigation evidence \(([^)]+)\)/)?.[1];

    if (!conversationId) {
      return null;
    }

    name = "open_place";
    args = { target: { kind: "conversation", conversationId } };
  } else if (prompt === "Open Files for this release") {
    name = "open_place";
    args = { target: { kind: "place", place: "files", mode } };
  } else if (prompt === "Open Attention for this release") {
    name = "open_place";
    args = { target: { kind: "place", place: "attention", mode } };
  } else if (prompt === "Archive the open release conversation") {
    const conversationId = system.match(
      /<open_conversation_id>([^<]+)<\/open_conversation_id>/,
    )?.[1];

    if (!conversationId) {
      return null;
    }

    name = "organise_conversation";
    args = { conversationId, action: "archive" };
  } else if (prompt === "File a release task from this bot") {
    name = "create_task";
    args = { title: "Forbidden bot release task", objective: "Must never execute" };
  } else {
    return null;
  }

  return {
    id: `e2e-${name}-${body.messages?.length ?? 0}`,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}
