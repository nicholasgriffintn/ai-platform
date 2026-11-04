import { describe, expect, it } from "vitest";

import { parseSyndicationFeed } from "../feeds.js";

describe("parseSyndicationFeed", () => {
  const readImage = (body: string) =>
    parseSyndicationFeed(
      `<rss><channel><item><title>Story</title><link>https://news.example.com/a</link>${body}</item></channel></rss>`,
    ).items[0]?.imageUrl;

  it("picks the widest attached image", () => {
    expect(
      readImage(`<media:content width="140" url="https://img.example.com/small.jpg"/>
        <media:content width="460" url="https://img.example.com/large.jpg"/>`),
    ).toBe("https://img.example.com/large.jpg");
  });

  it("reads a thumbnail and an image enclosure, but not an audio enclosure", () => {
    expect(readImage(`<media:thumbnail url="https://img.example.com/t.jpg"/>`)).toBe(
      "https://img.example.com/t.jpg",
    );
    expect(readImage(`<enclosure url="https://img.example.com/e.png" type="image/png"/>`)).toBe(
      "https://img.example.com/e.png",
    );
    expect(readImage(`<enclosure url="https://cdn.example.com/e.mp3" type="audio/mpeg"/>`)).toBe(
      null,
    );
  });

  it("falls back to an image inside escaped or character data markup", () => {
    expect(
      readImage(
        `<description>&lt;img src=&quot;https://img.example.com/a.jpg&quot;&gt;</description>`,
      ),
    ).toBe("https://img.example.com/a.jpg");
    expect(
      readImage(`<description><![CDATA[<p><img alt="" src="/b.jpg"></p>]]></description>`),
    ).toBe("https://news.example.com/b.jpg");
  });

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
        imageUrl: null,
      },
    ]);
  });

  it("returns no items for markup that is not a feed", () => {
    expect(parseSyndicationFeed("<html><body><p>Not a feed</p></body></html>").items).toEqual([]);
  });
});
