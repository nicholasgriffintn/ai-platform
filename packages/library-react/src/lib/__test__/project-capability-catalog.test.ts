import {
  buildAssistantActionCatalog,
  createConnectorAssistantActionItem,
  createRecipeAssistantActionItem,
  type AssistantRecipe,
  type RecipeConnectorManifest,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  filterProjectCapabilities,
  getCatalogueItemKind,
  groupProjectCapabilities,
} from "../project-capability-catalog.js";

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

const netlify = {
  id: "netlify",
  name: "Netlify",
  description: "Inspect Netlify sites, deploys, and deployment status.",
  categories: [{ id: "developer-tools", name: "Developer tools" }],
  authType: "api_key",
  status: "connected",
  scopes: ["sites:read"],
  toolCount: 3,
  readToolCount: 3,
  writeToolCount: 0,
} satisfies RecipeConnectorManifest;

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

  it("treats a connector as an integration alongside capability kinds", () => {
    const connector = createConnectorAssistantActionItem(netlify);
    const combined = [connector, ...items];
    const groups = groupProjectCapabilities(combined);
    const integrations = groups.find((group) => group.kind === "connector");

    expect(getCatalogueItemKind(connector)).toBe("connector");
    expect(groups[0]?.kind).toBe("connector");
    expect(integrations?.label).toBe("Integrations");
    expect(integrations?.categories.map((category) => category.category)).toEqual([
      "Developer tools",
    ]);
    expect(
      filterProjectCapabilities(combined, {
        category: "all",
        configuredItemIds: new Set(),
        configuredOnly: false,
        kinds: ["connector"],
        query: "netlify",
      }).map((item) => item.id),
    ).toEqual(["connector:netlify"]);
  });
});
