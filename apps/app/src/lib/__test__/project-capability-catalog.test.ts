import {
  buildAssistantActionCatalog,
  createRecipeAssistantActionItem,
  type AssistantRecipe,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { filterProjectCapabilities } from "../project-capability-catalog";

const morningBriefing = {
  id: "morning-briefing",
  title: "Morning Briefing",
  summary: "Summarise the day.",
  description: "Review today's priorities.",
  kind: "automate",
  category: "Productivity",
  featured: false,
  integrations: [],
  triggers: [],
  actions: ["Summarise priorities"],
  setupPrompt: "Set up the Morning Briefing recipe.",
  enabledTools: [],
  configurationFields: [],
} satisfies AssistantRecipe;

const catalog = buildAssistantActionCatalog({
  apps: [
    {
      id: "calendar",
      name: "Calendar",
      description: "Review upcoming events.",
      category: "Productivity",
    },
  ],
  modelTools: [
    {
      id: "mcp",
      category: "Productivity",
      command: "Use MCP",
      description: "Use a configured MCP server.",
      label: "MCP",
    },
  ],
});
const items = [...catalog.items, createRecipeAssistantActionItem(morningBriefing)];

describe("capability catalogue filters", () => {
  it("combines selected kinds with configured status", () => {
    const configuredItemIds = new Set(["recipe:morning-briefing", "tool:mcp"]);
    const common = {
      category: "all",
      configuredItemIds,
      configuredOnly: true,
      query: "",
    };

    expect(
      filterProjectCapabilities(items, { ...common, kinds: ["recipe"] }).map((item) => item.id),
    ).toEqual(["recipe:morning-briefing"]);
    expect(
      filterProjectCapabilities(items, { ...common, kinds: ["recipe", "tool"] }).map(
        (item) => item.id,
      ),
    ).toEqual(["tool:mcp", "recipe:morning-briefing"]);
  });
});
