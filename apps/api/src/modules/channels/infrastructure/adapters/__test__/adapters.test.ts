import { describe, expect, it } from "vitest";

import { SlackChannelAdapter } from "../SlackChannelAdapter";
import { TelegramChannelAdapter } from "../TelegramChannelAdapter";

describe("SlackChannelAdapter", () => {
  const adapter = new SlackChannelAdapter();

  it("ignores its own messages so it cannot answer itself", () => {
    expect(
      adapter.parse(
        JSON.stringify({ event: { type: "message", bot_id: "B1", text: "hi", channel: "C1" } }),
      ),
    ).toMatchObject({ kind: "control" });
  });
});

describe("TelegramChannelAdapter", () => {
  const adapter = new TelegramChannelAdapter();

  it("refuses a request with no token at all", async () => {
    const request = new Request("https://example.test/webhook", { method: "POST" });

    await expect(adapter.verify(request, "shared-token", "")).resolves.toMatchObject({ ok: false });
  });

  it("ignores messages from other bots", () => {
    expect(
      adapter.parse(
        JSON.stringify({
          message: { message_id: 1, chat: { id: 9 }, from: { id: 2, is_bot: true }, text: "hi" },
        }),
      ),
    ).toMatchObject({ kind: "control" });
  });
});
