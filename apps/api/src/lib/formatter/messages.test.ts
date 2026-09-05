import { describe, expect, it } from "vitest";

import { MessageFormatter } from "./messages";

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

    expect(assistant.content).toEqual([
      {
        type: "text",
        text: "Here is the briefing.",
        cache_control: { type: "ephemeral" },
      },
    ]);
  });
});
