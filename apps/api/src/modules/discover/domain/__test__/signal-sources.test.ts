import { RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { applyDiscoverSourceChange } from "../settings";
import { findDiscoverSignal, isDiscoverOptInProvider } from "../signal-catalogue";
import { createDiscoverFeedSignal } from "../signal-sources/feeds";

const read = {
  date: "2026-10-28",
  timezone: "Europe/London",
  now: new Date("2026-10-28T05:00:00Z"),
  location: null,
  topics: [],
};

describe("public sources", () => {
  it("keeps Hacker News stories that cleared the bar and links text posts to their discussion", () => {
    const hackerNews = findDiscoverSignal("hackernews-front");

    expect(
      hackerNews
        ?.items?.(
          {
            hits: [
              {
                objectID: "1",
                title: "Big launch",
                url: "https://example.com/launch",
                points: 812,
              },
              { objectID: "2", title: "Ask HN: What are you reading?", points: 240 },
              { objectID: "3", title: "Quiet post", url: "https://example.com/quiet", points: 12 },
            ],
          },
          read,
        )
        .map((item) => [item.url, item.source]),
    ).toEqual([
      ["https://example.com/launch", "Hacker News, 812 points"],
      ["https://news.ycombinator.com/item?id=2", "Hacker News, 240 points"],
    ]);
  });

  it("reads a followed feed's recent posts under the feed's own name, and names Patreon links", () => {
    const patreon = createDiscoverFeedSignal("https://www.patreon.com/rss/creator?auth=secret");
    const feed = {
      title: "",
      items: [
        {
          title: "New episode",
          url: "https://www.patreon.com/posts/1",
          summary: "Bonus",
          publishedAt: "2026-10-27T09:00:00Z",
        },
        {
          title: "Old episode",
          url: "https://www.patreon.com/posts/0",
          summary: "",
          publishedAt: "2026-09-01T09:00:00Z",
        },
      ],
    };

    expect(patreon.items?.(feed, read).map((item) => [item.title, item.source])).toEqual([
      ["New episode", "Patreon"],
    ]);
    expect(
      patreon.items?.({ ...feed, title: "The Creator" }, read).map((item) => item.source),
    ).toEqual(["The Creator"]);
  });
});

describe("GitHub following", () => {
  it("groups what the people you follow star into one card per repository, most shared first", () => {
    const github = findDiscoverSignal("github-following");
    const star = (actor: string, repo: string) => ({
      type: "WatchEvent",
      actor: { login: actor },
      repo: { name: repo },
      created_at: "2026-10-27T12:00:00Z",
    });

    expect(
      github
        ?.items?.(
          [
            {
              data: [
                star("ada", "acme/solo"),
                star("ada", "acme/popular"),
                star("grace", "acme/popular"),
                { type: "PushEvent", actor: { login: "linus" }, repo: { name: "acme/pushed" } },
              ],
            },
          ],
          read,
        )
        .map((item) => [item.url, item.source]),
    ).toEqual([
      ["https://github.com/acme/popular", "GitHub, 2 people you follow"],
      ["https://github.com/acme/solo", "GitHub"],
    ]);
  });
});

describe("applyDiscoverSourceChange", () => {
  it("switches public sources on explicitly and connected services off explicitly", () => {
    const none = { [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: [], includedProviders: [] };

    expect(
      applyDiscoverSourceChange(
        none,
        { providerId: "hackernews", used: true },
        isDiscoverOptInProvider,
      ),
    ).toEqual({ [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: [], includedProviders: ["hackernews"] });
    expect(
      applyDiscoverSourceChange(
        { [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: [], includedProviders: ["hackernews"] },
        { providerId: "hackernews", used: false },
        isDiscoverOptInProvider,
      ),
    ).toEqual(none);
    expect(
      applyDiscoverSourceChange(
        none,
        { providerId: "reddit", used: false },
        isDiscoverOptInProvider,
      ),
    ).toEqual({ [RECIPE_EXCLUDED_CONNECTOR_PROVIDERS_KEY]: ["reddit"], includedProviders: [] });
  });
});
