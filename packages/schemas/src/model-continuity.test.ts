import { describe, expect, it } from "vitest";

import { evaluateModelContinuity } from "./model-continuity";
import type { ModelConfigItem } from "./models";

function model(overrides: Partial<ModelConfigItem> = {}): ModelConfigItem {
  return {
    matchingModel: "gpt-test",
    name: "Test model",
    provider: "test",
    modalities: { input: ["text"], output: ["text"] },
    ...overrides,
  };
}

describe("evaluateModelContinuity", () => {
  it("does not strand an approval on the run that requested it", () => {
    expect(
      evaluateModelContinuity({
        activeRunStatus: "awaiting_approval",
        hasConversationHistory: true,
        nextModel: model(),
      }),
    ).toMatchObject({
      state: "blocked",
      doesNotCarry: expect.arrayContaining(["pending_interaction"]),
    });
  });

  it("requires a new conversation for a one-turn image generator", () => {
    expect(
      evaluateModelContinuity({
        hasConversationHistory: true,
        nextModel: model({ modalities: { input: ["text"], output: ["image"] } }),
      }),
    ).toMatchObject({ state: "new_conversation_required", preserves: [] });
  });

  it("identifies attachments the next model cannot accept", () => {
    expect(
      evaluateModelContinuity({
        attachmentTypes: ["image", "document"],
        hasConversationHistory: true,
        nextModel: model({ modalities: { input: ["text", "image"], output: ["text"] } }),
      }),
    ).toMatchObject({ state: "blocked", unsupportedAttachments: ["document"] });
  });

  it("preserves conversation history while resetting model-specific settings", () => {
    expect(
      evaluateModelContinuity({
        attachmentTypes: ["image"],
        hasConversationHistory: true,
        nextModel: model({ multimodal: true }),
      }),
    ).toEqual({
      state: "next_run",
      reason:
        "The next message starts a new run with Test model. Existing conversation history and compatible attachments remain; model-specific response settings reset.",
      preserves: ["conversation_history", "compatible_attachments"],
      doesNotCarry: ["model_response_settings"],
      unsupportedAttachments: [],
    });
  });
});
