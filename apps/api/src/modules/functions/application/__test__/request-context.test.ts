import { describe, expect, it } from "vitest";

import { applyFunctionRequestContext } from "../request-context";

describe("function request context", () => {
  it("uses the exact composer-selected connector instead of a model-inferred ID", () => {
    expect(
      applyFunctionRequestContext({
        args: {
          provider: "google_slides",
          useCase: "create a presentation",
        },
        functionName: "use_recipe_connector",
        requestOptions: { connector: { provider: "googleslides" } },
      }),
    ).toEqual({
      provider: "googleslides",
      useCase: "create a presentation",
    });
  });

  it("does not alter connector calls without an explicit composer selection", () => {
    const args = { provider: "nasa", useCase: "show a space image" };

    expect(
      applyFunctionRequestContext({
        args,
        functionName: "use_recipe_connector",
        requestOptions: undefined,
      }),
    ).toBe(args);
  });
});
