import { describe, expect, it } from "vitest";

import { googleAiStudioModelConfig } from "~/data-model/models/google-ai-studio";
import { MessageFormatter } from "~/lib/formatter";
import { GoogleStudioProvider } from "~/lib/providers/capabilities/chat/providers/googlestudio";
import type { ChatCompletionParameters } from "~/types";

import { buildGoogleStudioTools, formatGoogleStudioContents } from "./googleStudio";

describe("formatGoogleStudioContents", () => {
  it("converts shared function-call history to Google's model and user parts", () => {
    const messages = MessageFormatter.formatMessages(
      [
        { role: "user", content: "Find the latest model update." },
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "call-search",
              type: "function",
              thought_signature: "signed-google-thought",
              function: {
                name: "web_search",
                arguments: '{"query":"Gemini 3.6 Flash latest update"}',
              },
            },
          ],
        },
        {
          role: "tool",
          name: "web_search",
          tool_call_id: "call-search",
          content: "Google lists the latest update as July 2026.",
        },
      ],
      { provider: "google-ai-studio" },
    );

    expect(formatGoogleStudioContents({ messages })).toEqual([
      {
        role: "user",
        parts: [{ text: "Find the latest model update." }],
      },
      {
        role: "model",
        parts: [
          {
            thoughtSignature: "signed-google-thought",
            functionCall: {
              id: "call-search",
              name: "web_search",
              args: { query: "Gemini 3.6 Flash latest update" },
            },
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            functionResponse: {
              id: "call-search",
              name: "web_search",
              response: {
                output: "[Tool Response: web_search] Google lists the latest update as July 2026.",
              },
            },
          },
        ],
      },
    ]);
  });
});

describe("buildGoogleStudioTools", () => {
  it("sends native selections without cross-model function declarations", () => {
    const tools = buildGoogleStudioTools(
      {
        enabled_tools: ["search_grounding", "code_execution"],
      },
      googleAiStudioModelConfig["gemini-flash-latest"],
    );

    expect(tools).toEqual([{ code_execution: {} }, { google_search: {} }]);
  });

  it("maps the canonical web fetch selection to Google's URL context tool", () => {
    const tools = buildGoogleStudioTools(
      {
        enabled_tools: ["web_fetch"],
      },
      googleAiStudioModelConfig["gemini-flash-latest"],
    );

    expect(tools).toEqual([{ url_context: {} }]);
  });

  it("sends function inputs through Google's full JSON Schema field", () => {
    const tools = buildGoogleStudioTools(
      {
        enabled_tools: ["example_tool"],
        tools: [
          {
            type: "function",
            function: {
              name: "example_tool",
              description: "Accept nested structured input",
              parameters: {
                type: "object",
                properties: {
                  metadata: {
                    type: "object",
                    additionalProperties: { type: "string" },
                  },
                  entries: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                    },
                  },
                },
                required: ["metadata"],
                additionalProperties: false,
              },
            },
          },
        ],
      },
      googleAiStudioModelConfig["gemini-flash-latest"],
    );

    expect(tools).toEqual([
      {
        functionDeclarations: [
          {
            name: "example_tool",
            description: "Accept nested structured input",
            parametersJsonSchema: {
              type: "object",
              properties: {
                metadata: {
                  type: "object",
                  additionalProperties: { type: "string" },
                },
                entries: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                  },
                },
              },
              required: ["metadata"],
              additionalProperties: false,
            },
          },
        ],
      },
    ]);
  });
});

describe("Google AI Studio native tool capabilities", () => {
  it.each([
    "gemini-flash-latest",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
  ])("exposes the supported native tools for %s", (modelId) => {
    expect(googleAiStudioModelConfig[modelId]).toMatchObject({
      supportsCodeExecution: true,
      supportsSearchGrounding: true,
      supportsUrlContext: true,
      supportsWebFetch: true,
    });
  });
});

describe("GoogleStudioProvider", () => {
  it("keeps an explicit native search selection in the Google-bound payload", async () => {
    const params: ChatCompletionParameters = {
      model: "gemini-flash-latest",
      provider: "google-ai-studio",
      env: {},
      messages: [{ role: "user", content: "Find the latest Gemini update." }],
      enabled_tools: ["search_grounding"],
      stream: true,
    };

    const payload = await new GoogleStudioProvider().mapParameters(params);

    expect(payload.tools).toEqual([{ google_search: {} }]);
  });

  it("does not overwrite native search when cross-model functions are present", async () => {
    const params: ChatCompletionParameters = {
      model: "gemini-flash-latest",
      provider: "google-ai-studio",
      env: {},
      messages: [{ role: "user", content: "Find the latest Gemini update." }],
      enabled_tools: ["search_grounding", "get_weather"],
      stream: true,
    };

    const payload = await new GoogleStudioProvider().mapParameters(params);

    expect(payload.tools).toEqual([
      { google_search: {} },
      {
        functionDeclarations: expect.arrayContaining([
          expect.objectContaining({ name: "get_weather" }),
        ]),
      },
    ]);
  });
});
