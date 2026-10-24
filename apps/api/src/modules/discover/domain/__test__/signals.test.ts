import { describe, expect, it } from "vitest";

import { selectRecentChatTitles } from "../signals";

const NOW = Date.parse("2026-10-24T12:00:00.000Z");

describe("selectRecentChatTitles", () => {
  it("keeps recent, titled personal chats once each", () => {
    expect(
      selectRecentChatTitles(
        [
          { title: "Brazil sprint tyres", type: "chat", updatedAt: "2026-10-24T09:00:00Z" },
          { title: "Recipe: Discover", type: "task", updatedAt: "2026-10-24T08:00:00Z" },
          { title: "New conversation", type: "chat", updatedAt: "2026-10-24T07:00:00Z" },
          { title: "brazil sprint tyres", type: "chat", updatedAt: "2026-10-23T07:00:00Z" },
          { title: "Rye starters", type: "chat", updatedAt: "2026-10-01T07:00:00Z" },
          { title: "Old holiday plans", type: "chat", updatedAt: "2026-08-01T07:00:00Z" },
        ],
        { now: NOW, maxAgeDays: 30, limit: 10 },
      ),
    ).toEqual(["Brazil sprint tyres", "Rye starters"]);
  });
});
