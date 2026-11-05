import { CRISIS_SIGNPOST_TEXT } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildLiveCrisisNotice, createLiveTurn } from "./live-turn-messages.js";

describe("buildLiveCrisisNotice", () => {
  it("adds a finished assistant message for a crisis transcript", () => {
    const notice = buildLiveCrisisNotice({ text: "I want to die", turn: createLiveTurn() });

    expect(notice).toMatchObject({ role: "assistant", content: CRISIS_SIGNPOST_TEXT });
    expect(notice?.status).toBeUndefined();
  });

  it("adds nothing for other speech", () => {
    expect(buildLiveCrisisNotice({ text: "what's the time", turn: createLiveTurn() })).toBeNull();
  });
});
