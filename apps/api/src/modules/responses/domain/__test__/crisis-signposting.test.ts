import { describe, expect, it } from "vitest";

import { CRISIS_SIGNPOST_TEXT, mentionsCrisis, withCrisisSignpost } from "../crisis-signposting";
import { describeGuardrailBlock } from "../guardrails";

describe("crisis signposting", () => {
  it.each([
    "I want to kill myself",
    "i've been feeling suicidal",
    "I don’t want to be alive",
    "there's no point in living",
    "everyone would be better off without me",
    "how many of these pills would be an overdose",
    "I keep thinking about self-harm",
    "my friend told me she is suicidal",
  ])("recognises %j", (text) => {
    expect(mentionsCrisis(text)).toBe(true);
  });

  it.each([
    "kill the process on port 3000",
    "how do I hurt less after a long run",
    "the suicide squad film was fine",
    "explain a suicide burn for a rocket landing",
    "this deadline is killing me",
    "how many tokens fit in the context window",
  ])("leaves %j alone", (text) => {
    expect(mentionsCrisis(text)).toBe(false);
  });

  it("leads with the signpost so length limits cannot cut it off", () => {
    expect(withCrisisSignpost("reply").startsWith(CRISIS_SIGNPOST_TEXT)).toBe(true);
    expect(withCrisisSignpost("  ")).toBe(CRISIS_SIGNPOST_TEXT);
  });

  it("signposts a guardrail block when the check flags self-harm", () => {
    expect(describeGuardrailBlock("input", ["self-harm"])).toContain(CRISIS_SIGNPOST_TEXT);
    expect(describeGuardrailBlock("output", ["Suicide & Self-Harm"])).toContain(
      CRISIS_SIGNPOST_TEXT,
    );
  });

  it("signposts a guardrail block for another reason when the message raised it", () => {
    expect(describeGuardrailBlock("input", ["hate"], { crisisSignpost: true })).toContain(
      CRISIS_SIGNPOST_TEXT,
    );
    expect(describeGuardrailBlock("input", ["hate"])).not.toContain(CRISIS_SIGNPOST_TEXT);
  });
});
