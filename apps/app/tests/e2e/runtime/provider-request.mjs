export function normaliseResponsesRequest(body) {
  const input = Array.isArray(body.input) ? body.input : [{ role: "user", content: body.input }];

  return {
    ...body,
    messages: input.map((item) => ({
      role: item.type === "function_call_output" ? "tool" : item.role,
      content:
        item.type === "function_call_output"
          ? item.output
          : Array.isArray(item.content)
            ? item.content.map((part) => part.text ?? "").join("\n")
            : item.content,
    })),
    tools: body.tools?.map((tool) => ({ ...tool, function: tool })),
  };
}

export function responsesToolCallResponse(toolCall, model, stream) {
  const item = {
    id: toolCall.id,
    call_id: toolCall.id,
    type: "function_call",
    name: toolCall.function.name,
    arguments: toolCall.function.arguments,
    status: "completed",
  };
  const response = {
    id: "e2e-responses-tool-completion",
    object: "response",
    status: "completed",
    model,
    output: [item],
    usage: { input_tokens: 8, output_tokens: 4, total_tokens: 12 },
  };

  if (!stream) {
    return Response.json(response);
  }

  const events = [
    {
      type: "response.output_item.added",
      output_index: 0,
      item: { ...item, arguments: "", status: "in_progress" },
    },
    {
      type: "response.function_call_arguments.delta",
      item_id: item.id,
      output_index: 0,
      delta: item.arguments,
    },
    {
      type: "response.function_call_arguments.done",
      item_id: item.id,
      output_index: 0,
      arguments: item.arguments,
    },
    { type: "response.output_item.done", output_index: 0, item },
    { type: "response.completed", response },
  ];

  return new Response(
    events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""),
    {
      headers: { "content-type": "text/event-stream; charset=utf-8" },
    },
  );
}
