import { describe, expect, it } from "vitest";

import {
  FEATURED_MODEL_GROUP_KEY,
  AGENT_MODEL_GROUP_KEY,
  groupModelsByProvider,
  partitionDeprecatedModelEntries,
  type ModelGroupingItem,
} from "./modelGrouping.js";

function model(id: string, overrides: Partial<ModelGroupingItem> = {}): ModelGroupingItem {
  return {
    id,
    matchingModel: id,
    name: id,
    provider: "openai",
    ...overrides,
  };
}

describe("model grouping", () => {
  it("groups featured models, providers, and regional variants in display order", () => {
    const regionalModel = model("us.claude-sonnet", {
      matchingModel: "us.claude-sonnet",
      name: "US Anthropic Claude Sonnet",
      provider: "bedrock",
    });
    const defaultModel = model("claude-sonnet", {
      matchingModel: "claude-sonnet",
      name: "Claude Sonnet",
      provider: "bedrock",
    });
    const featuredModel = model("gpt-6", { name: "GPT-6" });

    const entries = groupModelsByProvider([regionalModel, defaultModel, featuredModel], {
      [featuredModel.id]: featuredModel,
    });

    expect(entries.map((entry) => entry.key)).toEqual([
      FEATURED_MODEL_GROUP_KEY,
      "bedrock",
      "openai",
    ]);
    expect(entries[1]?.models).toHaveLength(1);
    expect(entries[1]?.models[0]?.model.name).toBe("Claude Sonnet");
    expect(entries[1]?.models[0]?.regionOptions.map((option) => option.label)).toEqual([
      "Default",
      "US",
    ]);
  });

  it("partitions deprecated entries without changing their order", () => {
    const entries = [
      { model: model("active"), regionOptions: [] },
      { model: model("old", { deprecated: true }), regionOptions: [] },
    ];

    expect(partitionDeprecatedModelEntries(entries)).toEqual({
      active: [entries[0]],
      deprecated: [entries[1]],
    });
  });

  it("keeps agents in their own group", () => {
    const agent = model("codex", { kind: "agent", provider: "codex" });

    expect(groupModelsByProvider([agent], {})).toMatchObject([
      { key: AGENT_MODEL_GROUP_KEY, label: "Agents" },
    ]);
  });
});
