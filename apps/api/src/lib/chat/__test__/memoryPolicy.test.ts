import { describe, expect, it } from "vitest";

import type { IUser } from "~/types";

import {
  MEMORY_SEARCH_TOOL_NAME,
  MEMORY_STORE_TOOL_NAME,
  buildMemoryPromptContext,
  mergeEnabledMemoryToolNames,
  resolveMemoryPolicy,
} from "../memoryPolicy";

function createUser(planId: string | null): IUser {
  return {
    id: 1,
    name: null,
    avatar_url: null,
    email: "user@example.com",
    github_username: null,
    company: null,
    site: null,
    location: null,
    bio: null,
    twitter_username: null,
    created_at: "2026-06-22T00:00:00.000Z",
    updated_at: "2026-06-22T00:00:00.000Z",
    setup_at: null,
    terms_accepted_at: null,
    plan_id: planId,
  };
}

describe("resolveMemoryPolicy", () => {
  it("enables retrieval and storage only for pro users with memory settings and stored conversations", () => {
    expect(
      resolveMemoryPolicy({
        user: createUser("pro"),
        userSettings: {
          memories_save_enabled: true,
          memories_chat_history_enabled: true,
        },
        store: true,
      }),
    ).toEqual({
      enabled: true,
      canRetrieve: true,
      canStore: true,
      toolNames: [MEMORY_SEARCH_TOOL_NAME, MEMORY_STORE_TOOL_NAME],
    });

    expect(
      resolveMemoryPolicy({
        user: createUser("pro"),
        userSettings: {
          memories_save_enabled: true,
          memories_chat_history_enabled: true,
        },
        store: false,
      }).enabled,
    ).toBe(false);

    expect(
      resolveMemoryPolicy({
        user: createUser("free"),
        userSettings: {
          memories_save_enabled: true,
        },
        store: true,
      }).enabled,
    ).toBe(false);
  });

  it("exposes search for chat-history memories and store only for save-enabled memories", () => {
    expect(
      resolveMemoryPolicy({
        user: createUser("pro"),
        userSettings: {
          memories_save_enabled: false,
          memories_chat_history_enabled: true,
        },
        store: true,
      }).toolNames,
    ).toEqual([MEMORY_SEARCH_TOOL_NAME]);

    expect(
      mergeEnabledMemoryToolNames({
        enabledTools: ["web_search", MEMORY_SEARCH_TOOL_NAME],
        user: createUser("pro"),
        userSettings: {
          memories_save_enabled: true,
          memories_chat_history_enabled: false,
        },
        store: true,
      }),
    ).toEqual(["web_search", MEMORY_SEARCH_TOOL_NAME, MEMORY_STORE_TOOL_NAME]);
  });
});

describe("buildMemoryPromptContext", () => {
  it("carries the synthesis and points at the tool for anything it does not hold", () => {
    const context = buildMemoryPromptContext({ synthesisText: "Prefers concise answers." });

    expect(context).toContain("<memory_synthesis>");
    expect(context).toContain("Prefers concise answers.");
    expect(context).toContain(MEMORY_SEARCH_TOOL_NAME);
  });

  it("returns nothing when there is no synthesis to carry", () => {
    expect(buildMemoryPromptContext({})).toBe("");
  });
});
