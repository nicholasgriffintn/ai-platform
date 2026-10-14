import { hmacSha256, toHex } from "@ngriffin_uk/polychat-utility-server/crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import { deliverWebhookEvent, signWebhookPayload } from "../signing";

const event = {
  object: "event" as const,
  id: "evt_1",
  type: "response.completed" as const,
  created_at: "2026-10-14T00:00:00.000Z",
  data: {},
};

describe("webhook signing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("signs the timestamp and body so receivers can verify both", async () => {
    const header = await signWebhookPayload("whsec_test", '{"id":"evt_1"}', 1_790_000_000);
    const expected = toHex(await hmacSha256("whsec_test", '1790000000.{"id":"evt_1"}'));

    expect(header).toBe(`t=1790000000,v1=${expected}`);
  });

  it("refuses to deliver to private hosts", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      deliverWebhookEvent("https://169.254.169.254/hook", "whsec_test", event),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats redirects as failed deliveries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 302, headers: { location: "/elsewhere" } })),
    );

    await expect(
      deliverWebhookEvent("https://hooks.example.com/polychat", "whsec_test", event),
    ).resolves.toEqual({ delivered: false, status: 302 });
  });
});
