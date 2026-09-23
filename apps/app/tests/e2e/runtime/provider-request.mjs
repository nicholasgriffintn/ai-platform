export function normaliseResponsesRequest(body) {
  const input = Array.isArray(body.input) ? body.input : [{ role: "user", content: body.input }];

  return {
    ...body,
    messages: input.map((item) => ({
      role: item.type === "function_call_output" ? "tool" : item.role,
      type: item.type,
      name: item.name,
      callId: item.call_id,
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

export function validateReleaseProviderRequest(url, body) {
  const requestText = JSON.stringify(body);
  const contracts = [
    {
      marker: "Release provider contract: Groq Chat",
      applies: () => String(body.model).includes("gpt-oss-120b"),
      valid: () =>
        url.pathname.endsWith("/chat/completions") &&
        Array.isArray(body.messages) &&
        body.messages.some((message) => message.role === "user"),
    },
    {
      marker: "Release provider contract: OpenAI Responses",
      applies: () => body.model === "gpt-6-astra",
      valid: () =>
        url.pathname.endsWith("/responses") &&
        Array.isArray(body.input) &&
        body.input.some((item) => item.role === "user"),
    },
    {
      marker: "Release provider contract: Anthropic Messages",
      applies: () => body.model === "claude-sonnet-4-6",
      valid: () =>
        url.pathname.endsWith("/v1/messages") &&
        Array.isArray(body.messages) &&
        body.messages.some((message) => message.role === "user") &&
        typeof body.max_tokens === "number",
    },
    {
      marker: "Release provider contract: Cohere Chat",
      applies: () => body.model === "command-a-03-2025",
      valid: () =>
        url.pathname.endsWith("/v2/chat") &&
        Array.isArray(body.messages) &&
        body.messages.some((message) => message.role === "user"),
    },
    {
      marker: "Release provider contract: Google Image",
      applies: () => body.model === "gemini-flash-lite-latest",
      valid: () =>
        url.pathname.includes("/v1beta/models/") &&
        Array.isArray(body.contents) &&
        body.contents.some(
          (item) =>
            item.role === "user" &&
            item.parts?.some(
              (part) => part.inlineData?.mimeType === "image/png" && part.inlineData?.data,
            ),
        ),
    },
    {
      marker: "Release provider contract: OpenAI Audio",
      applies: () => body.model === "gpt-audio-mini",
      valid: () =>
        url.pathname.endsWith("/chat/completions") &&
        Array.isArray(body.messages) &&
        body.messages.some(
          (message) =>
            Array.isArray(message.content) &&
            message.content.some(
              (part) => part.type === "input_audio" && part.input_audio?.format === "wav",
            ),
        ),
    },
    {
      marker: "Release provider contract: Replicate Image",
      applies: () => body.version === "prunaai/p-image-ideogram",
      valid: () =>
        url.pathname.endsWith("/v1/predictions") &&
        body.input?.prompt?.includes("Release provider contract: Replicate Image"),
    },
    {
      marker: "Release provider contract: Replicate Video",
      applies: () => body.version === "prunaai/p-video-2-pro",
      valid: () =>
        url.pathname.endsWith("/v1/predictions") &&
        body.input?.prompt?.includes("Release provider contract: Replicate Video"),
    },
  ];

  for (const contract of contracts) {
    if (
      contract.applies() &&
      (body.version || requestText.includes(contract.marker)) &&
      !contract.valid()
    ) {
      const contentTypes = body.messages?.map((message) => ({
        role: message.role,
        content: Array.isArray(message.content)
          ? message.content.map((part) => `${part.type}:${part.input_audio?.format ?? ""}`)
          : typeof message.content,
      }));

      throw new Error(
        `Invalid provider request for ${contract.marker}: ${url.pathname} ${JSON.stringify(contentTypes ?? [])}`,
      );
    }
  }
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
