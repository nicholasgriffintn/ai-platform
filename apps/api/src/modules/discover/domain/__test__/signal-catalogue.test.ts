import { describe, expect, it } from "vitest";

import {
  findDiscoverSignal,
  isDiscoverConnectorSignal,
  showsDiscoverActivity,
} from "../signal-catalogue";
import type { DiscoverConnectorSignal } from "../signal-sources/types";

const read = {
  date: "2026-10-28",
  timezone: "Europe/London",
  now: new Date("2026-10-28T05:00:00Z"),
  location: "London",
  topics: ['Sleep "Token"', "Isaac Asimov"],
};

function connector(id: string): DiscoverConnectorSignal {
  const signal = findDiscoverSignal(id);

  if (!signal || !isDiscoverConnectorSignal(signal)) {
    throw new Error(`${id} is not a connector signal`);
  }

  return signal;
}

describe("showsDiscoverActivity", () => {
  it("rejects signals that only echo topics or list what is scheduled", () => {
    expect(
      ["reddit-topics", "listennotes-topics", "watching-week", "watching-news"].filter(
        showsDiscoverActivity,
      ),
    ).toEqual([]);
  });

  it("rejects public front pages, which say what is popular rather than what they do", () => {
    expect(
      [
        "hackernews-front",
        "lobsters-hottest",
        "huggingface-papers",
        "devto-top-today",
        "nasa-apod",
        "artificial-analysis-models",
      ].filter(showsDiscoverActivity),
    ).toEqual([]);
  });

  it("keeps what the person did, including sources outside the catalogue", () => {
    expect(["reddit-front", "trakt-history", "device-browsing"].every(showsDiscoverActivity)).toBe(
      true,
    );
  });
});

describe("Hugging Face papers", () => {
  it("leaves out old papers that are trending again", () => {
    const paper = (id: string, publishedAt: string) => ({
      title: id,
      publishedAt,
      paper: { id, upvotes: 20 },
    });

    expect(
      findDiscoverSignal("huggingface-papers")
        ?.items?.(
          [paper("recent", "2026-10-27T10:00:00.000Z"), paper("old", "2023-09-12T10:00:00.000Z")],
          read,
        )
        .map((item) => item.title),
    ).toEqual(["recent"]);
  });
});

describe("Reddit signals", () => {
  it("skips picture posts with nothing to read", () => {
    const post = (title: string, extra: Record<string, unknown>) => ({
      data: { title, score: 500, permalink: `/r/test/${title}`, ...extra },
    });

    expect(
      findDiscoverSignal("reddit-front")
        ?.items?.(
          {
            data: {
              children: [
                post("picture", { post_hint: "image" }),
                post("hosted", { url: "https://i.redd.it/a.jpg" }),
                post("discussion", { selftext: "A real post", post_hint: "image" }),
                post("link", { url: "https://example.com/story" }),
              ],
            },
          },
          read,
        )
        .map((item) => item.title),
    ).toEqual(["discussion", "link"]);
  });

  it("searches the week's top posts on the person's topics and links search and front page posts alike", () => {
    const topics = connector("reddit-topics");
    const front = findDiscoverSignal("reddit-front");

    expect(topics?.parameters(read)).toMatchObject({
      search_query: '"Sleep Token" OR "Isaac Asimov"',
      sort: "top",
      time_filter: "week",
    });
    expect(
      topics
        ?.items?.(
          {
            data: {
              posts: [
                {
                  title: "Tarot Card Poster",
                  permalink: "https://www.reddit.com/r/SleepToken/comments/a1/tarot/",
                  subreddit_prefixed: "r/SleepToken",
                  score: 601,
                },
                { title: "Hidden", permalink: "/r/x/comments/b2/", over_18: true },
              ],
            },
          },
          read,
        )
        .map((item) => [item.url, item.source]),
    ).toEqual([
      ["https://www.reddit.com/r/SleepToken/comments/a1/tarot/", "r/SleepToken, 601 points"],
    ]);
    expect(
      front?.digest({
        data: {
          data: {
            children: [
              {
                data: {
                  title: "Foundation",
                  permalink: "/r/books/comments/c3/",
                  subreddit: "books",
                },
              },
            ],
          },
        },
      }),
    ).toEqual(["Foundation · r/books · https://www.reddit.com/r/books/comments/c3/"]);
  });
});

describe("YouTube new videos", () => {
  it("asks each subscribed channel for its uploads and keeps this week's videos, newest first", () => {
    const signal = connector("youtube-new-videos");
    const upload = (videoId: string, title: string, publishedAt: string) => ({
      snippet: { title, videoOwnerChannelTitle: "Veritasium" },
      contentDetails: { videoId, videoPublishedAt: publishedAt },
    });

    expect(
      signal?.expand?.requests(
        {
          data: {
            items: [
              { snippet: { resourceId: { channelId: "UCHnyfMqiRRG1u-2MsSQLbXA" } } },
              { snippet: { resourceId: { channelId: "UCHnyfMqiRRG1u-2MsSQLbXA" } } },
            ],
          },
        },
        read,
      ),
    ).toEqual([
      {
        channelId: "UCHnyfMqiRRG1u-2MsSQLbXA",
        part: "snippet,contentDetails,status",
        maxResults: 3,
      },
    ]);
    expect(
      signal
        ?.items?.(
          [
            {
              data: {
                items: [
                  upload("aaaaaaaaaaa", "Older this week", "2026-10-25T10:00:00Z"),
                  upload("bbbbbbbbbbb", "Last month", "2026-09-20T10:00:00Z"),
                  {
                    ...upload("ccccccccccc", "Members only", "2026-10-27T10:00:00Z"),
                    status: { privacyStatus: "private" },
                  },
                ],
              },
            },
            { data: { items: [upload("ddddddddddd", "Yesterday", "2026-10-27T18:00:00Z")] } },
          ],
          read,
        )
        .map((item) => [item.url, item.title, item.source]),
    ).toEqual([
      ["https://www.youtube.com/watch?v=ddddddddddd", "Yesterday", "Veritasium"],
      ["https://www.youtube.com/watch?v=aaaaaaaaaaa", "Older this week", "Veritasium"],
    ]);
  });
});
