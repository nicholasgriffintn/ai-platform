import { getModels } from "@ngriffin_uk/polychat-ai-models";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { buildInputSchemaInput } from "../input-schema.js";
import { resolvePinnedSafetyInput } from "../safety-inputs.js";

const SAFETY_FIELD_PATTERN = /safety|moderation|nsfw|censor/i;

function modelWith(fields: NonNullable<ModelConfigItem["inputSchema"]>["fields"]) {
  return { matchingModel: "test", inputSchema: { fields } } as ModelConfigItem;
}

describe("pinned safety inputs", () => {
  it("replaces caller values that would lower a provider's safeguards", () => {
    const { input } = buildInputSchemaInput(
      {
        body: {
          input: {
            disable_safety_checker: true,
            moderation: "low",
            safety_tolerance: 5,
            safety_filter_level: "block_only_high",
          },
        },
      },
      modelWith([
        { name: "disable_safety_checker", type: "boolean" },
        { name: "moderation", type: "string", enum: ["auto", "low"] },
        { name: "safety_tolerance", type: "integer" },
        {
          name: "safety_filter_level",
          type: "string",
          enum: ["block_only_high", "block_medium_and_above"],
        },
      ]),
    );

    expect(input).toEqual({
      disable_safety_checker: false,
      moderation: "auto",
      safety_tolerance: 2,
      safety_filter_level: "block_medium_and_above",
    });
  });

  it("covers every safety field in the model catalogue", () => {
    const safetyFields = Object.values(getModels()).flatMap((model) =>
      (model.inputSchema?.fields ?? []).filter((field) => SAFETY_FIELD_PATTERN.test(field.name)),
    );

    expect(safetyFields.length).toBeGreaterThan(0);
    expect(safetyFields.filter((field) => resolvePinnedSafetyInput(field) === undefined)).toEqual(
      [],
    );
  });
});
