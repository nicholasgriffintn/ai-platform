import { describe, expect, it } from "vitest";

import { parseSyndicationFeed } from "../feeds.js";

describe("parseSyndicationFeed", () => {
  const readImage = (body: string) =>
    parseSyndicationFeed(
      `<rss><channel><item><title>Story</title><link>https://news.example.com/a</link>${body}</item></channel></rss>`,
    ).items[0]?.imageUrl;

  it("refuses an image that is not https", () => {
    expect(readImage(`<media:thumbnail url="http://img.example.com/t.jpg"/>`)).toBeNull();
    expect(readImage(`<media:thumbnail url="data:image/png;base64,AAAA"/>`)).toBeNull();
  });

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
        imageUrl: null,
      },
    ]);
  });
});
