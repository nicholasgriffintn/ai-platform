import { isRecord } from "@ngriffin_uk/polychat-utility-core";

const FORWARDED_REQUEST_FIELDS = [
  "messages",
  "tools",
  "tool_choice",
  "parallel_tool_calls",
  "response_format",
  "temperature",
  "top_p",
  "max_tokens",
] as const;

export interface BridgedCompletionRequest {
  body: Record<string, unknown>;
  stream: boolean;
}

export interface OpenAICompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string | null; tool_calls?: OpenAIToolCall[] };
    finish_reason: string;
  }>;
  usage?: Record<string, unknown>;
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export function toPolychatCompletionRequest(
  body: Record<string, unknown>,
  modelTier: string,
): BridgedCompletionRequest {
  const forwarded = Object.fromEntries(
    FORWARDED_REQUEST_FIELDS.filter((field) => body[field] !== undefined).map((field) => [
      field,
      body[field],
    ]),
  );

  return {
    stream: body.stream === true,
    body: {
      ...forwarded,
      model_tier: modelTier,
      stream: false,
      store: false,
      enabled_tools: [],
    },
  };
}

function toOpenAIToolCalls(value: unknown): OpenAIToolCall[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((call) => {
    if (!isRecord(call) || typeof call.id !== "string" || !isRecord(call.function)) {
      return [];
    }

    const { name, arguments: args } = call.function;

    if (typeof name !== "string") {
      return [];
    }

    return [
      {
        id: call.id,
        type: "function" as const,
        function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) },
      },
    ];
  });
}

function textContent(value: unknown): string | null {
  if (typeof value === "string") {
    return value || null;
  }

  if (Array.isArray(value)) {
    const text = value
      .map((part) => (isRecord(part) && typeof part.text === "string" ? part.text : ""))
      .join("");

    return text || null;
  }

  return null;
}

export function toOpenAICompletion(payload: unknown, model: string): OpenAICompletion | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const choice = payload.choices[0];

  if (!isRecord(choice) || !isRecord(choice.message)) {
    return null;
  }

  const toolCalls = toOpenAIToolCalls(choice.message.tool_calls);

  return {
    id: typeof payload.id === "string" ? payload.id : "chatcmpl-polychat",
    object: "chat.completion",
    created: typeof payload.created === "number" ? payload.created : Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: textContent(choice.message.content),
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason:
          toolCalls.length > 0
            ? "tool_calls"
            : typeof choice.finish_reason === "string"
              ? choice.finish_reason
              : "stop",
      },
    ],
    ...(isRecord(payload.usage) ? { usage: payload.usage } : {}),
  };
}

export function toOpenAICompletionStream(completion: OpenAICompletion): string {
  const [choice] = completion.choices;
  const base = {
    id: completion.id,
    object: "chat.completion.chunk",
    created: completion.created,
    model: completion.model,
  };
  const delta = {
    role: "assistant",
    ...(choice?.message.content ? { content: choice.message.content } : {}),
    ...(choice?.message.tool_calls
      ? {
          tool_calls: choice.message.tool_calls.map((call, index) => ({ index, ...call })),
        }
      : {}),
  };
  const events = [
    { ...base, choices: [{ index: 0, delta, finish_reason: null }] },
    {
      ...base,
      choices: [{ index: 0, delta: {}, finish_reason: choice?.finish_reason ?? "stop" }],
      ...(completion.usage ? { usage: completion.usage } : {}),
    },
  ];

  return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")}data: [DONE]\n\n`;
}
