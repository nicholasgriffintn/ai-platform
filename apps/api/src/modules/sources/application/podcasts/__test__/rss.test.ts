import { describe, expect, it } from "vitest";

import { buildPodcastFeed, formatDuration } from "../rss";

describe("buildPodcastFeed", () => {
  it("escapes show and episode text and lists each episode as an enclosure", () => {
    const xml = buildPodcastFeed({
      title: "Ops & <Notes>",
      description: 'The "weekly" round-up',
      link: "https://api.example.com/sources/collections/shared/token",
      feedUrl: "https://api.example.com/sources/collections/shared/token",
      author: "Ada",
      language: "en",
      episodes: [
        {
          id: "episode-1",
          title: "Launch \u0001plan",
          description: "What we agreed",
          publishedAt: "2026-10-22 09:30:00",
          audioUrl: "https://api.example.com/sources/collections/shared/token/episode-1",
          mimeType: "audio/mpeg",
          byteSize: 1024,
          durationSeconds: 3725,
        },
      ],
    });

    expect(xml).toContain("<title>Ops &amp; &lt;Notes&gt;</title>");
    expect(xml).toContain("<description>The &quot;weekly&quot; round-up</description>");
    expect(xml).toContain("<title>Launch plan</title>");
    expect(xml).toContain(
      '<enclosure url="https://api.example.com/sources/collections/shared/token/episode-1" length="1024" type="audio/mpeg"/>',
    );
    expect(xml).toContain("<pubDate>Thu, 22 Oct 2026 09:30:00 GMT</pubDate>");
    expect(xml).toContain("<itunes:duration>1:02:05</itunes:duration>");
    expect(xml).toContain("<itunes:block>Yes</itunes:block>");
  });
});

describe("formatDuration", () => {
  it("drops the hour when an episode is shorter than an hour", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3600)).toBe("1:00:00");
  });
});
