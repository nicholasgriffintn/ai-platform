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
