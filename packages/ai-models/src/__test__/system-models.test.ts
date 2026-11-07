import type { ModelConfig, ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { resolveSystemRoleModels } from "../system-models.js";

function chat(matchingModel: string, provider: string): ModelConfigItem {
  return {
    matchingModel,
    provider,
    modalities: { input: ["text"], output: ["text"] },
    contextWindow: 1_000_000,
    isFree: true,
  };
}

const models: ModelConfig = {
  "@cf/zai-org/glm-4.7-flash": chat("@cf/zai-org/glm-4.7-flash", "workers-ai"),
  chosen: chat("chosen", "greenpt"),
  backup: chat("backup", "greenpt"),
};

const pro = { plan_id: "pro" };

describe("resolveSystemRoleModels", () => {
  it("keeps platform defaults out of a role with a usable choice", () => {
    const resolved = resolveSystemRoleModels(
      models,
      "housekeeping",
      {
        user: {
          housekeeping: [
            { model: "chosen", provider: "greenpt" },
            { model: "backup", provider: "greenpt" },
          ],
        },
      },
      pro,
    );

    expect(resolved.map(({ id }) => id)).toEqual(["chosen", "backup"]);
  });

  it("falls back to platform defaults when no choice can run", () => {
    const resolved = resolveSystemRoleModels(
      models,
      "housekeeping",
      { user: { housekeeping: [{ model: "retired", provider: "greenpt" }] } },
      pro,
    );

    expect(resolved.map(({ id }) => id)).toEqual(["@cf/zai-org/glm-4.7-flash"]);
  });
});
