import { describe, expect, it } from "vitest";

import type { Message } from "../types/index.js";
import { MessageFormatter } from "./messages.js";

describe("OpenAI Responses history formatting", () => {
  it("uses output_text for assistant arrays and omits displayed reasoning summaries", () => {
    expect(
      MessageFormatter.formatOpenAIResponsesInput([
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Safe reasoning summary" },
            { type: "text", text: "Final answer" },
          ],
        },
      ]),
    ).toEqual([
      {
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: "Final answer" }],
      },
    ]);
  });

  it("keeps user arrays as input content", () => {
    expect(
      MessageFormatter.formatOpenAIResponsesInput([
        {
          role: "user",
          content: [{ type: "text", text: "Question" }],
        },
      ]),
    ).toEqual([
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "Question" }],
      },
    ]);
  });

  it("expands a message selection as explicitly quoted input", () => {
    expect(
      MessageFormatter.formatOpenAIResponsesInput([
        {
          role: "user",
          content: [
            {
              type: "selection",
              selection: {
                source: { kind: "message", messageId: "assistant-1", role: "assistant" },
                selectedText: "A saved excerpt.",
                comment: "Explain this.",
              },
            },
          ],
        },
      ]),
    ).toEqual([
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "<selection>",
              '<source kind="message" message_id="assistant-1" role="assistant" />',
              "<selected_text>",
              "A saved excerpt.",
              "</selected_text>",
              "<comment>",
              "Explain this.",
              "</comment>",
              "</selection>",
            ].join("\n"),
          },
        ],
      },
    ]);
  });

  it("preserves explicit prompt cache breakpoints on input content", () => {
    expect(
      MessageFormatter.formatOpenAIResponsesInput([
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Stable prefix",
              prompt_cache_breakpoint: { mode: "explicit" },
            },
          ],
        },
      ]),
    ).toEqual([
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Stable prefix",
            prompt_cache_breakpoint: { mode: "explicit" },
          },
        ],
      },
    ]);
  });
});

describe("Mistral reasoning history formatting", () => {
  it("replays thinking chunks in Mistral's nested content shape", () => {
    expect(
      MessageFormatter.formatMessages(
        [
          {
            role: "assistant",
            content: [
              { type: "thinking", thinking: "Preserved reasoning" },
              { type: "text", text: "Final answer" },
            ],
          },
        ],
        { provider: "mistral" },
      ),
    ).toEqual([
      {
        role: "assistant",
        content: [
          {
            type: "thinking",
            thinking: [{ type: "text", text: "Preserved reasoning" }],
          },
          { type: "text", text: "Final answer" },
        ],
      },
    ]);
  });
});

describe("Anthropic history formatting", () => {
  const formatForAnthropic = (messages: any[]) =>
    MessageFormatter.formatMessages(messages, { provider: "anthropic" });

  it("drops a tool-calling assistant turn that carried no text", () => {
    expect(
      formatForAnthropic([
        { role: "user", content: "Run my briefing." },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            { id: "toolu_1", type: "function", function: { name: "discover", arguments: "{}" } },
          ],
        },
      ]),
    ).toEqual([
      {
        role: "user",
        content: [{ type: "text", text: "Run my briefing.", cache_control: { type: "ephemeral" } }],
      },
    ]);
  });

  it("drops an assistant turn left empty once thinking blocks are stripped", () => {
    expect(
      formatForAnthropic([
        { role: "user", content: "Run my briefing." },
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "Working through it", signature: "sig" },
            { type: "text", text: "" },
          ],
          tool_calls: [
            { id: "toolu_1", type: "function", function: { name: "discover", arguments: "{}" } },
          ],
        },
      ]),
    ).toHaveLength(1);
  });

  it("keeps the text block an assistant turn actually produced", () => {
    const [, assistant] = formatForAnthropic([
      { role: "user", content: "Run my briefing." },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "Working through it", signature: "sig" },
          { type: "text", text: "Here is the briefing." },
        ],
      },
    ]);

    expect(assistant?.content).toEqual([
      {
        type: "text",
        text: "Here is the briefing.",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });
});

describe("Google Vertex history formatting", () => {
  const formatForVertex = (messages: any[]) =>
    MessageFormatter.formatMessages(messages, { provider: "google-vertex" });

  it("builds Google parts so Vertex receives non-empty contents", () => {
    expect(formatForVertex([{ role: "user", content: "Run my briefing." }])).toEqual([
      {
        role: "user",
        parts: [{ text: "Run my briefing." }],
        content: "",
      },
    ]);
  });

  it("keeps the system prompt out of contents", () => {
    const formatted = MessageFormatter.formatMessages([{ role: "user", content: "Hello" }], {
      provider: "google-vertex",
      system_prompt: "Be terse.",
    });

    expect(formatted.some((message) => message.role === "system")).toBe(false);
  });
});

describe("Workers AI history formatting", () => {
  it("keeps image parts as chat content so vision chat models get messages, not a caption prompt", () => {
    const image = { type: "image_url" as const, image_url: { url: "data:image/jpeg;base64,aGk=" } };
    const formatted = MessageFormatter.formatMessages(
      [{ role: "user", content: [{ type: "text", text: "Where is this?" }, image] }],
      { provider: "workers-ai" },
    );

    expect(formatted).toEqual([
      { role: "user", content: [{ type: "text", text: "Where is this?" }, image] },
    ]);
  });

  it("sends text-only histories as plain strings", () => {
    const formatted = MessageFormatter.formatMessages(
      [
        { role: "user", content: [{ type: "text", text: "Summarise this" }] },
        { role: "assistant", content: "Done." },
      ],
      { provider: "workers-ai", system_prompt: "Be terse." },
    );

    expect(formatted.map((message) => message.content)).toEqual([
      "Be terse.",
      "Summarise this",
      "Done.",
    ]);
  });

  it("sends every message as parts once any message carries an image", () => {
    const image = { type: "image_url" as const, image_url: { url: "data:image/jpeg;base64,aGk=" } };
    const formatted = MessageFormatter.formatMessages(
      [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi." },
        { role: "user", content: [{ type: "text", text: "Where is this?" }, image] },
      ],
      { provider: "workers-ai", system_prompt: "Be terse." },
    );

    expect(formatted.every((message) => Array.isArray(message.content))).toBe(true);
    expect(formatted[0]).toEqual({
      role: "system",
      content: [{ type: "text", text: "Be terse." }],
    });
  });
});

describe("tool result images", () => {
  const image = { type: "image_url" as const, image_url: { url: "data:image/png;base64,aGk=" } };
  const toolMessage: Message = {
    role: "tool",
    name: "inspo",
    tool_call_id: "call-1",
    content: [{ type: "text", text: "One screen [image 1 attached]" }, image],
  };
  const history: Message[] = [
    {
      role: "assistant",
      content: "",
      tool_calls: [
        { id: "call-1", type: "function", function: { name: "inspo", arguments: "{}" } },
        { id: "call-2", type: "function", function: { name: "weather", arguments: "{}" } },
      ],
    },
    toolMessage,
    { role: "tool", name: "weather", tool_call_id: "call-2", content: "Sunny" },
  ];

  it("keeps tool replies together and sends their images in one user message after them", () => {
    const formatted = MessageFormatter.formatMessages(history, { provider: "openai" });

    expect(formatted.map((message) => message.role)).toEqual(["assistant", "tool", "tool", "user"]);
    expect(String(formatted[1]?.content)).not.toContain("base64");
    expect(formatted[3]?.content).toEqual([
      { type: "text", text: "Images returned by the tool results above:" },
      image,
    ]);
  });

  it("puts images inside the Anthropic tool result", () => {
    const formatted = MessageFormatter.formatMessages([toolMessage], { provider: "anthropic" });
    const [, resultMessage] = formatted;
    const toolResult = Array.isArray(resultMessage?.content) ? resultMessage.content[0] : undefined;

    expect(toolResult?.content).toEqual([
      expect.objectContaining({ type: "text" }),
      { type: "image", source: { type: "base64", media_type: "image/png", data: "aGk=" } },
    ]);
  });

  it("adds a Responses input image after the function outputs", () => {
    const items = MessageFormatter.formatOpenAIResponsesInput(history);

    expect(items.map((item) => item.type)).toEqual([
      "function_call",
      "function_call",
      "function_call_output",
      "function_call_output",
      "message",
    ]);
    expect(items.at(-1)).toMatchObject({
      role: "user",
      content: [{ type: "input_text" }, { type: "input_image", image_url: image.image_url.url }],
    });
  });
});
