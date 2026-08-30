import { describe, expect, it } from "vitest";

import { buildAiGatewayControlHeaders } from "../aiGateway";

const IDENTIFIED_REQUEST = {
  user: { id: 7, email: "someone@example.com" },
  platform: "web" as const,
  completion_id: "chat_1",
};

describe("AI gateway control headers", () => {
  it("identifies and caches an ordinary turn", () => {
    const headers = buildAiGatewayControlHeaders(IDENTIFIED_REQUEST);

    expect(JSON.parse(headers["cf-aig-metadata"])).toMatchObject({ userId: 7 });
    expect(headers["cf-aig-collect-log"]).toBe("true");
    expect(Number(headers["cf-aig-cache-ttl"])).toBeGreaterThan(0);
  });

  it("sends nothing identifying, cacheable, or loggable for a locked turn", () => {
    const headers = buildAiGatewayControlHeaders({
      ...IDENTIFIED_REQUEST,
      locked: true,
    });

    expect(JSON.parse(headers["cf-aig-metadata"])).toEqual({});
    expect(headers["cf-aig-collect-log"]).toBe("false");
    expect(headers["cf-aig-cache-ttl"]).toBe("0");
  });

  it("keeps a locked turn out of the cache even when a TTL was requested", () => {
    const headers = buildAiGatewayControlHeaders({
      ...IDENTIFIED_REQUEST,
      cache_ttl_seconds: 3600,
      locked: true,
    });

    expect(headers["cf-aig-cache-ttl"]).toBe("0");
  });
});
