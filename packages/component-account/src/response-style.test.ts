import { describe, expect, it } from "vitest";

import {
  buildResponseStyleInstructions,
  DEFAULT_RESPONSE_STYLE_OPTIONS,
  matchResponseStyleOptions,
  RESPONSE_STYLE_CONTROLS,
  type ResponseStyleOptions,
} from "./response-style";

function allCombinations(): ResponseStyleOptions[] {
  let combinations: ResponseStyleOptions[] = [DEFAULT_RESPONSE_STYLE_OPTIONS];

  for (const control of RESPONSE_STYLE_CONTROLS) {
    combinations = combinations.flatMap((options) =>
      control.choices.map((choice) => ({ ...options, [control.key]: choice.value })),
    );
  }

  return combinations;
}

describe("response style instructions", () => {
  it("recognises the selections behind every generated instruction", () => {
    for (const options of allCombinations()) {
      const { traits, preferences } = buildResponseStyleInstructions(options);

      expect(matchResponseStyleOptions(traits, preferences)).toEqual(options);
    }
  });

  it("leaves both fields empty for the default style so the assistant keeps its own defaults", () => {
    expect(buildResponseStyleInstructions(DEFAULT_RESPONSE_STYLE_OPTIONS)).toEqual({
      traits: "",
      preferences: "",
    });
    expect(matchResponseStyleOptions(undefined, undefined)).toEqual(DEFAULT_RESPONSE_STYLE_OPTIONS);
  });

  it("treats hand-written or edited instructions as custom", () => {
    const generated = buildResponseStyleInstructions({
      ...DEFAULT_RESPONSE_STYLE_OPTIONS,
      tone: "cynical",
    });

    expect(matchResponseStyleOptions("Thoughtful", "Use British English")).toBeNull();
    expect(
      matchResponseStyleOptions(
        generated.traits,
        `${generated.preferences}\n- Use British English`,
      ),
    ).toBeNull();
  });
});
