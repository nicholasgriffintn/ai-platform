import { describe, expect, it } from "vitest";

import { normaliseTokenUsage } from "../index.js";

describe("normaliseTokenUsage", () => {
  it("counts anthropic cache tokens on top of input tokens", () => {
    expect(
      normaliseTokenUsage({
        input_tokens: 10,
        output_tokens: 25,
        cache_read_input_tokens: 400,
        cache_creation_input_tokens: 120,
      }),
    ).toMatchObject({
      input_tokens: 10,
      output_tokens: 25,
      cached_input_tokens: 400,
      cache_creation_tokens: 120,
      total_tokens: 555,
    });
  });

  it("never reports a total below the sum of its parts", () => {
    expect(
      normaliseTokenUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 3 }),
    ).toMatchObject({
      total_tokens: 15,
    });
  });
});
