import type { RecipeInvocationResponse } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  createAssistantActionConversationUrl,
  createAppAssistantActionLaunch,
  createConnectorAssistantActionLaunch,
  createRecipeManagementActionPath,
  createRecipeAssistantActionLaunch,
  loadAssistantActionRequestOptions,
  parseAssistantActionLaunchState,
  readRecipeConversationLaunchIntent,
  removeConsumedAssistantActionLaunchParams,
} from "../assistant-action-launch";

const plannerInvocation = {
  recipeId: "plain-planner",
  installationId: "installation-2",
  channel: "web",
  status: "ready",
  conversationStarter: "Run the planner recipe.",
  messageUrl: "/?query=Run+the+planner+recipe.",
  missingConnections: [],
  enabledTools: [],
  allowedConnectorProviders: [],
  allowedConnectorOperations: {},
  configuration: {},
} satisfies RecipeInvocationResponse;

describe("assistant action launch URL contract", () => {
  it("normalises enabled tool ids from action launch URLs", () => {
    const state = parseAssistantActionLaunchState(
      "enabled_tools=web_fetch,bad%20tool,web_fetch,tool:search",
    );

    expect(state.enabledTools).toEqual(["web_fetch", "tool:search"]);
    expect(state.hasEnabledTools).toBe(true);
  });

  it("removes consumed launch state without removing unrelated URL parameters", () => {
    const search = new URLSearchParams({
      completion_id: "conversation-1",
      query: "Run the planner recipe.",
      enabled_tools: "use_recipe_connector",
      auto_submit: "1",
      assistant_action_context: "{}",
      recipe_context: "{}",
      action: "setup",
      recipe: "morning-briefing",
      view: "compact",
    }).toString();

    expect(removeConsumedAssistantActionLaunchParams(search)).toBe(
      "completion_id=conversation-1&view=compact",
    );
  });

  it("reads only valid compact recipe actions", () => {
    expect(readRecipeConversationLaunchIntent("action=setup&recipe=morning-briefing")).toEqual({
      action: "setup",
      recipeId: "morning-briefing",
    });
    expect(readRecipeConversationLaunchIntent("action=delete&recipe=morning-briefing")).toBe(
      undefined,
    );
  });

  it("creates a direct chat launch payload for recipe invocation from the composer", () => {
    expect(createRecipeAssistantActionLaunch(plannerInvocation)).toEqual({
      input: "Run the planner recipe.",
      enabledTools: [],
      requestOptions: {
        options: {
          recipe: {
            id: "plain-planner",
            installationId: "installation-2",
            channel: "web",
            allowedConnectorProviders: [],
            allowedConnectorOperations: {},
            configuration: {},
          },
        },
      },
    });
  });

  it("targets project chat without changing assistant action query state", () => {
    const url = createAssistantActionConversationUrl(
      {
        input: "Run the planner recipe.",
        enabledTools: ["use_recipe_connector"],
      },
      "/work/workspace-1/projects/project-1/chat",
    );

    expect(url).toMatch(
      /^\/work\/workspace-1\/projects\/project-1\/chat\?query=Run\+the\+planner\+recipe\./,
    );
  });

  it("creates an app launch path for frontend and dynamic apps", () => {
    expect(
      createAppAssistantActionLaunch({
        appId: "articles",
        appKind: "frontend",
        href: "/apps/articles",
      }),
    ).toEqual({ navigationPath: "/apps/articles" });

    expect(
      createAppAssistantActionLaunch({
        appId: "article-research",
        appKind: "dynamic",
      }),
    ).toEqual({ navigationPath: "/apps?app=article-research" });
  });

  it("creates recipe management links without discarding existing route state", () => {
    expect(
      createRecipeManagementActionPath(
        "/work/workspace-1/projects/project-1/library?view=installed",
        "configure",
        "daily briefing",
      ),
    ).toBe(
      "/work/workspace-1/projects/project-1/library?view=installed&action=configure&recipe=daily+briefing",
    );
  });

  it("rejects app launch payloads without an app id", () => {
    expect(() => createAppAssistantActionLaunch({})).toThrow("This app cannot open");
  });

  it("rejects unsafe catalogue navigation and connector URLs", () => {
    expect(() =>
      createAppAssistantActionLaunch({
        appId: "unsafe",
        appKind: "frontend",
        href: "javascript:alert(1)",
      }),
    ).toThrow("unsafe");
    expect(() =>
      createConnectorAssistantActionLaunch({
        provider: "gmail",
        authType: "composio",
        authorizationUrl: "data:text/html,unsafe",
      }),
    ).toThrow("unsafe");
  });

  it("creates connector launch payloads for API-key and OAuth connectors", () => {
    expect(
      createConnectorAssistantActionLaunch({
        provider: "posthog",
        authType: "api_key",
      }),
    ).toEqual({
      navigationPath: "/profile?tab=providers&type=connector&connector=posthog",
    });

    expect(
      createConnectorAssistantActionLaunch({
        provider: "gmail",
        authType: "composio",
        authorizationUrl: "https://accounts.google.com/oauth",
      }),
    ).toEqual({
      externalUrl: "https://accounts.google.com/oauth",
    });
  });

  it("keeps reading legacy recipe contexts during the URL migration", () => {
    const params = new URLSearchParams();

    params.set(
      "recipe_context",
      JSON.stringify({
        recipe: {
          id: "gmail",
          installationId: "installation-1",
          channel: "web",
          allowedConnectorProviders: ["gmail"],
          allowedConnectorOperations: { gmail: ["search_messages"] },
          configuration: { defaultSearch: "from:team" },
        },
      }),
    );

    const state = parseAssistantActionLaunchState(params.toString());

    expect(loadAssistantActionRequestOptions(state)).toEqual({
      options: {
        recipe: {
          id: "gmail",
          installationId: "installation-1",
          channel: "web",
          allowedConnectorProviders: ["gmail"],
          allowedConnectorOperations: { gmail: ["search_messages"] },
          configuration: { defaultSearch: "from:team" },
        },
      },
    });
  });
});
