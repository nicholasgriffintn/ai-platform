import { describe, expect, it } from "vitest";

import { TelegramChannelAdapter } from "../TelegramChannelAdapter";

describe("TelegramChannelAdapter", () => {
  const adapter = new TelegramChannelAdapter();

  it("refuses a request with no token at all", async () => {
    const request = new Request("https://example.test/webhook", { method: "POST" });

    await expect(adapter.verify(request, "shared-token", "")).resolves.toMatchObject({ ok: false });
  });
});
