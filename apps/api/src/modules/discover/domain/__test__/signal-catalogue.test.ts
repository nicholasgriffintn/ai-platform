import { describe, expect, it } from "vitest";

import { findDiscoverSignal } from "../signal-catalogue";

const read = {
  date: "2026-10-28",
  timezone: "Europe/London",
  now: new Date("2026-10-28T05:00:00Z"),
  location: "London",
  topics: ['Sleep "Token"', "Isaac Asimov"],
};

describe("Reddit signals", () => {
  it("searches the week's top posts on the person's topics and links search and front page posts alike", () => {
    const topics = findDiscoverSignal("reddit-topics");
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
    const signal = findDiscoverSignal("youtube-new-videos");
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
