import { CRISIS_SIGNPOST_TEXT } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { describeGuardrailBlock } from "../guardrails";

describe("describeGuardrailBlock", () => {
  it("signposts a block when the check flags self-harm", () => {
    expect(describeGuardrailBlock("input", ["self-harm"])).toContain(CRISIS_SIGNPOST_TEXT);
    expect(describeGuardrailBlock("output", ["Suicide & Self-Harm"])).toContain(
      CRISIS_SIGNPOST_TEXT,
    );
  });

  it("signposts a block for another reason when the message raised it", () => {
    expect(describeGuardrailBlock("input", ["hate"], { crisisSignpost: true })).toContain(
      CRISIS_SIGNPOST_TEXT,
    );
    expect(describeGuardrailBlock("input", ["hate"])).not.toContain(CRISIS_SIGNPOST_TEXT);
  });
});
