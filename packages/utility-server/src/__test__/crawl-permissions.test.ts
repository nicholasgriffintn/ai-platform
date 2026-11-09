import { describe, expect, it } from "vitest";

import { isCrawlReserved, isRobotsAllowed, parseRobotsTxt } from "../crawl-permissions";

describe("crawl permissions", () => {
  it("applies the most specific matching group and the longest matching rule", () => {
    const policy = parseRobotsTxt(
      [
        "User-agent: *",
        "Disallow: /private",
        "Allow: /private/press",
        "",
        "User-agent: PolychatBot",
        "Disallow: /",
      ].join("\n"),
    );

    expect(isRobotsAllowed(policy, "PolychatBot/1.0", "/news/story")).toBe(false);
    expect(isRobotsAllowed(policy, "OtherBot", "/private/press/item")).toBe(true);
    expect(isRobotsAllowed(policy, "OtherBot", "/private/page")).toBe(false);
    expect(isRobotsAllowed(policy, "OtherBot", "/news/story")).toBe(true);
  });

  it("treats TDM reservation and noai or noindex robots headers as reserved", () => {
    expect(isCrawlReserved(new Headers({ "tdm-reservation": "1" }))).toBe(true);
    expect(isCrawlReserved(new Headers({ "x-robots-tag": "googlebot: noindex" }))).toBe(true);
    expect(isCrawlReserved(new Headers({ "x-robots-tag": "noai, noimageai" }))).toBe(true);
    expect(isCrawlReserved(new Headers({ "x-robots-tag": "max-snippet:50" }))).toBe(false);
  });
});
