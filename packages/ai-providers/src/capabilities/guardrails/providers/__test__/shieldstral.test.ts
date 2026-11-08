import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShieldstralGuardProvider } from "../shieldstral.js";

const { fetchAIResponse } = vi.hoisted(() => ({
  fetchAIResponse: vi.fn(),
}));

vi.mock("../../../../fetch.js", () => ({
  fetchAIResponse,
}));

vi.mock("@ngriffin_uk/polychat-ai-telemetry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-telemetry")>()),
  getLogger: () => ({
    debug: vi.fn(),
  }),
}));

describe("ShieldstralGuardProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when the classifier omits a verdict probability", async () => {
    fetchAIResponse.mockResolvedValue({
      choices: [{ logprobs: { content: [{ top_logprobs: [{ token: "yes", logprob: -0.1 }] }] } }],
    });
    const provider = new ShieldstralGuardProvider({
      baseUrl: "https://shieldstral.example",
      model: "mistralai/Shieldstral-1.0-3B",
    });

    await expect(provider.validateContent("content", "INPUT")).rejects.toBeInstanceOf(
      AssistantError,
    );
  });
});
