export function resolveMetaModelTool(body, prompt) {
  const system = (body.messages ?? [])
    .filter((message) => message.role === "system" && typeof message.content === "string")
    .map((message) => message.content)
    .join("\n");
  const mode = system.includes("<mode>Work</mode>") ? "work" : "chat";
  let name;
  let args;

  if (prompt === "Open Files for this release") {
    name = "open_place";
    args = { target: { kind: "place", place: "files", mode } };
  } else if (prompt === "Open Attention for this release") {
    name = "open_place";
    args = { target: { kind: "place", place: "attention", mode } };
  } else if (prompt === "Archive the open release conversation") {
    const conversationId = system.match(
      /<open_conversation_id>([^<]+)<\/open_conversation_id>/,
    )?.[1];
    if (!conversationId) return null;
    name = "organise_conversation";
    args = { conversationId, action: "archive" };
  } else if (prompt === "File a release task from this bot") {
    name = "create_task";
    args = { title: "Forbidden bot release task", objective: "Must never execute" };
  } else {
    return null;
  }

  return {
    id: `e2e-${name}`,
    type: "function",
    function: { name, arguments: JSON.stringify(args) },
  };
}
