import { describe, expect, it, vi } from "vitest";

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
  it("retains the root thread and recognises an app mention", () => {
    expect(
      adapter.parse(
        JSON.stringify({
          team_id: "T1",
          event: {
            type: "app_mention",
            channel: "C1",
            user: "U1",
            text: "<@UBOT> explain",
            ts: "2.2",
            thread_ts: "1.2",
          },
        }),
        { botUserId: "UBOT" },
      ),
    ).toMatchObject({ threadId: "1.2", mentioned: true, body: "explain" });
  });

  it("rejects a signed event without a workspace or sender identity", () => {
    expect(
      adapter.parse(
        JSON.stringify({ event: { type: "message", channel: "C1", text: "hello", ts: "1.2" } }),
      ),
    ).toMatchObject({ kind: "control" });
  });

  it("posts a reply inside the original Slack thread", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    vi.stubGlobal("fetch", fetcher);

    try {
      await adapter.sendReply({ externalId: "C1", threadId: "1.2", body: "reply" }, "bot-token");
      expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
        channel: "C1",
        thread_ts: "1.2",
        text: "reply",
      });
    } finally {
      vi.unstubAllGlobals();
    }
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
