import { describe, expect, it } from "vitest";

import { parseSyndicationFeed } from "../feeds.js";

describe("parseSyndicationFeed", () => {
  it("reads RSS items with character data, escaped markup and relative links", () => {
    const feed = parseSyndicationFeed(
      `<?xml version="1.0"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <title>The Perch &amp; Friends</title>
          <item>
            <title><![CDATA[Parrots & <b>people</b>]]></title>
            <link>/stories/parrots</link>
            <description>&lt;p&gt;Feathers, mostly.&lt;/p&gt;</description>
            <pubDate>Sat, 24 Oct 2026 09:30:00 GMT</pubDate>
          </item>
          <item>
            <title>No link at all</title>
            <guid isPermaLink="false">tag:example,2026:1</guid>
          </item>
        </channel>
      </rss>`,
      "https://news.example.com/feed.xml",
    );

    expect(feed.title).toBe("The Perch & Friends");
    expect(feed.items).toEqual([
      {
        title: "Parrots & people",
        url: "https://news.example.com/stories/parrots",
        summary: "Feathers, mostly.",
        publishedAt: "2026-10-24T09:30:00.000Z",
      },
    ]);
  });

  it("reads Atom entries using the alternate link", () => {
    const feed = parseSyndicationFeed(`
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Nest notes</title>
        <entry>
          <title type="html">Moulting season</title>
          <link rel="self" href="https://example.com/api/entries/1"/>
          <link rel="alternate" href="https://example.com/moulting"/>
          <summary>Shedding, briefly.</summary>
          <updated>2026-10-20T08:00:00Z</updated>
        </entry>
      </feed>`);

    expect(feed.items).toEqual([
      {
        title: "Moulting season",
        url: "https://example.com/moulting",
        summary: "Shedding, briefly.",
        publishedAt: "2026-10-20T08:00:00.000Z",
      },
    ]);
  });

  it("returns no items for markup that is not a feed", () => {
    expect(parseSyndicationFeed("<html><body><p>Not a feed</p></body></html>").items).toEqual([]);
  });
});
