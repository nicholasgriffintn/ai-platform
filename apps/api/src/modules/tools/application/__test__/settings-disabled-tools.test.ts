import { describe, expect, it } from "vitest";

import { resolveSettingsDisabledToolNames } from "../availability";

describe("tools turned off in settings", () => {
  it("keeps web and source search on and past-chat search off by default", () => {
    expect(resolveSettingsDisabledToolNames({ userSettings: null, explicitToolNames: [] })).toEqual(
      ["search_conversations"],
    );
  });

  it("turns off each group the person switched off", () => {
    expect(
      resolveSettingsDisabledToolNames({
        userSettings: {
          web_search_enabled: false,
          source_search_enabled: false,
          memories_chat_history_enabled: true,
        },
        explicitToolNames: [],
      }),
    ).toEqual(["web_search", "research", "search_documents", "use_recipe_connector"]);
  });

  it("keeps tools that were asked for explicitly", () => {
    expect(
      resolveSettingsDisabledToolNames({
        userSettings: { web_search_enabled: false },
        explicitToolNames: ["web_search", "search_conversations"],
      }),
    ).toEqual(["research"]);
  });
});
