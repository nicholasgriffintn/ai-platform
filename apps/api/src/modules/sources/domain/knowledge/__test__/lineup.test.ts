import { describe, expect, it } from "vitest";

import { KNOWLEDGE_TOPIC_LINEUPS, shouldRunTopicStep } from "../lineup";

const [feeds, news, widerNews] = KNOWLEDGE_TOPIC_LINEUPS.news;

describe("news topic lineup", () => {
  it("reads followed feeds before searching", () => {
    expect(feeds?.provider).toBe("feeds");
    expect(news?.provider).toBe("news");
  });

  it("skips search once feeds fill the limit", () => {
    expect(news && shouldRunTopicStep(news, 8, 8)).toBe(false);
    expect(news && shouldRunTopicStep(news, 3, 8)).toBe(true);
  });

  it("widens the news window only when nothing was found", () => {
    expect(widerNews && shouldRunTopicStep(widerNews, 1, 8)).toBe(false);
    expect(widerNews && shouldRunTopicStep(widerNews, 0, 8)).toBe(true);
  });
});
