import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { isChatSurfaceModel } from "../chat-surface.js";

describe("chat surface models", () => {
  it("keeps realtime transcription models available to Live while hiding batch transcription", () => {
    const transcription: ModelConfigItem = {
      matchingModel: "@cf/deepgram/flux",
      provider: "workers-ai",
      modalities: { input: ["audio"], output: ["text"] },
    };

    expect(isChatSurfaceModel({ ...transcription, supportsRealtimeSession: true })).toBe(true);
    expect(isChatSurfaceModel(transcription)).toBe(false);
  });
});
