import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistantError } from "~/utils/errors";

import { ShieldstralGuardProvider } from "../shieldstral";

const { fetchAIResponse } = vi.hoisted(() => ({
  fetchAIResponse: vi.fn(),
}));

vi.mock("~/lib/providers/lib/fetch", () => ({
  fetchAIResponse,
}));

vi.mock("~/utils/logger", () => ({
  getLogger: () => ({
    debug: vi.fn(),
  }),
}));

function response(yesLogprob: number, noLogprob: number) {
  return {
    choices: [
      {
        logprobs: {
          content: [
            {
              top_logprobs: [
                { token: " yes", logprob: yesLogprob },
                { token: " no", logprob: noLogprob },
              ],
            },
          ],
        },
      },
    ],
  };
}

describe("ShieldstralGuardProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("classifies text with the configured server-owned policy", async () => {
    fetchAIResponse.mockResolvedValue(response(-3, -0.1));
    const provider = new ShieldstralGuardProvider({
      baseUrl: "https://shieldstral.example",
      apiKey: "test-token",
      policy: "Apply the project safety policy.",
      policyVersion: "project-v2",
      threshold: 0.4,
    });

    const result = await provider.validateContent("A benign question", "INPUT");

    expect(result.isValid).toBe(true);
    expect(result.rawResponse).toEqual(
      expect.objectContaining({
        policyVersion: "project-v2",
        threshold: 0.4,
        verdict: "safe",
      }),
    );
    expect(fetchAIResponse).toHaveBeenCalledWith(
      true,
      "shieldstral",
      "https://shieldstral.example/v1/chat/completions",
      expect.objectContaining({ Authorization: "Bearer test-token" }),
      expect.objectContaining({
        logprobs: true,
        max_tokens: 1,
        messages: [
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("<Query>: Is this prompt unsafe?"),
          }),
        ],
        top_logprobs: 20,
      }),
      undefined,
      expect.any(Object),
    );
  });

  it("moderates prompt-response pairs and images", async () => {
    fetchAIResponse.mockResolvedValue(response(-0.1, -3));
    const provider = new ShieldstralGuardProvider({
      baseUrl: "https://shieldstral.example/",
    });

    const result = await provider.validateContent(
      {
        text: "Unsafe answer",
        prompt: "User request",
        images: [{ url: "data:image/png;base64,AAAA", detail: "high" }],
      },
      "OUTPUT",
    );

    expect(result).toEqual(
      expect.objectContaining({
        isValid: false,
        violations: ["unsafe_response"],
      }),
    );
    const requestBody = fetchAIResponse.mock.calls[0]?.[4];
    const content = requestBody.messages[1].content;

    expect(content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          image_url: expect.objectContaining({ url: "data:image/png;base64,AAAA" }),
        }),
        expect.objectContaining({ text: expect.stringContaining("[User]\nUser request") }),
        expect.objectContaining({ text: expect.stringContaining("[Assistant]\nUnsafe answer") }),
      ]),
    );
  });

  it("fails closed when the classifier omits a verdict probability", async () => {
    fetchAIResponse.mockResolvedValue({
      choices: [{ logprobs: { content: [{ top_logprobs: [{ token: "yes", logprob: -0.1 }] }] } }],
    });
    const provider = new ShieldstralGuardProvider({
      baseUrl: "https://shieldstral.example",
    });

    await expect(provider.validateContent("content", "INPUT")).rejects.toBeInstanceOf(
      AssistantError,
    );
  });

  it("rejects invalid endpoint and threshold configuration", async () => {
    const missingEndpoint = new ShieldstralGuardProvider({});
    const invalidThreshold = new ShieldstralGuardProvider({
      baseUrl: "https://shieldstral.example",
      threshold: 1.1,
    });

    await expect(missingEndpoint.validateContent("content", "INPUT")).rejects.toBeInstanceOf(
      AssistantError,
    );
    await expect(invalidThreshold.validateContent("content", "INPUT")).rejects.toBeInstanceOf(
      AssistantError,
    );
    expect(fetchAIResponse).not.toHaveBeenCalled();
  });
});
