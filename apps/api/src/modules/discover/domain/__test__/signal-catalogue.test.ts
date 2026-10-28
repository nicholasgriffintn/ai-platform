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
        ?.items?.({
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
        })
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
